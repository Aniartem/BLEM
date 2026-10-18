'use strict';
// Фото готового заказа: npm test.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { hashPassword } = require('../auth');
const http = require('node:http');

// поддельный Telegram: запоминаем вызовы и тело запроса
const calls = [];
const fakeTg = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const method = req.url.split('/').pop();
    res.setHeader('content-type', 'application/json');
    if (method === 'getUpdates') return setTimeout(() => res.end('{"ok":true,"result":[]}'), 200);
    calls.push({ method, body: Buffer.concat(chunks).toString('latin1'), type: req.headers['content-type'] });
    res.end(JSON.stringify({ ok: true, result: { message_id: 500 + calls.length } }));
  });
});
const until = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 20)); }
  throw new Error('не дождались');
};
const utf = (s) => Buffer.from(s, 'utf8').toString('latin1');

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
  await new Promise((r) => fakeTg.listen(0, '127.0.0.1', r));
  app = createApp({ port: 0, host: '127.0.0.1', dbFile: ':memory:', publicUrl: '', secureCookies: false, trustProxy: false, timeZone: 'Europe/Samara', photoDir,
    telegram: { token: 'T', chatIds: ['1'], apiBase: `http://127.0.0.1:${fakeTg.address().port}` } }, { log: silent });
  base = `http://127.0.0.1:${(await app.start()).port}`;
  app.db.addUser('anna', 'Анна', hashPassword('anna-pass-1'), 'admin');
  app.db.addUser('chef', 'Игорь', hashPassword('chef-pass-1'), 'cook');
  admin = await login('anna', 'anna-pass-1');
  cook = await login('chef', 'chef-pass-1');
});
after(async () => { await app.stop(); await new Promise((r) => fakeTg.close(r)); });

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

  await until(() => calls.find((c) => c.method === 'sendMessage')); // сообщение о новом заказе
  assert.equal((await api('PATCH', `/api/orders/${id}`, { status: 'delivering' }, admin)).status, 200);
  // кухня отдала — фото ушло в Telegram ответом на сообщение о заказе
  const sent = await until(() => calls.find((c) => c.method === 'sendPhoto'));
  assert.match(sent.type, /multipart\/form-data/);
  assert.ok(sent.body.includes(utf(`Заказ № ${added.order.number} готов к выдаче`)));
  assert.ok(sent.body.includes('Content-Type: image/jpeg'));
  assert.match(sent.body, /"message_id":501/);
  // единственное фото отданного заказа не удалить; второе — можно
  assert.match((await json(await api('DELETE', `/api/staff/orders/${id}/photos/1`, null, admin))).error, /единственное фото/);
  await api('POST', `/api/staff/orders/${id}/photos`, { photo: JPEG }, admin);
  const left = await json(await api('DELETE', `/api/staff/orders/${id}/photos/1`, null, admin));
  assert.deepEqual(left.order.photos.map((p) => p.n), [2]);
  assert.equal((await api('GET', `/api/staff/orders/${id}/photos/1`, null, admin)).status, 404);
});

test('несколько фото уходят в Telegram одним альбомом', async () => {
  const r = await json(await api('POST', '/api/orders', { name: 'Пётр', phone: '+7 912 000-33-44', method: 'delivery', address: 'ул. Ленина, 5', items: [{ id: 'trio-set-24-pcs', qty: 1 }] }));
  for (const s of ['accepted', 'cooking']) await api('PATCH', `/api/orders/${r.id}`, { status: s }, admin);
  await api('POST', `/api/staff/orders/${r.id}/photos`, { photo: JPEG }, admin);
  await api('POST', `/api/staff/orders/${r.id}/photos`, { photo: JPEG }, admin);
  calls.length = 0;
  await api('PATCH', `/api/orders/${r.id}`, { status: 'delivering' }, admin);
  const album = await until(() => calls.find((c) => c.method === 'sendMediaGroup'));
  assert.ok(album.body.includes('attach://p1'));
  assert.ok(album.body.includes(utf('передан курьеру')));
  // дальнейшие статусы фото повторно не шлют
  await api('PATCH', `/api/orders/${r.id}`, { status: 'done' }, admin);
  await new Promise((res) => setTimeout(res, 150));
  assert.equal(calls.filter((c) => /sendPhoto|sendMediaGroup/.test(c.method)).length, 1);
});
