'use strict';
// Фото готового заказа: npm test.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { hashPassword } = require('../auth');

let app, base, admin, cook, photoDir;
const silent = { log() {}, error() {} };
const JPEG = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(800, 7), Buffer.from([0xff, 0xd9])]).toString('base64');
const api = (method, p, body, cookie) => fetch(base + p, {
  method,
  headers: { origin: base, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined
});
const json = async (r) => ({ status: r.status, ...(await r.json()) });
const login = async (l, p) => (await api('POST', '/api/login', { login: l, password: p })).headers.get('set-cookie').split(';')[0];

before(async () => {
  photoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-photos-'));
  app = createApp({ port: 0, host: '127.0.0.1', dbFile: ':memory:', publicUrl: '', secureCookies: false, trustProxy: false, timeZone: 'Europe/Samara', photoDir, telegram: { token: '', chatIds: [] } }, { log: silent });
  base = `http://127.0.0.1:${(await app.start()).port}`;
  app.db.addUser('anna', 'Анна', hashPassword('anna-pass-1'), 'admin');
  app.db.addUser('chef', 'Игорь', hashPassword('chef-pass-1'), 'cook');
  admin = await login('anna', 'anna-pass-1');
  cook = await login('chef', 'chef-pass-1');
});
after(() => app.stop());

test('без фото заказ не уходит из «Готовятся», с фото — уходит', async () => {
  const r = await json(await api('POST', '/api/orders', { name: 'Ольга', phone: '+7 912 000-11-22', method: 'pickup', items: [{ id: 'philadelphia-with-cucumber', qty: 2 }] }));
  const id = r.id;
  for (const s of ['accepted', 'cooking']) assert.equal((await api('PATCH', `/api/orders/${id}`, { status: s }, admin)).status, 200);
  const blocked = await json(await api('PATCH', `/api/orders/${id}`, { status: 'delivering' }, admin));
  assert.equal(blocked.status, 409);
  assert.match(blocked.error, /сфотографируйте/);
  // Telegram-кнопка идёт через ту же проверку
  await assert.rejects(app.setStatus(id, 'done', 'Telegram'), /сфотографируйте/);

  // повар не прикрепляет, плохой файл не принимается
  assert.equal((await api('POST', `/api/staff/orders/${id}/photos`, { photo: JPEG }, cook)).status, 403);
  assert.match((await json(await api('POST', `/api/staff/orders/${id}/photos`, { photo: 'data:image/jpeg;base64,AAAA' }, admin))).error, /Фото не получилось/);

  const added = await json(await api('POST', `/api/staff/orders/${id}/photos`, { photo: JPEG }, admin));
  assert.equal(added.status, 200);
  assert.deepEqual(added.order.photos.map((p) => [p.n, p.by]), [[1, 'Анна']]);
  const img = await api('GET', `/api/staff/orders/${id}/photos/1`, null, admin);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.from(await img.arrayBuffer()).length, 806);
  assert.equal((await api('GET', `/api/staff/orders/${id}/photos/1`)).status, 401);

  assert.equal((await api('PATCH', `/api/orders/${id}`, { status: 'delivering' }, admin)).status, 200);
  // единственное фото отданного заказа не удалить; второе — можно
  assert.match((await json(await api('DELETE', `/api/staff/orders/${id}/photos/1`, null, admin))).error, /единственное фото/);
  await api('POST', `/api/staff/orders/${id}/photos`, { photo: JPEG }, admin);
  const left = await json(await api('DELETE', `/api/staff/orders/${id}/photos/1`, null, admin));
  assert.deepEqual(left.order.photos.map((p) => p.n), [2]);
  assert.equal((await api('GET', `/api/staff/orders/${id}/photos/1`, null, admin)).status, 404);
});
