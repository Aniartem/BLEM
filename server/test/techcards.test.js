'use strict';
// Проверки техкарт и автосписания сырья: npm test.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { hashPassword } = require('../auth');

let app, base, boss, cook, adm;
const silent = { log() {}, error() {} };
const api = (method, path, body, cookie) => fetch(base + path, {
  method,
  headers: { origin: base, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined
});
const json = async (r) => ({ status: r.status, ...(await r.json()) });
async function login(l, p) {
  const r = await api('POST', '/api/login', { login: l, password: p });
  return r.headers.get('set-cookie').split(';')[0];
}
let P; // название сырья → id
const qtyOf = async (name) => (await json(await api('GET', '/api/staff/stock', null, boss))).products.find((p) => p.name === name).qty;

before(async () => {
  app = createApp({ port: 0, host: '127.0.0.1', dbFile: ':memory:', publicUrl: '', secureCookies: false, trustProxy: false, timeZone: 'Europe/Samara', telegram: { token: '', chatIds: [] } }, { log: silent });
  base = `http://127.0.0.1:${(await app.start()).port}`;
  app.db.addUser('anna', 'Анна', hashPassword('anna-pass-1'), 'manager');
  app.db.addUser('olga', 'Ольга', hashPassword('olga-pass-1'), 'admin');
  app.db.addUser('chef', 'Шеф Игорь', hashPassword('chef-pass-1'), 'cook');
  boss = await login('anna', 'anna-pass-1');
  cook = await login('chef', 'chef-pass-1');
  adm = await login('olga', 'olga-pass-1');
  // склад: типовой список и приход по известным ценам
  await api('POST', '/api/staff/stock/starter', null, boss);
  const s = await json(await api('GET', '/api/staff/stock', null, boss));
  P = Object.fromEntries(s.products.map((p) => [p.name, p.id]));
  await api('POST', '/api/staff/stock/receipts', {
    supplier: 'РыбТорг', lines: [
      { productId: P['Лосось охлаждённый'], qty: 10, price: 1600 },
      { productId: P['Сливочный сыр'], qty: 5, price: 800 },
      { productId: P['Рис для суши'], qty: 20, price: 200 },
      { productId: P['Нори (листы)'], qty: 100, price: 6 },
      { productId: P['Огурцы'], qty: 3, price: 150 },
      { productId: P['Снежный краб'], qty: 2, price: 900 }
    ]
  }, boss);
});
after(() => app.stop());

test('администратор: заказы и касса есть, склада и себестоимости нет', async () => {
  assert.equal((await api('GET', '/api/orders', null, adm)).status, 200);
  assert.equal((await api('GET', '/api/staff/cash', null, adm)).status, 200);
  for (const path of ['/api/staff/stock', '/api/staff/stock/docs?kind=writeoff']) {
    const r = await json(await api('GET', path, null, adm));
    assert.equal(r.status, 403, path);
    assert.match(r.error, /управляющему/);
  }
  assert.equal((await api('POST', '/api/staff/stock/writeoffs', { reason: 'Порча', lines: [] }, adm)).status, 403);
  const list = await json(await api('GET', '/api/staff/techcards', null, adm));
  assert.equal(list.status, 200);
  assert.equal(list.products[0].avgPrice, undefined);
  assert.equal(list.dishes[0].cost, undefined);
});

test('повар видит только техкарты и без денег', async () => {
  const me = await json(await api('GET', '/api/me', null, cook));
  assert.equal(me.user.role, 'cook');
  for (const path of ['/api/orders', '/api/staff/stock', '/api/staff/cash', '/api/staff/timeclock', '/api/staff/employees']) {
    assert.equal((await api('GET', path, null, cook)).status, 403, path);
  }
  const list = await json(await api('GET', '/api/staff/techcards', null, cook));
  assert.equal(list.status, 200);
  assert.equal(list.total, 349);
  assert.equal(list.filled, 0);
  const dish = list.dishes.find((d) => d.id === 'philadelphia-with-cucumber');
  assert.equal(dish.name, 'Филадельфия с огурцом');
  assert.equal(dish.price, undefined); // повар не видит цен
  assert.equal(list.products[0].avgPrice, undefined);
  assert.equal((await api('GET', '/api/staff/techcards')).status, 401);
});

test('повар заполняет техкарту, администратор видит себестоимость и фудкост', async () => {
  const card = {
    yield: 260, method: 'Рис разложить на нори, перевернуть, выложить сыр и огурец, свернуть, накрыть лососем, нарезать на 8 частей.',
    lines: [
      { kind: 'product', ref: P['Рис для суши'], qty: 0.12 },
      { kind: 'product', ref: P['Нори (листы)'], qty: 0.5 },
      { kind: 'product', ref: P['Лосось охлаждённый'], qty: 0.08 },
      { kind: 'product', ref: P['Сливочный сыр'], qty: 0.05 },
      { kind: 'product', ref: P['Огурцы'], qty: '0,03' }
    ]
  };
  assert.equal((await api('PUT', '/api/staff/techcards/philadelphia-with-cucumber', card, cook)).status, 200);

  const adm = await json(await api('GET', '/api/staff/techcards', null, boss));
  const d = adm.dishes.find((x) => x.id === 'philadelphia-with-cucumber');
  const cost = 0.12 * 200 + 0.5 * 6 + 0.08 * 1600 + 0.05 * 800 + 0.03 * 150; // 199,5 ₽
  assert.equal(d.cost, cost);
  assert.equal(d.foodCost, Math.round((cost / d.price) * 1000) / 10);
  assert.equal(d.card.yield, 260);
  assert.equal(d.card.updatedBy, 'Шеф Игорь');
  assert.deepEqual(d.card.lines.map((l) => [l.name, l.qty]), [['Рис для суши', 0.12], ['Нори (листы)', 0.5], ['Лосось охлаждённый', 0.08], ['Сливочный сыр', 0.05], ['Огурцы', 0.03]]);
  assert.equal(adm.filled, 1);
});

test('сеты собираются из других блюд, замкнутый круг запрещён', async () => {
  await api('PUT', '/api/staff/techcards/california', {
    yield: 250, lines: [
      { kind: 'product', ref: P['Рис для суши'], qty: 0.12 }, { kind: 'product', ref: P['Нори (листы)'], qty: 0.5 },
      { kind: 'product', ref: P['Снежный краб'], qty: 0.06 }, { kind: 'product', ref: P['Огурцы'], qty: 0.03 }
    ]
  }, cook);
  const r = await api('PUT', '/api/staff/techcards/trio-set-24-pcs', {
    yield: 760, lines: [
      { kind: 'dish', ref: 'philadelphia-with-cucumber', qty: 1 },
      { kind: 'dish', ref: 'california', qty: 1 },
      { kind: 'dish', ref: 'tori', qty: 1 } // у «Тори» техкарты ещё нет
    ]
  }, cook);
  assert.equal(r.status, 200);
  const adm = await json(await api('GET', '/api/staff/techcards', null, boss));
  const set = adm.dishes.find((x) => x.id === 'trio-set-24-pcs');
  const phila = adm.dishes.find((x) => x.id === 'philadelphia-with-cucumber').cost;
  const cali = adm.dishes.find((x) => x.id === 'california').cost;
  assert.equal(set.cost, Math.round((phila + cali) * 100) / 100);
  assert.equal(set.incomplete, true); // предупреждение: в сете блюдо без техкарты

  const self = await json(await api('PUT', '/api/staff/techcards/california', { lines: [{ kind: 'dish', ref: 'california', qty: 1 }] }, cook));
  assert.match(self.error, /само в себя/);
  const loop = await json(await api('PUT', '/api/staff/techcards/philadelphia-with-cucumber', { lines: [{ kind: 'dish', ref: 'trio-set-24-pcs', qty: 1 }] }, cook));
  assert.match(loop.error, /замкнутый круг/);
  assert.equal((await api('PUT', '/api/staff/techcards/no-such-dish', { lines: [] }, cook)).status, 404);
  assert.match((await json(await api('PUT', '/api/staff/techcards/california', { lines: [{ kind: 'product', ref: P['Огурцы'], qty: 0 }] }, cook))).error, /количество/);
});

test('сайт получает вес порций из техкарт', async () => {
  const w = await json(await api('GET', '/api/public/weights'));
  assert.deepEqual(w.weights, { 'philadelphia-with-cucumber': 260, california: 250, 'trio-set-24-pcs': 760 });
});

test('заказ на кухне — сырьё списывается по техкартам один раз', async () => {
  const salmon0 = await qtyOf('Лосось охлаждённый');
  const rice0 = await qtyOf('Рис для суши');
  const r = await json(await api('POST', '/api/orders', {
    name: 'Ольга', phone: '+79120001234', method: 'delivery', address: 'ул. Ленина, 1',
    items: [{ id: 'philadelphia-with-cucumber', qty: 2 }, { id: 'trio-set-24-pcs', qty: 1 }]
  }));
  await api('PATCH', `/api/orders/${r.id}`, { status: 'accepted' }, boss);
  assert.equal(await qtyOf('Лосось охлаждённый'), salmon0); // принят — ещё не готовят
  const res = await json(await api('PATCH', `/api/orders/${r.id}`, { status: 'cooking' }, boss));
  // 2 Филадельфии + 1 в сете = 3 × 0,08 кг лосося; рис: 3 × 0,12 + Калифорния 0,12
  assert.equal(await qtyOf('Лосось охлаждённый'), Math.round((salmon0 - 0.24) * 1000) / 1000);
  assert.equal(await qtyOf('Рис для суши'), Math.round((rice0 - 0.48) * 1000) / 1000);
  assert.equal(res.order.stockDeducted, true);
  assert.deepEqual(res.order.stockMissing, ['Тори']);

  await api('PATCH', `/api/orders/${r.id}`, { status: 'done' }, boss);
  assert.equal(await qtyOf('Лосось охлаждённый'), Math.round((salmon0 - 0.24) * 1000) / 1000); // второй раз не списывается

  const sales = await json(await api('GET', '/api/staff/stock/docs?kind=sale', null, boss));
  assert.equal(sales.docs.length, 1);
  assert.match(sales.docs[0].reason, /Заказ № \d+/);
});

test('заказ, отменённый до кухни, сырьё не тратит', async () => {
  const salmon0 = await qtyOf('Лосось охлаждённый');
  const r = await json(await api('POST', '/api/orders', {
    name: 'Пётр', phone: '+79120005678', method: 'pickup', items: [{ id: 'philadelphia-with-cucumber', qty: 3 }]
  }));
  await api('PATCH', `/api/orders/${r.id}`, { status: 'cancelled' }, boss);
  assert.equal(await qtyOf('Лосось охлаждённый'), salmon0);
});
