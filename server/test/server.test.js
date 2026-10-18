'use strict';
// Проверки сервера: npm test. Telegram подменяется локальным поддельным API.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../server');
const { hashPassword } = require('../auth');

// ---------- поддельный Telegram ----------
const tg = { sent: [], edited: [], answers: [], queue: [], waiters: [] };
const fakeTg = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const data = JSON.parse(body || '{}');
    const method = req.url.split('/').pop();
    const ok = (result) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, result })); };
    if (method === 'sendMessage') { tg.sent.push(data); return ok({ message_id: tg.sent.length }); }
    if (method === 'editMessageText') { tg.edited.push(data); return ok(true); }
    if (method === 'answerCallbackQuery') { tg.answers.push(data); return ok(true); }
    if (method === 'getUpdates') {
      let done = false;
      const reply = () => {
        if (done) return;
        done = true;
        ok(tg.queue.splice(0).filter((u) => u.update_id >= (data.offset || 0)));
      };
      if (tg.queue.length) return reply();
      setTimeout(reply, 300);
      tg.waiters.push(reply);
      return;
    }
    ok(true);
  });
});
function pushUpdate(u) { tg.queue.push(u); const w = tg.waiters.splice(0); w.forEach((f) => f()); }
const until = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 20)); }
  throw new Error('не дождались');
};

// ---------- сервер ----------
let app, base, cookie;
const silent = { log() {}, error() {} };

before(async () => {
  await new Promise((r) => fakeTg.listen(0, '127.0.0.1', r));
  app = createApp({
    port: 0, host: '127.0.0.1', dbFile: ':memory:', publicUrl: 'https://rollevich.test', secureCookies: false,
    trustProxy: true, timeZone: 'Europe/Samara',
    telegram: { token: 'TEST', chatIds: ['111'], apiBase: `http://127.0.0.1:${fakeTg.address().port}` }
  }, { log: silent });
  const addr = await app.start();
  base = `http://127.0.0.1:${addr.port}`;
  app.db.addUser('oper', 'Мария', hashPassword('секрет-пароль'));
});

after(async () => {
  await app.stop();
  await new Promise((r) => fakeTg.close(r));
});

let ipCounter = 0;
function api(method, path, body, headers = {}) {
  return fetch(base + path, {
    method,
    headers: { 'x-forwarded-for': headers.ip || `10.0.0.${++ipCounter}`, ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
}
const order = (extra = {}) => ({
  name: 'Анна', phone: '+7 (912) 000-11-22', method: 'delivery', address: 'ул. Пушкинская, 154',
  persons: 2, time: 'Как можно скорее', payment: 'Картой курьеру', comment: 'Домофон 15',
  items: [{ id: 'philadelphia-with-avocado', qty: 1, price: 1 }, { id: 'trio-set-24-pcs', qty: 1, price: 1 }],
  total: 2, ...extra
});

test('сайт и служебные адреса', async () => {
  assert.equal((await api('GET', '/api/health')).status, 200);
  const page = await api('GET', '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal((await api('GET', '/crm')).status, 200);
  assert.equal((await api('GET', '/smena')).status, 200);
  assert.equal((await api('GET', '/assets/js/menu.js')).status, 200);
  for (const p of ['/server/server.js', '/.env', '/package.json', '/assets/../server/db.js', '/assets/%2e%2e/server/db.js', '/data/rollevich.db']) {
    assert.equal((await api('GET', p)).status, 404, p);
  }
});

test('заказ: сервер сам считает цены и присваивает номер', async () => {
  const r1 = await api('POST', '/api/orders', order());
  assert.equal(r1.status, 201);
  const o1 = await r1.json();
  assert.equal(o1.number, 1001);
  assert.equal(o1.total, 750 + 1500); // цены из меню, а не из запроса; от 1500 ₽ доставка бесплатна

  const r2 = await api('POST', '/api/orders', order({ phone: '89225553344', items: [{ id: 'california', qty: 1 }, { id: 'tom-yum', qty: 1 }] }));
  const o2 = await r2.json();
  assert.equal(o2.number, 1002);
  assert.equal(o2.total, 460 + 760 + 200);

  const r3 = await api('POST', '/api/orders', order({ phone: '+79120001100', method: 'pickup', address: '', promo: 'первый', items: [{ id: 'california', qty: 2 }] }));
  assert.equal((await r3.json()).total, 920 - Math.round(920 * 0.15)); // промокод 15% больше скидки самовывоза 10%
});

test('заказ: понятные ошибки формы', async () => {
  const cases = [
    [{ phone: '123' }, /телефон/],
    [{ name: '  ' }, /имя/],
    [{ address: '' }, /адрес/],
    [{ items: [] }, /Корзина пуста/],
    [{ items: [{ id: 'нет-такого', qty: 1 }] }, /нет в меню/],
    [{ items: [{ id: 'cucumber-maki', qty: 1 }] }, /Минимальная сумма/]
  ];
  for (const [patch, re] of cases) {
    const r = await api('POST', '/api/orders', order(patch));
    assert.equal(r.status, 422, JSON.stringify(patch));
    assert.match((await r.json()).error, re);
  }
  const bad = await fetch(base + '/api/orders', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' });
  assert.equal(bad.status, 415);
});

test('заказ: ловушка для ботов и защита от спама', async () => {
  const before = app.db.listOrders(0, 100).length;
  const trap = await api('POST', '/api/orders', order({ website: 'http://spam' }));
  assert.equal(trap.status, 201);
  assert.equal(app.db.listOrders(0, 100).length, before);

  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await api('POST', '/api/orders', order({ phone: `+7912111220${i}` }), { ip: '10.9.9.9' })).status);
  assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
});

test('CRM: без входа заказы не видны', async () => {
  assert.equal((await api('GET', '/api/orders')).status, 401);
  assert.equal((await api('GET', '/api/me')).status, 401);
  assert.equal((await api('GET', '/api/events')).status, 401);
  assert.equal((await api('PATCH', '/api/orders/x', { status: 'done' })).status, 401);
});

test('CRM: вход сотрудника', async () => {
  const wrong = await api('POST', '/api/login', { login: 'oper', password: 'не тот' });
  assert.equal(wrong.status, 401);
  const nobody = await api('POST', '/api/login', { login: 'nobody', password: 'x' });
  assert.equal(nobody.status, 401);

  const ok = await api('POST', '/api/login', { login: 'OPER', password: 'секрет-пароль' });
  assert.equal(ok.status, 200);
  const set = ok.headers.get('set-cookie');
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Strict/);
  cookie = set.split(';')[0];
  assert.equal((await (await api('GET', '/api/me', null, { cookie })).json()).user.name, 'Мария');

  const list = await (await api('GET', '/api/orders', null, { cookie })).json();
  assert.ok(list.orders.length >= 3);
  assert.equal(list.orders[list.orders.length - 1].number, 1001);
});

test('CRM: смена статуса, история и защита от чужих сайтов', async () => {
  const { orders } = await (await api('GET', '/api/orders', null, { cookie })).json();
  const o = orders.find((x) => x.number === 1001);

  const foreign = await api('PATCH', `/api/orders/${o.id}`, { status: 'accepted' }, { cookie, origin: 'https://evil.example' });
  assert.equal(foreign.status, 403);

  const r = await api('PATCH', `/api/orders/${o.id}`, { status: 'accepted' }, { cookie, origin: base });
  assert.equal(r.status, 200);
  const updated = (await r.json()).order;
  assert.equal(updated.status, 'accepted');
  assert.deepEqual(updated.history.map((h) => [h.status, h.by]), [['new', undefined], ['accepted', 'Мария']]);

  assert.equal((await api('PATCH', `/api/orders/${o.id}`, { status: 'eaten' }, { cookie })).status, 400);
  assert.equal((await api('PATCH', '/api/orders/nope', { status: 'done' }, { cookie })).status, 404);
});

test('CRM: новый заказ приходит в открытое окно без перезагрузки', async () => {
  const ctrl = new AbortController();
  const res = await fetch(base + '/api/events', { headers: { cookie }, signal: ctrl.signal });
  assert.equal(res.status, 200);
  const reader = res.body.getReader();
  const got = (async () => {
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return null;
      buf += Buffer.from(value).toString('utf8');
      const m = buf.match(/event: order\ndata: (.+)\n\n/);
      if (m) return JSON.parse(m[1]);
    }
  })();
  await api('POST', '/api/orders', order({ name: 'Игорь', phone: '+79225550000' }));
  const ev = await got;
  ctrl.abort();
  assert.equal(ev.name, 'Игорь');
  assert.equal(ev.status, 'new');
});

test('Telegram: уведомление о заказе и кнопки статуса', async () => {
  tg.sent.length = 0;
  const r = await api('POST', '/api/orders', order({ name: 'Олег <script>', phone: '+79120009999', comment: 'Без лука & побыстрее' }));
  const { id, number } = await r.json();
  const msg = await until(() => tg.sent.find((m) => m.text.includes(`№ ${number}`)));
  assert.equal(msg.chat_id, '111');
  assert.equal(msg.parse_mode, 'HTML');
  assert.match(msg.text, /Олег &lt;script&gt;/); // имя клиента экранировано
  assert.match(msg.text, /Без лука &amp; побыстрее/);
  assert.match(msg.text, /Итого: 2 250 ₽/);
  const buttons = msg.reply_markup.inline_keyboard.flat();
  assert.deepEqual(buttons.map((b) => b.text), ['Принять →', 'Отменить', 'Открыть CRM']);
  assert.equal(buttons[2].url, 'https://rollevich.test/crm');

  // сотрудник нажимает «Принять» в Telegram
  pushUpdate({ update_id: 500, callback_query: { id: 'cb1', data: buttons[0].callback_data, from: { first_name: 'Пётр' }, message: { message_id: 1, chat: { id: 111 } } } });
  await until(() => app.db.getOrder(id).status === 'accepted');
  const saved = app.db.getOrder(id);
  assert.equal(saved.history[saved.history.length - 1].by, 'Пётр (Telegram)');
  const edit = await until(() => tg.edited.find((e) => e.text.includes(`№ ${number}`) && e.text.includes('Принят')));
  assert.equal(edit.reply_markup.inline_keyboard[0][0].text, 'На кухню →');
  await until(() => tg.answers.find((a) => a.callback_query_id === 'cb1'));

  // кнопка из чужого чата не работает
  pushUpdate({ update_id: 501, callback_query: { id: 'cb2', data: `c:${id}`, from: { first_name: 'Чужой' }, message: { message_id: 9, chat: { id: 999 } } } });
  const denied = await until(() => tg.answers.find((a) => a.callback_query_id === 'cb2'));
  assert.match(denied.text, /не подключён/);
  assert.equal(app.db.getOrder(id).status, 'accepted');

  // смена статуса в CRM обновляет сообщение в Telegram
  tg.edited.length = 0;
  await api('PATCH', `/api/orders/${id}`, { status: 'cancelled' }, { cookie });
  const cancelled = await until(() => tg.edited.find((e) => e.text.includes('Отменён')));
  assert.equal(cancelled.reply_markup.inline_keyboard.flat().filter((b) => b.callback_data).length, 0);
});

test('Telegram: команда /id подсказывает ID чата', async () => {
  tg.sent.length = 0;
  pushUpdate({ update_id: 600, message: { text: '/id', chat: { id: 4242 } } });
  const reply = await until(() => tg.sent.find((m) => m.chat_id === '4242'));
  assert.match(reply.text, /4242/);
  assert.match(reply.text, /TELEGRAM_CHAT_IDS/);
});

test('CRM: администратор оформляет заказ по телефону', async () => {
  const phoneOrder = order({ name: 'Нина', phone: '+79120007777', items: [{ id: 'cucumber-maki', qty: 1 }], accepted: true, price: 1 });
  assert.equal((await api('POST', '/api/staff/orders', phoneOrder)).status, 401);
  assert.equal((await api('POST', '/api/staff/orders', phoneOrder, { cookie, origin: 'https://evil.example' })).status, 403);

  tg.sent.length = 0;
  const r = await api('POST', '/api/staff/orders', phoneOrder, { cookie, origin: base });
  assert.equal(r.status, 201);
  const o = (await r.json()).order;
  assert.equal(o.status, 'accepted');            // клиент подтвердил по телефону
  assert.equal(o.source, 'phone');
  assert.equal(o.createdBy, 'Мария');
  assert.equal(o.total, 200 + 200);              // ниже минимальной суммы — администратору можно, доставка платная
  assert.deepEqual(o.history.map((h) => [h.status, h.by]), [['new', 'Мария'], ['accepted', 'Мария']]);
  const msg = await until(() => tg.sent.find((m) => m.text.includes(`№ ${o.number}`)));
  assert.match(msg.text, /Заказ по телефону/);
  assert.match(msg.text, /Принят<\/b> · Мария/);
  assert.equal(msg.reply_markup.inline_keyboard[0][0].text, 'На кухню →');

  // у администратора нет лимита «5 заказов за 10 минут»
  for (let i = 0; i < 7; i++) {
    const rr = await api('POST', '/api/staff/orders', order({ phone: `+7912000880${i}` }), { cookie, ip: '10.7.7.7' });
    assert.equal(rr.status, 201);
  }
  const bad = await api('POST', '/api/staff/orders', order({ phone: '12' }), { cookie });
  assert.equal(bad.status, 422);
});

test('выход из CRM закрывает сессию', async () => {
  const r = await api('POST', '/api/logout', null, { cookie });
  assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await api('GET', '/api/orders', null, { cookie })).status, 401);
});
