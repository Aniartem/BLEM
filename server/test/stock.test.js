'use strict';
// Проверки склада: npm test.
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

let app, base, cookie;
const silent = { log() {}, error() {} };
const api = (method, path, body, headers = {}) => fetch(base + path, {
  method,
  headers: { origin: base, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
  body: body ? JSON.stringify(body) : undefined
});
const json = async (r) => ({ status: r.status, ...(await r.json()) });
const until = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 20)); }
  throw new Error('не дождались');
};
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Samara', year: 'numeric', month: '2-digit', day: '2-digit' });
const day = (offset) => dayFmt.format(new Date(Date.now() + offset * 864e5));
let products;
const pid = (name) => products.find((p) => p.name === name).id;
const stock = async () => { const r = await json(await api('GET', '/api/staff/stock')); products = r.products; return r; };

before(async () => {
  await new Promise((r) => fakeTg.listen(0, '127.0.0.1', r));
  app = createApp({
    port: 0, host: '127.0.0.1', dbFile: ':memory:', publicUrl: '', secureCookies: false, trustProxy: false, timeZone: 'Europe/Samara',
    telegram: { token: 'T', chatIds: ['1'], apiBase: `http://127.0.0.1:${fakeTg.address().port}` }
  }, { log: silent });
  base = `http://127.0.0.1:${(await app.start()).port}`;
  app.db.addUser('anna', 'Анна', hashPassword('anna-pass-1'));
  const r = await api('POST', '/api/login', { login: 'anna', password: 'anna-pass-1' });
  cookie = r.headers.get('set-cookie').split(';')[0];
});
after(async () => { await app.stop(); await new Promise((r) => fakeTg.close(r)); });

test('склад закрыт без входа в CRM', async () => {
  const saved = cookie; cookie = null;
  assert.equal((await api('GET', '/api/staff/stock')).status, 401);
  assert.equal((await api('POST', '/api/staff/stock/receipts', { lines: [] })).status, 401);
  cookie = saved;
});

test('справочник: типовой список, новое сырьё, проверки', async () => {
  const s0 = await stock();
  assert.equal(s0.products.length, 0);
  assert.equal((await json(await api('POST', '/api/staff/stock/starter'))).added, app.stock.STARTER.length);
  assert.equal((await api('POST', '/api/staff/stock/starter')).status, 409);

  assert.equal((await api('POST', '/api/staff/stock/products', { name: 'Кумкват', unit: 'кг', category: 'Овощи и фрукты', min: 0.2 })).status, 201);
  const dup = await json(await api('POST', '/api/staff/stock/products', { name: 'кумкват', unit: 'кг', category: 'Овощи и фрукты' }));
  assert.equal(dup.status, 422);
  assert.match(dup.error, /уже есть/);
  assert.match((await json(await api('POST', '/api/staff/stock/products', { name: 'Тест', unit: 'ведро', category: 'Бакалея' }))).error, /единицу/);
  const s = await stock();
  assert.equal(s.products.length, app.stock.STARTER.length + 1);
  assert.ok(s.products.every((p) => p.qty === 0 && p.status === 'none')); // ещё не поступало
});

test('приход по накладной: остатки, средняя цена, новый поставщик, срок годности', async () => {
  const r1 = await json(await api('POST', '/api/staff/stock/receipts', {
    supplier: 'РыбТорг Ижевск', number: 'УТ-1042', date: day(0),
    lines: [
      { productId: pid('Лосось охлаждённый'), qty: '5', price: '1500', expiry: day(1) },
      { productId: pid('Рис для суши'), qty: 25, price: 180 }
    ]
  }));
  assert.equal(r1.status, 201);
  assert.equal(r1.total, 5 * 1500 + 25 * 180);

  await api('POST', '/api/staff/stock/receipts', { supplier: 'рыбторг ижевск', lines: [{ productId: pid('Лосось охлаждённый'), qty: '3,0', price: 1700, expiry: day(5) }] });
  const s = await stock();
  const salmon = s.products.find((p) => p.name === 'Лосось охлаждённый');
  assert.equal(salmon.qty, 8);
  assert.equal(salmon.avgPrice, (5 * 1500 + 3 * 1700) / 8); // 1575
  assert.equal(salmon.lastPrice, 1700);
  assert.equal(salmon.value, 8 * 1575);
  assert.equal(salmon.status, 'ok');
  assert.equal(s.suppliers.length, 1); // тот же поставщик без учёта регистра
  assert.deepEqual(s.expiring.map((e) => [e.name, e.expiry]), [['Лосось охлаждённый', day(1)]]); // срок через 5 дней ещё не «истекает»

  const bad = await json(await api('POST', '/api/staff/stock/receipts', { supplier: 'X', lines: [{ productId: pid('Нори'), qty: 0, price: 10 }] }));
  assert.match(bad.error, /количество/);
  assert.match((await json(await api('POST', '/api/staff/stock/receipts', { lines: [{ productId: pid('Нори'), qty: 1 }] }))).error, /поставщика/);
  assert.match((await json(await api('POST', '/api/staff/stock/receipts', { supplier: 'X', lines: [{ productId: 99999, qty: 1 }] }))).error, /нет в справочнике/);
});

test('списание: остаток уменьшается, при переходе через минимум — сообщение в Telegram', async () => {
  assert.match((await json(await api('POST', '/api/staff/stock/writeoffs', { reason: 'Съели', lines: [{ productId: pid('Лосось охлаждённый'), qty: 1 }] }))).error, /причину/);
  sent.length = 0;
  const r = await json(await api('POST', '/api/staff/stock/writeoffs', { reason: 'Порча', note: 'Холодильник', lines: [{ productId: pid('Лосось охлаждённый'), qty: 6.5 }] }));
  assert.equal(r.status, 201);
  assert.equal(r.total, 6.5 * 1575);
  const salmon = (await stock()).products.find((p) => p.name === 'Лосось охлаждённый');
  assert.equal(salmon.qty, 1.5);
  assert.equal(salmon.status, 'low');
  const msg = await until(() => sent.find((m) => /Заканчивается/.test(m.text)));
  assert.match(msg.text, /Лосось охлаждённый — 1,5 кг \(минимум 3 кг\)/);

  // повторное списание ниже минимума не спамит
  sent.length = 0;
  await api('POST', '/api/staff/stock/writeoffs', { reason: 'Порча', lines: [{ productId: pid('Лосось охлаждённый'), qty: 0.5 }] });
  await new Promise((res) => setTimeout(res, 150));
  assert.equal(sent.filter((m) => /Заканчивается/.test(m.text)).length, 0);
});

test('инвентаризация: поправки на разницу и сумма недостачи', async () => {
  const r = await json(await api('POST', '/api/staff/stock/inventory', {
    note: 'Конец месяца',
    counts: [
      { productId: pid('Рис для суши'), actual: '24,2' },
      { productId: pid('Лосось охлаждённый'), actual: 1 }
    ]
  }));
  assert.equal(r.status, 201);
  assert.equal(r.shortage, 144); // 0,8 кг риса × 180 ₽; лосось сходится
  assert.equal(r.surplus, 0);
  const s = await stock();
  assert.equal(s.products.find((p) => p.name === 'Рис для суши').qty, 24.2);

  const inv = await json(await api('GET', '/api/staff/stock/docs?kind=inventory'));
  assert.deepEqual(inv.docs[0].lines.map((l) => [l.name, l.system, l.qty]), [['Рис для суши', 25, -0.8], ['Лосось охлаждённый', 1, 0]]);
});

test('журнал документов и история по сырью', async () => {
  const rec = await json(await api('GET', '/api/staff/stock/docs?kind=receipt'));
  assert.equal(rec.docs.length, 2);
  assert.equal(rec.docs[1].number, 'УТ-1042');
  assert.equal(rec.docs[1].supplier, 'РыбТорг Ижевск');
  assert.equal(rec.docs[1].by, 'Анна');
  const wo = await json(await api('GET', '/api/staff/stock/docs?kind=writeoff'));
  assert.deepEqual(wo.docs.map((d) => d.reason), ['Порча', 'Порча']);

  const h = await json(await api('GET', `/api/staff/stock/products/${pid('Лосось охлаждённый')}/moves`));
  assert.deepEqual(h.moves.map((m) => [m.kind, m.qty]), [['inventory', 0], ['writeoff', -0.5], ['writeoff', -6.5], ['receipt', 3], ['receipt', 5]]);
  assert.equal(h.product.qty, 1);

  assert.equal((await api('PATCH', `/api/staff/stock/products/${pid('Кумкват')}`, { active: false, min: 1 })).status, 200);
  assert.equal((await stock()).products.find((p) => p.name === 'Кумкват').active, false);
});
