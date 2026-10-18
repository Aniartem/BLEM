'use strict';
// Сервер РОЛЛЕВИЧ: сайт, приём заказов, CRM для персонала, уведомления в Telegram.
// Запуск: npm start (Node.js 22.13+, без сторонних пакетов).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { open } = require('./db');
const { loadMenu, priceOrder, OrderError } = require('./pricing');
const { createAuth } = require('./auth');
const { createTelegram, STATUS } = require('./telegram');
const { createShifts } = require('./shifts');
const { createStock } = require('./stock');
const { createRevisions } = require('./revisions');
const { createOrderPhotos } = require('./order-photos');
const { createTechCards } = require('./techcards');

const ROOT = path.resolve(__dirname, '..');

// ---------- Настройки ----------
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function config(env = process.env) {
  const publicUrl = (env.PUBLIC_URL || '').replace(/\/+$/, '');
  const dataDir = env.DATA_DIR || path.join(ROOT, 'data');
  return {
    port: Number(env.PORT || 3000),
    host: env.HOST || '127.0.0.1',
    dbFile: env.DB_FILE || path.join(dataDir, 'rollevich.db'),
    photoDir: env.PHOTO_DIR || path.join(dataDir, 'photos'),
    photoDays: Number(env.PHOTO_RETENTION_DAYS || 90),
    publicUrl,
    secureCookies: publicUrl.startsWith('https://'),
    trustProxy: env.TRUST_PROXY === '1',
    timeZone: env.TZ_NAME || 'Europe/Samara',
    telegram: {
      token: env.TELEGRAM_BOT_TOKEN || '',
      chatIds: (env.TELEGRAM_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
      apiBase: env.TELEGRAM_API_BASE || 'https://api.telegram.org'
    }
  };
}

// ---------- Ограничение частоты запросов ----------
function limiter(max, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, list] of hits) if (!list.some((t) => now - t < windowMs)) hits.delete(k);
  }, windowMs).unref();
  return (key) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) { hits.set(key, list); return false; }
    list.push(now);
    hits.set(key, list);
    return true;
  };
}

// ---------- HTTP-утилиты ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com", "img-src 'self' data: blob:", "media-src 'self' blob:", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"
  ].join('; ')
};

function send(res, status, body, headers = {}) {
  const json = typeof body !== 'string';
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': json ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(json ? JSON.stringify(body) : body);
}

function readJson(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return reject(Object.assign(new Error('Ожидается JSON'), { status: 415 }));
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Слишком большой запрос'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(Object.assign(new Error('Неверный JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

// ---------- Приложение ----------
function createApp(cfg, { log = console } = {}) {
  const db = open(cfg.dbFile);
  const menuFile = path.join(ROOT, 'assets', 'js', 'menu.js');
  let menu = loadMenu(menuFile);
  fs.watchFile(menuFile, { interval: 5000 }, () => {
    try { menu = loadMenu(menuFile); log.log('[menu] меню перечитано'); } catch (e) { log.error('[menu] ошибка в menu.js, оставлено прежнее меню:', e.message); }
  });
  const auth = createAuth(db, cfg);
  const tg = createTelegram({ ...cfg.telegram, crmUrl: cfg.publicUrl ? cfg.publicUrl + '/crm' : '', timeZone: cfg.timeZone, db, log });

  const orderByIp = limiter(5, 10 * 60e3);
  const loginByIp = limiter(10, 15 * 60e3);
  const clients = new Set(); // открытые окна CRM (Server-Sent Events)

  function broadcastEvent(name, data) {
    const msg = `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(msg);
  }
  const broadcast = (order) => broadcastEvent('order', order);
  const stock = createStock({ db, tg, timeZone: cfg.timeZone, log });
  const techcards = createTechCards({ db, stock, getMenu: () => menu, log });
  const revisions = createRevisions({ db, stock, tg, log });
  const orderPhotos = createOrderPhotos({ db, photoDir: cfg.photoDir, broadcast, log });
  const KITCHEN_STATUSES = new Set(['cooking', 'delivering', 'done']);
  const shifts = createShifts({ db, secureCookies: cfg.secureCookies, broadcast: broadcastEvent, tg, timeZone: cfg.timeZone, photoDir: cfg.photoDir, photoDays: cfg.photoDays, log });

  async function setStatus(id, status, by) {
    if (!STATUS[status]) throw Object.assign(new Error('Неизвестный статус'), { status: 400 });
    const order = db.getOrder(id);
    if (!order) return null;
    if (order.status === status) return order;
    orderPhotos.checkStatus(order, status);
    const fromKitchen = order.status === 'cooking' && orderPhotos.LEAVING_KITCHEN.has(status);
    order.status = status;
    order.history = [...(order.history || []), { status, at: Date.now(), by }];
    // заказ ушёл на кухню — списываем сырьё по техкартам (один раз; отмена после этого не возвращает)
    if (KITCHEN_STATUSES.has(status) && !order.stockDeducted) {
      try {
        const r = techcards.consumeOrder(order, by);
        order.stockDeducted = true;
        if (r.missing.length) order.stockMissing = r.missing;
      } catch (e) {
        log.error(`[stock] не удалось списать сырьё по заказу № ${order.number}:`, e.message);
      }
    }
    db.saveOrder(order);
    broadcast(order);
    tg.syncStatus(order).catch(() => {});
    if (fromKitchen) tg.sendOrderPhotos(order, orderPhotos.files(order)).catch(() => {}); // кухня отдала — фото в Telegram
    return order;
  }

  const ip = (req) => (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';

  // Запросы персонала, меняющие данные, принимаются только со своего сайта
  function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try { return new URL(origin).host === req.headers.host; } catch (e) { return false; }
  }

  // Вход администратора или управляющего: заказы, касса, табель
  function staff(req, res) {
    const user = auth.userFrom(req);
    if (!user) { send(res, 401, { error: 'Войдите в CRM' }); return null; }
    if (user.role !== 'admin' && user.role !== 'manager') { send(res, 403, { error: 'Этот раздел доступен только администратору' }); return null; }
    return user;
  }
  // Только управляющий: склад, списания, себестоимость
  function manager(req, res) {
    const user = auth.userFrom(req);
    if (!user) { send(res, 401, { error: 'Войдите в CRM' }); return null; }
    if (user.role !== 'manager') { send(res, 403, { error: 'Склад доступен только управляющему' }); return null; }
    return user;
  }
  // Вход повара или администратора: техкарты
  function kitchen(req, res) {
    const user = auth.userFrom(req);
    if (!user) { send(res, 401, { error: 'Войдите в CRM' }); return null; }
    return user;
  }

  const routes = {
    'GET /api/health': (req, res) => send(res, 200, { ok: true }),

    'POST /api/orders': async (req, res) => {
      const body = await readJson(req);
      if (body.website) return send(res, 201, { id: crypto.randomUUID(), number: 0, total: 0 }); // ловушка для ботов
      if (!orderByIp(ip(req))) return send(res, 429, { error: 'Слишком много заказов подряд. Позвоните нам, и мы всё оформим.' });
      let priced;
      try { priced = priceOrder(body, menu); } catch (e) {
        if (e instanceof OrderError) return send(res, 422, { error: e.message, field: e.field });
        throw e;
      }
      if (db.recentOrdersByPhone(priced.phoneDigits, Date.now() - 3600e3) >= 10) {
        return send(res, 429, { error: 'С этого номера уже много заказов за час. Позвоните нам, и мы всё оформим.' });
      }
      const now = Date.now();
      const order = db.createOrder({ id: crypto.randomUUID(), createdAt: now, status: 'new', history: [{ status: 'new', at: now }], ...priced });
      log.log(`[order] № ${order.number} на ${order.total} ₽`);
      broadcast(order);
      tg.notifyNew(order).catch(() => {});
      send(res, 201, { id: order.id, number: order.number, total: order.total });
    },

    // Заказ, принятый администратором по телефону: без лимита частоты, сразу со статусом и автором
    'POST /api/staff/orders': async (req, res) => {
      const user = staff(req, res);
      if (!user) return;
      if (!sameOrigin(req)) return send(res, 403, { error: 'Запрос с чужого сайта' });
      const body = await readJson(req);
      let priced;
      try { priced = priceOrder(body, menu, { staff: true }); } catch (e) {
        if (e instanceof OrderError) return send(res, 422, { error: e.message, field: e.field });
        throw e;
      }
      const now = Date.now();
      const history = [{ status: 'new', at: now, by: user.name }];
      if (body.accepted) history.push({ status: 'accepted', at: now, by: user.name });
      const order = db.createOrder({
        id: crypto.randomUUID(), createdAt: now, status: body.accepted ? 'accepted' : 'new', history,
        source: 'phone', createdBy: user.name, ...priced
      });
      log.log(`[order] № ${order.number} по телефону (${user.name}) на ${order.total} ₽`);
      broadcast(order);
      tg.notifyNew(order).catch(() => {});
      send(res, 201, { order });
    },

    'POST /api/login': async (req, res) => {
      if (!sameOrigin(req)) return send(res, 403, { error: 'Запрос с чужого сайта' });
      if (!loginByIp(ip(req))) return send(res, 429, { error: 'Слишком много попыток входа. Подождите 15 минут.' });
      const body = await readJson(req, 4096);
      const result = auth.login(body.login, body.password);
      if (!result) return send(res, 401, { error: 'Неверный логин или пароль' });
      send(res, 200, { user: result.user }, { 'Set-Cookie': result.setCookie });
    },

    'POST /api/logout': (req, res) => send(res, 200, { ok: true }, { 'Set-Cookie': auth.logout(req) }),

    'GET /api/me': (req, res) => {
      const user = kitchen(req, res);
      if (user) send(res, 200, { user });
    },

    'GET /api/orders': (req, res, url) => {
      if (!staff(req, res)) return;
      const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 90, 1), 3650);
      send(res, 200, { orders: db.listOrders(Date.now() - days * 864e5, 5000) });
    },

    'GET /api/events': (req, res) => {
      if (!staff(req, res)) return;
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n\n');
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
    }
  };

  const shiftRoutes = shifts.routes({ send, readJson, staff, sameOrigin });
  const stockRoutes = stock.routes({ send, readJson, staff: manager, sameOrigin });
  const techRoutes = techcards.routes({ send, readJson, kitchen, sameOrigin });
  const revisionRoutes = revisions.routes({ send, readJson, kitchen, manager, sameOrigin });
  const photoRoutes = orderPhotos.routes({ send, readJson, staff, sameOrigin });
  Object.assign(routes, shiftRoutes.exact, stockRoutes.exact, techRoutes.exact, revisionRoutes.exact);
  const patternRoutes = [...shiftRoutes.pattern, ...stockRoutes.pattern, ...techRoutes.pattern, ...revisionRoutes.pattern, ...photoRoutes.pattern];

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const key = `${req.method} ${url.pathname}`;
    try {
      if (routes[key]) return await routes[key](req, res, url);

      for (const [re, method, fn] of patternRoutes) {
        const pm = url.pathname.match(re);
        if (pm && req.method === method) return await fn(req, res, url, pm);
      }

      const m = url.pathname.match(/^\/api\/orders\/([\w-]{1,64})$/);
      if (m && req.method === 'PATCH') {
        const user = staff(req, res);
        if (!user) return;
        if (!sameOrigin(req)) return send(res, 403, { error: 'Запрос с чужого сайта' });
        const body = await readJson(req, 4096);
        const order = await setStatus(m[1], String(body.status || ''), user.name);
        return order ? send(res, 200, { order }) : send(res, 404, { error: 'Заказ не найден' });
      }
      if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Нет такого адреса' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
      return serveStatic(url.pathname, req, res);
    } catch (e) {
      if (e.status) return send(res, e.status, { error: e.message });
      log.error('[http]', e);
      if (!res.headersSent) send(res, 500, { error: 'Ошибка сервера. Попробуйте ещё раз.' });
    }
  }

  // Наружу отдаются только файлы сайта: никаких server/, data/, .env
  function serveStatic(pathname, req, res) {
    const pages = { '/': 'index.html', '/index.html': 'index.html', '/crm': 'crm.html', '/crm.html': 'crm.html', '/smena': 'smena.html', '/smena.html': 'smena.html' };
    let rel = pages[pathname];
    if (!rel) {
      if (!pathname.startsWith('/assets/')) return send(res, 404, 'Не найдено');
      try { rel = decodeURIComponent(pathname.slice(1)); } catch (e) { return send(res, 400, 'Неверный адрес'); }
    }
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(path.join(ROOT, 'assets') + path.sep) && !Object.values(pages).includes(rel)) return send(res, 404, 'Не найдено');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'Не найдено');
      const headers = {
        ...SECURITY_HEADERS,
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': rel.endsWith('.html') ? 'no-cache' : 'public, max-age=300'
      };
      if (rel === 'crm.html' || rel === 'smena.html') headers['X-Robots-Tag'] = 'noindex, nofollow';
      res.writeHead(200, headers);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer(handle);
  const purge = setInterval(() => db.purgeSessions(), 3600e3);
  purge.unref();

  return {
    server,
    db,
    tg,
    shifts,
    stock,
    techcards,
    revisions,
    setStatus,
    start() {
      tg.start(setStatus);
      return new Promise((resolve) => server.listen(cfg.port, cfg.host, () => resolve(server.address())));
    },
    async stop() {
      tg.stop();
      fs.unwatchFile(menuFile);
      for (const res of clients) res.end();
      await new Promise((r) => server.close(r));
      db.close();
    }
  };
}

if (require.main === module) {
  loadEnvFile(path.join(ROOT, '.env'));
  const cfg = config();
  const app = createApp(cfg);
  app.start().then((addr) => {
    console.log(`РОЛЛЕВИЧ: http://${addr.address}:${addr.port}  (CRM: /crm)`);
    console.log(app.tg.enabled ? `Telegram: уведомления в ${cfg.telegram.chatIds.length} чат(а)` : 'Telegram: выключен (нет TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_IDS)');
    if (!app.db.listUsers().length) console.log('Нет ни одного сотрудника. Добавьте: npm run user:add -- <логин> "<Имя>"');
  });
  const shutdown = () => app.stop().then(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { createApp, config, loadEnvFile };
