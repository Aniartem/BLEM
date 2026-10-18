'use strict';
// Проверки табеля и кассовых смен: npm test.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../server');
const { hashPassword } = require('../auth');

const sent = [];
const fakeTg = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const method = req.url.split('/').pop();
    res.setHeader('content-type', 'application/json');
    if (method === 'getUpdates') return setTimeout(() => res.end('{"ok":true,"result":[]}'), 200);
    if (method === 'sendMessage') sent.push(JSON.parse(body));
    res.end(JSON.stringify({ ok: true, result: { message_id: sent.length } }));
  });
});

let app, base, admin, oper;
const silent = { log() {}, error() {} };
let ip = 0;
function api(method, path, body, headers = {}) {
  return fetch(base + path, {
    method,
    headers: { 'x-forwarded-for': `10.1.0.${++ip}`, origin: base, ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
}
const json = async (r) => ({ status: r.status, ...(await r.json()) });
async function login(l, p) {
  const r = await api('POST', '/api/login', { login: l, password: p });
  return r.headers.get('set-cookie').split(';')[0];
}
const until = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 20)); }
  throw new Error('не дождались');
};

before(async () => {
  await new Promise((r) => fakeTg.listen(0, '127.0.0.1', r));
  app = createApp({
    port: 0, host: '127.0.0.1', dbFile: ':memory:', publicUrl: '', secureCookies: false, trustProxy: true, timeZone: 'Europe/Samara',
    telegram: { token: 'T', chatIds: ['1'], apiBase: `http://127.0.0.1:${fakeTg.address().port}` }
  }, { log: silent });
  base = `http://127.0.0.1:${(await app.start()).port}`;
  app.db.addUser('boss', 'Анна (админ)', hashPassword('boss-pass-1'), 'admin');
  app.db.addUser('kassa', 'Мария (оператор)', hashPassword('kassa-pass-1'), 'operator');
  admin = await login('boss', 'boss-pass-1');
  oper = await login('kassa', 'kassa-pass-1');
});
after(async () => { await app.stop(); await new Promise((r) => fakeTg.close(r)); });

let device;

test('сотрудники: добавлять может только администратор', async () => {
  assert.equal((await api('POST', '/api/staff/employees', { name: 'Иван', role: 'Повар', pin: '1234' })).status, 401);
  assert.equal((await api('POST', '/api/staff/employees', { name: 'Иван', role: 'Повар', pin: '1234' }, { cookie: oper })).status, 403);

  const ivan = await json(await api('POST', '/api/staff/employees', { name: 'Иван', role: 'Повар', pin: '1234', rate: 300 }, { cookie: admin }));
  assert.equal(ivan.status, 201);
  assert.equal((await api('POST', '/api/staff/employees', { name: 'Пётр', role: 'Курьер', pin: '5678', rate: 250 }, { cookie: admin })).status, 201);

  const dup = await json(await api('POST', '/api/staff/employees', { name: 'Олег', role: 'Курьер', pin: '1234' }, { cookie: admin }));
  assert.equal(dup.status, 422);
  assert.match(dup.error, /уже у другого/);
  assert.equal((await api('POST', '/api/staff/employees', { name: 'Олег', pin: '12' }, { cookie: admin })).status, 422);

  const listOper = await json(await api('GET', '/api/staff/employees', null, { cookie: oper }));
  assert.equal(listOper.employees.length, 2);
  assert.equal(listOper.employees[0].rate, undefined); // оператор не видит ставки
  const listAdmin = await json(await api('GET', '/api/staff/employees', null, { cookie: admin }));
  assert.ok(listAdmin.employees.some((e) => e.rate === 300));
});

test('планшет: без подключения отметиться нельзя', async () => {
  assert.equal((await api('GET', '/api/timeclock/state')).status, 401);
  assert.equal((await api('POST', '/api/timeclock/punch', { pin: '1234' })).status, 401);
  assert.equal((await api('POST', '/api/staff/devices', { name: 'Кухня' }, { cookie: oper })).status, 403);
  const r = await api('POST', '/api/staff/devices', { name: 'Кухня' }, { cookie: admin });
  assert.equal(r.status, 200);
  device = r.headers.get('set-cookie').split(';')[0];
  assert.match(device, /^rv_device=/);
  const state = await json(await api('GET', '/api/timeclock/state', null, { cookie: device }));
  assert.equal(state.device, 'Кухня');
  assert.deepEqual(state.onShift, []);
});

test('отметка по ПИН: начало и конец смены', async () => {
  const wrong = await json(await api('POST', '/api/timeclock/punch', { pin: '0000' }, { cookie: device }));
  assert.equal(wrong.status, 404);

  const start = await json(await api('POST', '/api/timeclock/punch', { pin: '1234' }, { cookie: device }));
  assert.equal(start.action, 'start');
  assert.equal(start.name, 'Иван');
  await api('POST', '/api/timeclock/punch', { pin: '5678' }, { cookie: device });
  const state = await json(await api('GET', '/api/timeclock/state', null, { cookie: device }));
  assert.deepEqual(state.onShift.map((s) => s.name).sort(), ['Иван', 'Пётр']);

  // сдвигаем начало смены Ивана на 8 часов назад, чтобы проверить подсчёт часов и денег
  app.db.raw.prepare("UPDATE work_shifts SET started_at = started_at - 8 * 3600000 WHERE employee_id = (SELECT id FROM employees WHERE name = 'Иван')").run();
  const end = await json(await api('POST', '/api/timeclock/punch', { pin: '1234' }, { cookie: device }));
  assert.equal(end.action, 'end');
  assert.ok(end.minutes >= 480 && end.minutes <= 481);

  const from = Date.now() - 864e5, to = Date.now() + 1000;
  const sheetAdmin = await json(await api('GET', `/api/staff/timeclock?from=${from}&to=${to}`, null, { cookie: admin }));
  const ivan = sheetAdmin.employees.find((e) => e.name === 'Иван');
  assert.equal(ivan.shifts, 1);
  assert.equal(ivan.pay, 2400); // 8 ч × 300 ₽
  assert.deepEqual(sheetAdmin.onShift.map((s) => s.name), ['Пётр']);
  const sheetOper = await json(await api('GET', `/api/staff/timeclock?from=${from}&to=${to}`, null, { cookie: oper }));
  assert.equal(sheetOper.employees.find((e) => e.name === 'Иван').pay, undefined);
});

test('ПИН нельзя подобрать перебором', async () => {
  const r = await api('POST', '/api/staff/devices', { name: 'Зал' }, { cookie: admin });
  const dev2 = r.headers.get('set-cookie').split(';')[0];
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await api('POST', '/api/timeclock/punch', { pin: `99${i}0` }, { cookie: dev2 })).status);
  assert.deepEqual(codes, [404, 404, 404, 404, 404, 429]);
  assert.equal((await api('POST', '/api/timeclock/punch', { pin: '1234' }, { cookie: dev2 })).status, 429);
});

test('админ закрывает забытую смену, уволенный не может отметиться', async () => {
  const sheet = await json(await api('GET', '/api/staff/timeclock', null, { cookie: admin }));
  const petr = sheet.onShift.find((s) => s.name === 'Пётр');
  assert.equal((await api('POST', `/api/staff/work-shifts/${petr.shiftId}/close`, null, { cookie: oper })).status, 403);
  assert.equal((await api('POST', `/api/staff/work-shifts/${petr.shiftId}/close`, null, { cookie: admin })).status, 200);
  assert.equal((await json(await api('GET', '/api/timeclock/state', null, { cookie: device }))).onShift.length, 0);

  await api('PATCH', `/api/staff/employees/${petr.employeeId}`, { active: false }, { cookie: admin });
  assert.equal((await api('POST', '/api/timeclock/punch', { pin: '5678' }, { cookie: device })).status, 404);
});

test('касса: открытие, внесения и изъятия, выручка по заказам, закрытие с расхождением', async () => {
  const placed = async (payment, items) => {
    const r = await json(await api('POST', '/api/orders', {
      name: 'Клиент', phone: `+7912${String(Math.random()).slice(2, 9)}`, method: 'delivery', address: 'ул. Ленина, 1', payment, items
    }));
    const { orders } = await json(await api('GET', '/api/orders', null, { cookie: oper }));
    return orders.find((o) => o.id === r.id);
  };
  const done = (o) => api('PATCH', `/api/orders/${o.id}`, { status: 'done' }, { cookie: oper });

  // заказ, выполненный до открытия смены, в выручку не попадает
  const early = await placed('Наличными', [{ id: 'trio-set-24-pcs', qty: 1 }]);
  await done(early);
  await new Promise((r) => setTimeout(r, 5));

  assert.equal((await json(await api('GET', '/api/staff/cash', null, { cookie: oper }))).current, null);
  assert.equal((await api('POST', '/api/staff/cash/move', { kind: 'in', amount: 100, reason: 'тест' }, { cookie: oper })).status, 409);
  assert.equal((await api('POST', '/api/staff/cash/open', { openingCash: 'много' }, { cookie: oper })).status, 422);

  sent.length = 0;
  const opened = await json(await api('POST', '/api/staff/cash/open', { openingCash: 5000 }, { cookie: oper }));
  assert.equal(opened.status, 201);
  assert.equal(opened.current.openedBy, 'Мария (оператор)');
  assert.equal((await api('POST', '/api/staff/cash/open', { openingCash: 1 }, { cookie: admin })).status, 409);
  await until(() => sent.find((m) => /Касса открыта/.test(m.text)));

  const cashOrder = await placed('Наличными', [{ id: 'philadelphia-with-avocado', qty: 2 }]); // 1500
  const cardOrder = await placed('Картой курьеру', [{ id: 'canada', qty: 1 }, { id: 'dragon', qty: 1 }]); // 1970
  const sbpOrder = await placed('СБП', [{ id: 'trio-set-24-pcs', qty: 1 }]); // 1500
  const notDone = await placed('Наличными', [{ id: 'trio-set-24-pcs', qty: 1 }]);
  for (const o of [cashOrder, cardOrder, sbpOrder]) await done(o);
  assert.equal(notDone.status, 'new');

  await api('POST', '/api/staff/cash/move', { kind: 'in', amount: 1000, reason: 'Размен' }, { cookie: oper });
  assert.equal((await api('POST', '/api/staff/cash/move', { kind: 'out', amount: 300 }, { cookie: oper })).status, 422);
  await api('POST', '/api/staff/cash/move', { kind: 'out', amount: 300, reason: 'Такси курьеру' }, { cookie: oper });

  const cur = (await json(await api('GET', '/api/staff/cash', null, { cookie: oper }))).current;
  assert.deepEqual(cur.totals, { cash: 1500, card: 1970, sbp: 1500, other: 0 });
  assert.equal(cur.ordersDone, 3);
  assert.equal(cur.revenue, 4970);
  assert.equal(cur.expectedCash, 5000 + 1500 + 1000 - 300);
  assert.equal(cur.moves.length, 2);

  sent.length = 0;
  const closed = await json(await api('POST', '/api/staff/cash/close', { countedCash: 7100, note: 'Пересчитала дважды' }, { cookie: oper }));
  assert.equal(closed.status, 200);
  assert.equal(closed.closed.difference, -100);
  const msg = await until(() => sent.find((m) => /Касса закрыта/.test(m.text)));
  assert.match(msg.text, /Недостача 100 ₽/);
  assert.match(msg.text, /выручка 4 970 ₽/);

  const after = await json(await api('GET', '/api/staff/cash', null, { cookie: admin }));
  assert.equal(after.current, null);
  assert.equal(after.history[0].countedCash, 7100);
  assert.equal(after.history[0].note, 'Пересчитала дважды');
  assert.equal((await api('POST', '/api/staff/cash/close', { countedCash: 1 }, { cookie: oper })).status, 409);
});
