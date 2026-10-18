'use strict';
// Фото готового заказа: администратор снимает заказ, когда кухня его отдала, и фото прикрепляется
// к заказу. Без фото заказ не уходит из «Готовятся» дальше — ни из CRM, ни кнопкой в Telegram.
// Файлы лежат рядом с фото смен: <photoDir>/orders/2026-10/<id заказа>-<n>.jpg
const fs = require('node:fs');
const path = require('node:path');

const MAX_PHOTO = 3 * 1024 * 1024;
const MAX_PER_ORDER = 6;
const LEAVING_KITCHEN = new Set(['delivering', 'done']);

class PhotoError extends Error { constructor(message, status = 422) { super(message); this.status = status; } }

// data:image/jpeg;base64,… → Buffer; телефон отдаёт JPEG после сжатия в браузере
function decodeJpeg(v) {
  const b64 = String(v || '').replace(/^data:image\/jpeg;base64,/, '');
  if (!b64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return null;
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 500 || buf.length > MAX_PHOTO || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  return buf;
}

function createOrderPhotos({ db, photoDir, broadcast, log = console }) {
  const dir = photoDir && path.join(photoDir, 'orders');

  // заказ уходит из кухни — фото должно быть
  function checkStatus(order, next) {
    if (order.status === 'cooking' && LEAVING_KITCHEN.has(next) && !(order.photos && order.photos.length)) {
      throw new PhotoError('Сначала сфотографируйте готовый заказ в CRM', 409);
    }
  }

  function add(id, dataUrl, by) {
    const order = db.getOrder(id);
    if (!order) throw new PhotoError('Заказ не найден', 404);
    if (order.status === 'cancelled') throw new PhotoError('Заказ отменён');
    const photos = order.photos || [];
    if (photos.length >= MAX_PER_ORDER) throw new PhotoError(`К заказу можно прикрепить не больше ${MAX_PER_ORDER} фото`);
    const buf = decodeJpeg(dataUrl);
    if (!buf) throw new PhotoError('Фото не получилось. Сфотографируйте ещё раз.');
    if (!dir) throw new PhotoError('На сервере не настроено хранение фото', 500);
    const n = photos.reduce((m, p) => Math.max(m, p.n), 0) + 1;
    const month = new Date().toISOString().slice(0, 7);
    const rel = `${month}/${order.id}-${n}.jpg`;
    fs.mkdirSync(path.join(dir, month), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), buf);
    order.photos = [...photos, { n, at: Date.now(), by, file: rel }];
    db.saveOrder(order);
    broadcast(order);
    log.log(`[order] № ${order.number}: фото ${n} (${by})`);
    return order;
  }

  function remove(id, n) {
    const order = db.getOrder(id);
    if (!order) throw new PhotoError('Заказ не найден', 404);
    const photo = (order.photos || []).find((p) => p.n === Number(n));
    if (!photo) throw new PhotoError('Фото нет', 404);
    if (order.photos.length === 1 && LEAVING_KITCHEN.has(order.status)) {
      throw new PhotoError('Это единственное фото заказа, который уже отдан кухней — сначала добавьте другое');
    }
    if (dir) fs.rmSync(path.join(dir, photo.file), { force: true });
    order.photos = order.photos.filter((p) => p !== photo);
    db.saveOrder(order);
    broadcast(order);
    return order;
  }

  function routes({ send, readJson, staff, sameOrigin }) {
    const write = (fn) => async (req, res, url, m) => {
      const user = staff(req, res);
      if (!user) return;
      if (!sameOrigin(req)) return send(res, 403, { error: 'Запрос с чужого сайта' });
      send(res, 200, { order: await fn(req, user, m) }); // ошибки с полем status сервер отдаёт как ответ
    };
    return {
      exact: {},
      pattern: [
        [/^\/api\/staff\/orders\/([\w-]{1,64})\/photos$/, 'POST', write(async (req, user, m) => add(m[1], (await readJson(req, 4.5 * 1024 * 1024)).photo, user.name))],
        [/^\/api\/staff\/orders\/([\w-]{1,64})\/photos\/(\d+)$/, 'DELETE', write(async (req, user, m) => remove(m[1], m[2]))],
        [/^\/api\/staff\/orders\/([\w-]{1,64})\/photos\/(\d+)$/, 'GET', (req, res, url, m) => {
          if (!staff(req, res)) return;
          const order = db.getOrder(m[1]);
          const photo = order && (order.photos || []).find((p) => p.n === Number(m[2]));
          if (!photo || !dir) return send(res, 404, { error: 'Фото нет' });
          fs.readFile(path.join(dir, photo.file), (err, buf) => {
            if (err) return send(res, 404, { error: 'Фото нет' });
            res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': buf.length, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
            res.end(buf);
          });
        }]
      ]
    };
  }

  // фото заказа с диска — для отправки в Telegram
  function files(order) {
    if (!dir) return [];
    return (order.photos || []).map((p) => {
      try { return { buf: fs.readFileSync(path.join(dir, p.file)), by: p.by, at: p.at }; } catch (e) { return null; }
    }).filter(Boolean);
  }

  return { routes, checkStatus, add, remove, files, LEAVING_KITCHEN };
}

module.exports = { createOrderPhotos };
