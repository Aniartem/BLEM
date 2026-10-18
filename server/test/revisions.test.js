'use strict';
// Проверки ревизии: npm test.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { hashPassword } = require('../auth');

let app, base, boss, adm, cook, P;
const silent = { log() {}, error() {} };
const api = (method, path, body, cookie) => fetch(base + path, {
  method,
  headers: { origin: base, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined
});
const json = async (r) => ({ status: r.status, ...(await r.json()) });
const login = async (l, p) => (await api('POST', '/api/login', { login: l, password: p })).headers.get('set-cookie').split(';')[0];

before(async () => {
  app = createApp({ port: 0, host: '127.0.0.1', dbFile: ':memory:', publicUrl: '', secureCookies: false, trustProxy: false, timeZone: 'Europe/Samara', telegram: { token: '', chatIds: [] } }, { log: silent });
  base = `http://127.0.0.1:${(await app.start()).port}`;
  app.db.addUser('boss', 'Ирина', hashPassword('boss-pass-1'), 'manager');
  app.db.addUser('anna', 'Анна', hashPassword('anna-pass-1'), 'admin');
  app.db.addUser('chef', 'Игорь', hashPassword('chef-pass-1'), 'cook');
  [boss, adm, cook] = await Promise.all([login('boss', 'boss-pass-1'), login('anna', 'anna-pass-1'), login('chef', 'chef-pass-1')]);
});
after(() => app.stop());

test('ревизия без справочника не начинается, без входа закрыта', async () => {
  assert.equal((await api('GET', '/api/staff/revision')).status, 401);
  const r = await json(await api('POST', '/api/staff/revisions', null, cook));
  assert.equal(r.status, 422);
  assert.match(r.error, /Справочник сырья пуст/);
});

test('считают все вслепую, проводит управляющий', async () => {
  await api('POST', '/api/staff/stock/starter', null, boss);
  P = Object.fromEntries((await json(await api('GET', '/api/staff/stock', null, boss))).products.map((p) => [p.name, p.id]));
  await api('POST', '/api/staff/stock/receipts', { supplier: 'РыбТорг', lines: [
    { productId: P['Лосось охлаждённый'], qty: 5, price: 1600 }, { productId: P['Рис для суши'], qty: 20, price: 200 }] }, boss);

  // повар начинает, повтор — 409
  const started = await json(await api('POST', '/api/staff/revisions', null, cook));
  assert.equal(started.status, 201);
  assert.equal(started.current.startedBy, 'Игорь');
  assert.equal((await api('POST', '/api/staff/revisions', null, adm)).status, 409);
  const id = started.id;

  // повар не видит учёт и деньги
  const seen = await json(await api('GET', '/api/staff/revision', null, cook));
  const salmon = seen.products.find((p) => p.id === P['Лосось охлаждённый']);
  assert.equal(salmon.qty, undefined);
  assert.equal(salmon.avgPrice, undefined);
  assert.equal(seen.current.shortage, undefined);

  // считают двое
  assert.equal((await json(await api('PUT', `/api/staff/revisions/${id}/counts/${P['Лосось охлаждённый']}`, { qty: '4,5' }, cook))).qty, 4.5);
  await api('PUT', `/api/staff/revisions/${id}/counts/${P['Рис для суши']}`, { qty: 21 }, adm);
  await api('PUT', `/api/staff/revisions/${id}/counts/${P['Огурцы']}`, { qty: 1 }, adm);
  await api('PUT', `/api/staff/revisions/${id}/counts/${P['Огурцы']}`, { qty: '' }, adm); // передумали — очищено
  assert.match((await json(await api('PUT', `/api/staff/revisions/${id}/counts/${P['Рис для суши']}`, { qty: -1 }, cook))).error, /Неверное количество/);
  assert.equal((await api('PUT', `/api/staff/revisions/${id}/counts/99999`, { qty: 1 }, cook)).status, 404);

  const mgr = await json(await api('GET', '/api/staff/revision', null, boss));
  assert.equal(mgr.current.counted, 2);
  assert.equal(mgr.current.counts[P['Рис для суши']].by, 'Анна');
  assert.equal(mgr.current.shortage, 0.5 * 1600);
  assert.equal(mgr.current.surplus, 1 * 200);

  // провести может только управляющий
  assert.equal((await api('POST', `/api/staff/revisions/${id}/close`, null, cook)).status, 403);
  assert.equal((await api('POST', `/api/staff/revisions/${id}/close`, null, adm)).status, 403);
  const done = await json(await api('POST', `/api/staff/revisions/${id}/close`, null, boss));
  assert.deepEqual([done.status, done.positions, done.shortage, done.surplus], [200, 2, 800, 200]);

  const s = await json(await api('GET', '/api/staff/stock', null, boss));
  assert.equal(s.products.find((p) => p.id === P['Лосось охлаждённый']).qty, 4.5);
  assert.equal(s.products.find((p) => p.id === P['Рис для суши']).qty, 21);
  const inv = await json(await api('GET', '/api/staff/stock/docs?kind=inventory', null, boss));
  assert.equal(inv.docs[0].note, `Ревизия № ${id}`);

  // история: всем видно, кто считал; деньги — только управляющему
  const h = (await json(await api('GET', '/api/staff/revision', null, cook))).history[0];
  assert.deepEqual([h.status, h.positions, h.closedBy, h.counters.sort()], ['done', 2, 'Ирина', ['Анна', 'Игорь']]);
  assert.equal(h.shortage, undefined);
  assert.equal((await json(await api('GET', '/api/staff/revision', null, boss))).history[0].shortage, 800);
  assert.equal((await api('PUT', `/api/staff/revisions/${id}/counts/${P['Рис для суши']}`, { qty: 1 }, cook)).status, 409);
});

test('пустую ревизию провести нельзя, отменить — можно', async () => {
  const { id } = await json(await api('POST', '/api/staff/revisions', null, adm));
  assert.match((await json(await api('POST', `/api/staff/revisions/${id}/close`, null, boss))).error, /Ничего не посчитано/);
  assert.equal((await api('POST', `/api/staff/revisions/${id}/cancel`, null, adm)).status, 403);
  assert.equal((await api('POST', `/api/staff/revisions/${id}/cancel`, null, boss)).status, 200);
  const st = await json(await api('GET', '/api/staff/revision', null, cook));
  assert.equal(st.current, null);
  assert.equal(st.history[0].status, 'cancelled');
});
