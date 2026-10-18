/*
 * Демо РОЛЛЕВИЧ: настоящий сервер CRM (server/*.js) работает прямо в браузере.
 * База — SQLite в браузере (sql.js), данные хранятся только у того, кто открыл демо.
 * Запросы сайта и CRM к /api/… перехватываются и уходят в этот сервер, а не в сеть.
 * Собирается командой: node tools/build_demo.js <папка> (см. README).
 * Внешне грузится только sql.js с cdnjs.
 */
(function () {
  'use strict';
  window.ROLLEVICH_DEMO = true;
  const SQLJS = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
  const MODULES = window.ROLLEVICH_SERVER_MODULES || {};
  const STORE_KEY = 'state';
  const COOKIE_KEY = 'rollevich-demo-cookies';
  const LOGINS = [['boss', 'Управляющий'], ['anna', 'Администратор'], ['chef', 'Повар']];
  const PASSWORD = 'demo';

  // ---------------------------------------------------------------- Buffer
  const te = new TextEncoder(), td = new TextDecoder();
  class Buf extends Uint8Array {
    static from(v, enc) {
      if (typeof v === 'string') {
        if (enc === 'base64' || enc === 'base64url') {
          let s = v.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
          while (s.length % 4) s += '=';
          const bin = atob(s);
          const out = new Buf(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          return out;
        }
        if (enc === 'hex') {
          const out = new Buf(v.length >> 1);
          for (let i = 0; i < out.length; i++) out[i] = parseInt(v.substr(i * 2, 2), 16);
          return out;
        }
        return Buf.wrap(te.encode(v));
      }
      if (v instanceof ArrayBuffer) return new Buf(v.slice(0));
      return Buf.wrap(Uint8Array.from(v));
    }
    static wrap(u8) { return new Buf(u8.buffer, u8.byteOffset, u8.byteLength); }
    static alloc(n) { return new Buf(n); }
    static isBuffer(x) { return x instanceof Buf; }
    static byteLength(s) { return te.encode(String(s)).length; }
    static concat(list) {
      const out = new Buf(list.reduce((s, b) => s + b.length, 0));
      let off = 0;
      list.forEach((b) => { out.set(b, off); off += b.length; });
      return out;
    }
    toString(enc) {
      if (enc === 'base64' || enc === 'base64url') {
        let bin = '';
        for (let i = 0; i < this.length; i += 0x8000) bin += String.fromCharCode.apply(null, this.subarray(i, i + 0x8000));
        const b64 = btoa(bin);
        return enc === 'base64' ? b64 : b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
      if (enc === 'hex') return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('');
      return td.decode(this);
    }
  }
  const bytes = (d) => (typeof d === 'string' ? te.encode(d) : d instanceof Uint8Array ? d : Buf.from(d));

  // ---------------------------------------------------------------- SHA-256, HMAC
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(msg) {
    const len = msg.length, total = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total);
    m.set(msg);
    m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 4, len * 8);
    dv.setUint32(total - 8, Math.floor(len / 0x20000000));
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    const rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
    }
    const out = new Buf(32);
    const ov = new DataView(out.buffer);
    h.forEach((x, i) => ov.setUint32(i * 4, x));
    return out;
  }
  function hmac(key, msg) {
    let k = bytes(key);
    if (k.length > 64) k = sha256(k);
    const ipad = new Uint8Array(64 + msg.length), opad = new Uint8Array(64 + 32);
    for (let i = 0; i < 64; i++) { ipad[i] = (k[i] || 0) ^ 0x36; opad[i] = (k[i] || 0) ^ 0x5c; }
    ipad.set(msg, 64);
    opad.set(sha256(ipad), 64);
    return sha256(opad);
  }
  const hasher = (finish) => {
    const parts = [];
    return {
      update(d) { parts.push(bytes(d)); return this; },
      digest(enc) { const r = finish(Buf.concat(parts)); return enc ? r.toString(enc) : r; }
    };
  };

  // ---------------------------------------------------------------- модули Node.js для сервера
  const nodeCrypto = {
    randomUUID: () => (crypto.randomUUID ? crypto.randomUUID() : nodeCrypto.randomBytes(16).toString('hex')),
    randomBytes(n) { const b = new Buf(n); crypto.getRandomValues(b); return b; },
    createHash: () => hasher(sha256),
    createHmac: (alg, key) => hasher((msg) => hmac(key, msg)),
    // в демо пароль не нужно защищать от перебора: быстрый вывод ключа вместо scrypt
    scryptSync(password, salt, keylen) {
      const out = new Buf(keylen);
      let block = Buf.concat([bytes(salt), bytes(String(password))]);
      for (let off = 0; off < keylen; off += 32) { block = sha256(block); out.set(block.subarray(0, Math.min(32, keylen - off)), off); }
      return out;
    },
    timingSafeEqual: (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
  };

  const files = new Map(); // «диск» сервера: фото сотрудников
  const norm = (p) => {
    const out = [];
    String(p).split('/').forEach((s) => { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); });
    return '/' + out.join('/');
  };
  const enoent = (p) => Object.assign(new Error('ENOENT: ' + p), { code: 'ENOENT' });
  const fsShim = {
    existsSync: (p) => files.has(norm(p)),
    readFileSync(p, enc) {
      const b = files.get(norm(p));
      if (!b) throw enoent(p);
      return enc ? b.toString(enc === 'utf8' || enc === 'utf-8' ? undefined : enc) : b;
    },
    writeFileSync(p, data) { files.set(norm(p), typeof data === 'string' ? Buf.from(data) : Buf.wrap(data)); },
    readFile(p, a, b) {
      const cb = typeof a === 'function' ? a : b;
      setTimeout(() => { try { cb(null, fsShim.readFileSync(p)); } catch (e) { cb(e); } });
    },
    rmSync(p) { files.delete(norm(p)); },
    unlinkSync(p) { files.delete(norm(p)); },
    mkdirSync() {},
    watchFile() {},
    unwatchFile() {},
    stat(p, cb) { setTimeout(() => cb(enoent(p))); }
  };
  const pathShim = {
    sep: '/',
    join: (...a) => norm(a.filter(Boolean).join('/')),
    resolve: (...a) => norm(a.reduce((r, s) => (String(s).startsWith('/') ? s : r + '/' + s), '/')),
    dirname: (p) => norm(p).replace(/\/[^/]*$/, '') || '/',
    basename: (p) => String(p).split('/').pop(),
    extname: (p) => (String(p).match(/\.[^./]*$/) || [''])[0]
  };
  // меню сервер читает из того же menu.js, что уже загружен на странице
  const vmShim = {
    runInNewContext(code, sandbox) {
      sandbox.window.ROLLEVICH_MENU = window.ROLLEVICH_MENU;
      sandbox.window.ROLLEVICH_CONFIG = window.ROLLEVICH_CONFIG;
    }
  };
  let handler = null;
  const httpShim = {
    createServer(fn) {
      handler = fn;
      return {
        listen(port, host, cb) { const done = [port, host, cb].find((x) => typeof x === 'function'); if (done) setTimeout(done); return this; },
        address: () => ({ port: 0, address: 'demo' }),
        close(cb) { if (cb) setTimeout(cb); },
        closeAllConnections() {},
        on() { return this; }
      };
    }
  };
  const processShim = { env: {}, on() {}, exit() {}, platform: 'browser', versions: { node: '22' } };
  // таймеры Node.js: у них есть unref(), в браузере — нет
  const nodeTimer = (make, clear) => [
    (fn, ms, ...args) => { const id = make(fn, ms, ...args); return { id, unref() { return this; }, ref() { return this; }, hasRef: () => false }; },
    (t) => clear(t && typeof t === 'object' ? t.id : t)
  ];
  const [nodeSetTimeout, nodeClearTimeout] = nodeTimer(setTimeout.bind(window), clearTimeout.bind(window));
  const [nodeSetInterval, nodeClearInterval] = nodeTimer(setInterval.bind(window), clearInterval.bind(window));

  // node:sqlite поверх sql.js: тот же интерфейс prepare().all/get/run
  let SQL = null, savedDb = null, liveDb = null;
  class DatabaseSync {
    constructor() {
      this.db = savedDb ? new SQL.Database(savedDb) : new SQL.Database();
      savedDb = null;
      liveDb = this;
    }
    exec(sql) { this.db.exec(sql); }
    prepare(sql) {
      const self = this;
      const call = (params, fn) => {
        const st = self.db.prepare(sql);
        try {
          if (params.length) st.bind(params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v)));
          return fn(st);
        } finally { st.free(); }
      };
      return {
        all: (...p) => call(p, (st) => { const rows = []; while (st.step()) rows.push(st.getAsObject()); return rows; }),
        get: (...p) => call(p, (st) => (st.step() ? st.getAsObject() : undefined)),
        run: (...p) => {
          call(p, (st) => st.step());
          const changes = self.db.getRowsModified();
          const r = self.db.exec('SELECT last_insert_rowid()');
          return { changes, lastInsertRowid: r.length ? r[0].values[0][0] : 0 };
        }
      };
    }
    close() {}
  }

  function makeRequire() {
    const builtins = {
      'node:http': httpShim, 'node:fs': fsShim, 'node:path': pathShim, 'node:crypto': nodeCrypto,
      'node:vm': vmShim, 'node:sqlite': { DatabaseSync }, 'node:readline': {}
    };
    const cache = {};
    function req(name) {
      if (builtins[name]) return builtins[name];
      const key = name.replace(/^\.\//, '').replace(/\.js$/, '');
      if (cache[key]) return cache[key].exports;
      if (!MODULES[key]) throw new Error('Демо: нет модуля ' + name);
      const module = { exports: {} };
      cache[key] = module;
      MODULES[key](req, module, module.exports, '/app/server', `/app/server/${key}.js`, Buf, processShim, nodeSetTimeout, nodeSetInterval, nodeClearTimeout, nodeClearInterval);
      return module.exports;
    }
    req.main = null;
    return req;
  }

  // ---------------------------------------------------------------- хранение в браузере
  const idb = () => new Promise((resolve, reject) => {
    const r = indexedDB.open('rollevich-demo', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  // хранилище может быть запрещено или не отвечать — тогда не ждём дольше 3 секунд
  const within = (p, ms, fallback) => Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);
  async function idbGet(key) {
    try {
      const d = await within(idb(), 3000, null);
      if (!d) return null;
      return await new Promise((resolve) => { const r = d.transaction('kv').objectStore('kv').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); });
    } catch (e) { return null; }
  }
  async function idbSet(key, value) {
    try {
      const d = await within(idb(), 3000, null);
      if (!d) return;
      await new Promise((resolve) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(value, key); t.oncomplete = resolve; t.onerror = resolve; });
    } catch (e) { /* без хранилища демо работает до перезагрузки страницы */ }
  }
  const snapshot = () => ({ db: liveDb.db.export(), files: [...files].map(([p, b]) => [p, new Uint8Array(b)]) });
  // каждое изменение сохраняется до ответа: можно сразу перезагрузить страницу или перейти на другую
  let saving = Promise.resolve();
  function persist() {
    saving = saving.then(async () => {
      if (!liveDb) return;
      await idbSet(STORE_KEY, snapshot());
      if (channel) channel.postMessage({ type: 'changed' });
    });
    return saving;
  }

  // другие вкладки демо подхватывают изменения: CRM перечитывает заказы, как после переподключения
  let channel = null;
  try { channel = new BroadcastChannel('rollevich-demo'); } catch (e) { /* без связи вкладок: каждая страница сама по себе */ }
  if (channel) {
    channel.onmessage = async (e) => {
      if (!e.data || e.data.type !== 'changed' || !liveDb) return;
      const s = await idbGet(STORE_KEY);
      if (!s) return;
      liveDb.db = new SQL.Database(s.db);
      files.clear();
      s.files.forEach(([p, b]) => files.set(p, Buf.wrap(b)));
      sources.forEach((src) => { if (src.onopen) src.onopen(new Event('open')); });
    };
  }

  // ---------------------------------------------------------------- cookie и запросы
  const readJar = () => { try { return JSON.parse(localStorage.getItem(COOKIE_KEY) || '{}'); } catch (e) { return {}; } };
  const writeJar = (j) => { try { localStorage.setItem(COOKIE_KEY, JSON.stringify(j)); } catch (e) { /* только в памяти */ } };
  let memJar = readJar();
  const userJar = {
    get: () => memJar,
    set(j) { memJar = j; writeJar(j); }
  };

  function dispatch(method, path, headers, body, sse, jar = userJar) {
    return new Promise((resolve) => {
      const h = {};
      if (headers) (headers instanceof Headers ? [...headers] : Object.entries(headers)).forEach(([k, v]) => { h[k.toLowerCase()] = String(v); });
      h.host = location.host;
      if (method !== 'GET') h.origin = location.origin;
      const cookies = Object.entries(jar.get()).map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookies) h.cookie = cookies;
      const listeners = {};
      let ended = false;
      const req = {
        method, url: path, headers: h, socket: { remoteAddress: '127.0.0.1' },
        on(ev, fn) {
          (listeners[ev] = listeners[ev] || []).push(fn);
          if (ev === 'end' && !ended) {
            ended = true;
            queueMicrotask(() => {
              if (body != null) (listeners.data || []).forEach((f) => f(Buf.from(String(body))));
              (listeners.end || []).forEach((f) => f());
            });
          }
          return req;
        },
        destroy() {},
        closeStream() { (listeners.close || []).forEach((f) => f()); }
      };
      let status = 200, done = false;
      const rh = {}, chunks = [];
      const takeCookies = () => {
        const sc = rh['set-cookie'];
        if (!sc) return;
        const j = { ...jar.get() };
        (Array.isArray(sc) ? sc : [sc]).forEach((line) => {
          const [pair, ...attrs] = String(line).split(';');
          const i = pair.indexOf('=');
          const name = pair.slice(0, i).trim(), value = pair.slice(i + 1).trim();
          if (!value || attrs.some((a) => /^\s*max-age=0\s*$/i.test(a))) delete j[name]; else j[name] = value;
        });
        jar.set(j);
        delete rh['set-cookie'];
      };
      const finish = () => {
        if (done) return;
        done = true;
        takeCookies();
        const hdrs = new Headers();
        Object.entries(rh).forEach(([k, v]) => { if (k !== 'content-length') hdrs.set(k, String(v)); });
        const response = new Response(status === 204 || status === 304 ? null : Buf.concat(chunks), { status, headers: hdrs });
        if (method !== 'GET') persist().then(() => resolve(response)); else resolve(response);
        if (sse) sse.fail();
      };
      const res = {
        statusCode: 200,
        headersSent: false,
        setHeader(k, v) { rh[k.toLowerCase()] = v; },
        getHeader: (k) => rh[k.toLowerCase()],
        removeHeader(k) { delete rh[k.toLowerCase()]; },
        writeHead(s, hh) {
          status = s; res.statusCode = s; res.headersSent = true;
          if (hh) Object.entries(hh).forEach(([k, v]) => { rh[k.toLowerCase()] = v; });
          takeCookies();
          if (sse && /event-stream/.test(rh['content-type'] || '')) sse.open(req);
          return res;
        },
        write(c) {
          if (sse && sse.isOpen) { sse.feed(String(c)); return true; }
          chunks.push(typeof c === 'string' ? Buf.from(c) : c);
          return true;
        },
        end(c) {
          if (c != null) res.write(c);
          if (sse && sse.isOpen) return;
          finish();
        },
        on() { return res; },
        once() { return res; },
        flushHeaders() {}
      };
      Promise.resolve()
        .then(() => handler(req, res))
        .catch((e) => {
          console.error('[демо]', e);
          if (!done) { status = 500; chunks.push(Buf.from(JSON.stringify({ error: 'Ошибка демо-сервера' }))); finish(); }
        });
    });
  }

  const apiPath = (url) => {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin) return null;
      const i = u.pathname.indexOf('/api/');
      return i >= 0 ? u.pathname.slice(i) + u.search : null;
    } catch (e) { return null; }
  };

  // ---------------------------------------------------------------- запуск сервера
  function loadScript(src) {
    return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); });
  }
  // версия sql.js на чистом JavaScript: грузится одним скриптом с CDN, без WebAssembly и без запросов к сети
  async function loadSql() {
    if (!window.initSqlJs) await loadScript(SQLJS + 'sql-asm.js');
    return window.initSqlJs();
  }

  let app = null, need = null;
  const ready = (async () => {
    SQL = await loadSql();
    const saved = await idbGet(STORE_KEY);
    if (saved) {
      savedDb = saved.db;
      saved.files.forEach(([p, b]) => files.set(p, Buf.wrap(b)));
    }
    files.set('/app/assets/js/menu.js', Buf.from('// меню берётся со страницы'));
    need = makeRequire();
    const { createApp, config } = need('./server');
    const cfg = config({ DB_FILE: '/data/rollevich.db', PHOTO_DIR: '/data/photos', TZ_NAME: 'Europe/Samara', PHOTO_RETENTION_DAYS: '90' });
    cfg.port = 0;
    cfg.secureCookies = false;
    cfg.telegram = { token: '', chatIds: [] };
    app = createApp(cfg, { log: { log() {}, error: (...a) => console.warn('[демо]', ...a) } });
    await app.start();
    if (!saved) { await seed(); await idbSet(STORE_KEY, snapshot()); }
  })();
  ready.catch((e) => console.error('[демо] сервер не запустился', e));

  // ---------------------------------------------------------------- перехват fetch и EventSource
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const path = apiPath(url);
    if (!path) return realFetch(input, init);
    await ready;
    return dispatch((init.method || (input.method) || 'GET').toUpperCase(), path, init.headers, init.body);
  };

  const sources = new Set();
  class DemoEventSource {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.listeners = {};
      this.onopen = this.onmessage = this.onerror = null;
      this.buffer = '';
      sources.add(this);
      const self = this;
      this.sse = {
        isOpen: false,
        open(req) { this.isOpen = true; self.req = req; self.readyState = 1; if (self.onopen) self.onopen(new Event('open')); },
        feed: (text) => self.feed(text),
        fail() { self.readyState = 2; sources.delete(self); if (self.onerror) self.onerror(new Event('error')); }
      };
      ready.then(() => dispatch('GET', apiPath(url), { accept: 'text/event-stream' }, null, this.sse));
    }
    feed(text) {
      this.buffer += text;
      let i;
      while ((i = this.buffer.indexOf('\n\n')) >= 0) {
        const block = this.buffer.slice(0, i);
        this.buffer = this.buffer.slice(i + 2);
        let name = 'message';
        const data = [];
        block.split('\n').forEach((line) => {
          if (line.startsWith('event:')) name = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        });
        if (!data.length) continue;
        const ev = new MessageEvent(name, { data: data.join('\n') });
        (this.listeners[name] || []).forEach((fn) => fn(ev));
        if (name === 'message' && this.onmessage) this.onmessage(ev);
      }
    }
    addEventListener(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); }
    removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] || []).filter((f) => f !== fn); }
    close() { this.readyState = 2; sources.delete(this); if (this.req) this.req.closeStream(); }
  }
  window.EventSource = DemoEventSource;

  // фото сотрудников в CRM подгружаются из демо-сервера
  const photoUrls = new Map();
  function fixImages(rootEl) {
    rootEl.querySelectorAll('img[src*="/api/"]').forEach(async (img) => {
      const src = img.getAttribute('src');
      if (!apiPath(src)) return;
      img.removeAttribute('src');
      if (!photoUrls.has(src)) photoUrls.set(src, window.fetch(src).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? URL.createObjectURL(b) : '')));
      const u = await photoUrls.get(src);
      if (u) img.src = u;
    });
  }
  new MutationObserver(() => fixImages(document)).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

  // ---------------------------------------------------------------- демо-данные
  async function seed() {
    const { hashPassword } = need('./auth');
    app.db.addUser('boss', 'Ирина Соколова', hashPassword(PASSWORD), 'manager');
    app.db.addUser('anna', 'Анна Петрова', hashPassword(PASSWORD), 'admin');
    app.db.addUser('chef', 'Шеф Игорь', hashPassword(PASSWORD), 'cook');
    const client = (jarObj = {}) => {
      const jar = { get: () => jarObj, set(j) { Object.keys(jarObj).forEach((k) => delete jarObj[k]); Object.assign(jarObj, j); } };
      return async (method, path, body) => {
        const r = await dispatch(method, path, body ? { 'content-type': 'application/json' } : {}, body ? JSON.stringify(body) : null, null, jar);
        return r.json().catch(() => ({}));
      };
    };
    const boss = client(), anna = client(), chef = client();
    await boss('POST', '/api/login', { login: 'boss', password: PASSWORD });
    await anna('POST', '/api/login', { login: 'anna', password: PASSWORD });
    await chef('POST', '/api/login', { login: 'chef', password: PASSWORD });

    // склад
    await boss('POST', '/api/staff/stock/starter');
    const P = Object.fromEntries((await boss('GET', '/api/staff/stock')).products.map((p) => [p.name, p.id]));
    const day = (o) => new Date(Date.now() + o * 864e5).toISOString().slice(0, 10);
    await boss('POST', '/api/staff/stock/receipts', { supplier: 'РыбТорг Ижевск', number: 'УТ-1042', lines: [
      { productId: P['Лосось охлаждённый'], qty: 8, price: 1600, expiry: day(1) }, { productId: P['Тунец'], qty: 3, price: 2100, expiry: day(4) },
      { productId: P['Снежный краб'], qty: 4, price: 900 }, { productId: P['Креветка тигровая'], qty: 3, price: 1250 }, { productId: P['Угорь копчёный'], qty: 2, price: 2600 }] });
    await boss('POST', '/api/staff/stock/receipts', { supplier: 'Удмуртские овощи', number: '318', lines: [
      { productId: P['Огурцы'], qty: 6, price: 150, expiry: day(-1) }, { productId: P['Авокадо'], qty: 5, price: 450 }, { productId: P['Зелёный лук'], qty: 1, price: 300 }] });
    await boss('POST', '/api/staff/stock/receipts', { supplier: 'Восток-Импорт', lines: [
      { productId: P['Рис для суши'], qty: 30, price: 180 }, { productId: P['Нори (листы)'], qty: 400, price: 6 }, { productId: P['Сливочный сыр'], qty: 8, price: 820 },
      { productId: P['Соевый соус'], qty: 10, price: 240 }, { productId: P['Имбирь маринованный'], qty: 4, price: 380 }, { productId: P['Васаби'], qty: 1.5, price: 900 },
      { productId: P['Контейнер для роллов'], qty: 300, price: 9 }, { productId: P['Палочки'], qty: 500, price: 2 }] });
    await boss('POST', '/api/staff/stock/writeoffs', { reason: 'Питание персонала', note: 'Обед смены', lines: [{ productId: P['Рис для суши'], qty: 1 }, { productId: P['Лосось охлаждённый'], qty: 0.2 }] });
    await boss('POST', '/api/staff/stock/writeoffs', { reason: 'Порча', note: 'Помялись при доставке', lines: [{ productId: P['Авокадо'], qty: 0.6 }] });

    // техкарты популярных роллов — их сырьё списывается, когда заказ уходит на кухню
    const card = (lines, y, method) => ({ yield: y, method, lines: lines.map(([n, q]) => ({ kind: 'product', ref: P[n], qty: q })) });
    await chef('PUT', '/api/staff/techcards/philadelphia-with-cucumber', card([['Рис для суши', 0.12], ['Нори (листы)', 0.5], ['Лосось охлаждённый', 0.08], ['Сливочный сыр', 0.05], ['Огурцы', 0.03]], 260, 'Рис на нори, сыр и огурец, накрыть лососем, нарезать на 8 частей.'));
    await chef('PUT', '/api/staff/techcards/philadelphia-with-avocado', card([['Рис для суши', 0.12], ['Нори (листы)', 0.5], ['Лосось охлаждённый', 0.08], ['Сливочный сыр', 0.05], ['Авокадо', 0.03]], 260, 'Как Филадельфия, вместо огурца — авокадо.'));
    await chef('PUT', '/api/staff/techcards/sushi-with-salmon', card([['Рис для суши', 0.02], ['Лосось охлаждённый', 0.012]], 32, 'Рисовый брусок, ломтик лосося.'));

    // сотрудники и планшет для отметок
    const emps = [['Шеф Игорь', 'Повар', '1111', 350], ['Мария Ким', 'Кухонный работник', '2222', 250], ['Ольга Белова', 'Технический персонал', '3333', 200], ['Дмитрий Орлов', 'Водитель-курьер', '4444', 220], ['Анна Петрова', 'Администратор', '5555', 300]];
    for (const [name, role, pin, rate] of emps) await anna('POST', '/api/staff/employees', { name, role, pin, rate });
    let tabletJar = {};
    const tablet = client(tabletJar);
    await tablet('POST', '/api/login', { login: 'anna', password: PASSWORD });
    await tablet('POST', '/api/staff/devices', { name: 'Планшет на кухне' });
    for (const pin of ['1111', '2222', '5555']) await tablet('POST', '/api/timeclock/punch', { pin });
    // браузер того, кто смотрит демо, сразу подключён как планшет — страница отметок работает без настройки
    const dev = await dispatch('POST', '/api/staff/devices', { 'content-type': 'application/json' }, JSON.stringify({ name: 'Демо-планшет' }), null, {
      get: () => ({ rv_session: tabletJar.rv_session }),
      set: (j) => { if (j.rv_device) userJar.set({ ...userJar.get(), rv_device: j.rv_device }); }
    });
    await dev.text();

    // касса
    await anna('POST', '/api/staff/cash/open', { openingCash: 5000 });

    // заказы: с сайта и по телефону, в разных статусах
    const site = client();
    const order = (name, phone, items, extra = {}) => ({ name, phone, method: 'delivery', address: extra.address || 'ул. Пушкинская, 154, кв. 12', persons: 2, payment: 'Картой курьеру', items: items.map(([id, qty]) => ({ id, qty })), ...extra });
    const placed = [];
    placed.push(await site('POST', '/api/orders', order('Екатерина', '+7 (912) 445-10-20', [['philadelphia-with-cucumber', 2], ['spring-with-salmon', 1]])));
    placed.push(await site('POST', '/api/orders', order('Алексей', '+7 (950) 160-33-41', [['sushi-set-10-pcs', 1], ['shrimps-tempura', 1]], { address: 'ул. Карла Маркса, 246, подъезд 3' })));
    placed.push(await site('POST', '/api/orders', order('Светлана', '+7 (922) 507-88-12', [['poke-with-salmon', 1], ['philadelphia-with-avocado', 1]], { method: 'pickup' })));
    const phoneOrder = (o) => anna('POST', '/api/staff/orders', { ...o, accepted: true });
    const p1 = await phoneOrder(order('Екатерина', '+7 (912) 445-10-20', [['philadelphia-with-avocado', 1], ['sushi-with-salmon', 4]]));
    const p2 = await phoneOrder(order('Михаил', '+7 (904) 834-22-90', [['maki-set-24-pcs', 1], ['ramen-with-chicken', 2]], { address: 'ул. Ленина, 21' }));
    const p3 = await phoneOrder(order('Екатерина', '+7 (912) 445-10-20', [['philadelphia-with-cucumber', 1]]));
    const ids = (await anna('GET', '/api/orders')).orders.reduce((m, o) => { m[o.number] = o.id; return m; }, {});
    const to = async (num, statuses) => { for (const s of statuses) await anna('PATCH', `/api/orders/${ids[num]}`, { status: s }); };
    const n = (r) => (r && (r.number || (r.order && r.order.number)));
    await to(n(placed[1]), ['accepted']);
    await to(n(p1), ['cooking', 'delivering', 'done']);
    await to(n(p2), ['cooking']);
    await to(n(p3), ['cooking', 'delivering']);

    // прошлая ревизия
    const rev = await chef('POST', '/api/staff/revisions');
    if (rev && rev.id) {
      await chef('PUT', `/api/staff/revisions/${rev.id}/counts/${P['Рис для суши']}`, { qty: 28.5 });
      await anna('PUT', `/api/staff/revisions/${rev.id}/counts/${P['Нори (листы)']}`, { qty: 396 });
      await chef('PUT', `/api/staff/revisions/${rev.id}/counts/${P['Соевый соус']}`, { qty: 10 });
      await boss('POST', `/api/staff/revisions/${rev.id}/close`);
    }
  }

  // ---------------------------------------------------------------- панель «Демо»
  async function loginAs(login) {
    await ready;
    // на экране входа CRM — через обычную форму: без перезагрузки, работает даже без хранилища браузера
    const form = document.querySelector('[data-login]');
    if (form) {
      form.querySelector('#crm-login').value = login;
      form.querySelector('#crm-password').value = PASSWORD;
      form.requestSubmit();
      return;
    }
    const r = await dispatch('POST', '/api/login', { 'content-type': 'application/json' }, JSON.stringify({ login, password: PASSWORD }));
    if (!r.ok) return;
    if (/crm\.html$/.test(location.pathname)) location.reload(); else location.href = 'crm.html';
  }
  async function reset(btn) {
    // подтверждение — второе нажатие (окна confirm() в просмотрщике не показываются)
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = 'Нажмите ещё раз — все изменения удалятся';
      setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Сбросить демо к исходным данным'; }, 4000);
      return;
    }
    try { indexedDB.deleteDatabase('rollevich-demo'); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(COOKIE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  }

  function panel() {
    const css = `
      .rv-demo { position: fixed; left: max(16px, env(safe-area-inset-left, 0px)); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 2147483000; font: 500 14px/1.4 -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif; color: #1d1d1f; }
      .rv-demo, .rv-demo * { box-sizing: border-box; }
      .rv-demo__tab[hidden] { display: none; }
      .rv-demo--right { left: auto; right: max(16px, env(safe-area-inset-right, 0px)); }
      .rv-demo--right .rv-demo__card { left: auto; right: 0; }
      @media (max-width: 700px) { .rv-demo:not(.rv-demo--right) { bottom: calc(84px + env(safe-area-inset-bottom, 0px)); } }
      .rv-demo__tab { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: #c9a45c; color: #17130c; cursor: pointer; font: inherit; font-size: 15px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.15) inset; }
      .rv-demo__tab:hover { filter: brightness(1.06); }
      .rv-demo__tab i { width: 8px; height: 8px; border-radius: 50%; background: #17130c; opacity: .35; }
      .rv-demo__tab i.is-ok { background: #1f8a3c; opacity: 1; }
      .rv-demo__status { display: flex; align-items: center; gap: 8px; margin: -4px 0 12px; font-size: 13px; color: #6e6e73; }
      .rv-demo__status i { width: 8px; height: 8px; border-radius: 50%; background: #ff9f0a; flex: none; }
      .rv-demo__status.is-ok i { background: #34c759; }
      .rv-demo__status.is-bad { color: #d70015; }
      .rv-demo__status.is-bad i { background: #ff3b30; }
      .rv-demo__card { position: absolute; left: 0; bottom: 0; width: min(310px, calc(100vw - 32px)); max-height: calc(100vh - 40px); overflow-y: auto; padding: 18px; border-radius: 18px; background: rgba(255,255,255,.97); box-shadow: 0 24px 64px rgba(0,0,0,.22), 0 0 0 .5px rgba(0,0,0,.08); backdrop-filter: blur(20px); }
      .rv-demo__card[hidden] { display: none; }
      .rv-demo__card h3 { margin: 0 0 4px; font-size: 17px; font-weight: 600; }
      .rv-demo__card p { margin: 0 0 12px; color: #6e6e73; font-size: 13px; font-weight: 400; }
      .rv-demo__card b { display: block; margin: 12px 0 6px; font-size: 12px; color: #6e6e73; font-weight: 600; }
      .rv-demo__links, .rv-demo__logins { display: grid; gap: 6px; }
      .rv-demo__links a, .rv-demo__logins button { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 9px 12px; border: 0; border-radius: 10px; background: rgba(118,118,128,.12); color: #1d1d1f; text-decoration: none; font: inherit; cursor: pointer; text-align: left; }
      .rv-demo__links a:hover, .rv-demo__logins button:hover { background: rgba(118,118,128,.2); }
      .rv-demo__logins small { color: #6e6e73; font-weight: 400; }
      .rv-demo__reset { margin-top: 12px; padding: 0; border: 0; background: none; color: #d70015; font: inherit; font-size: 13px; cursor: pointer; }
      .rv-demo__x { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border: 0; border-radius: 50%; background: rgba(118,118,128,.12); color: #6e6e73; cursor: pointer; font-size: 16px; }`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.className = 'rv-demo';
    el.innerHTML = `
      <button type="button" class="rv-demo__tab" data-demo-toggle aria-expanded="false"><i data-demo-dot></i>Демо · войти в CRM</button>
      <div class="rv-demo__card" hidden>
        <button type="button" class="rv-demo__x" data-demo-toggle aria-label="Скрыть">×</button>
        <h3>Демо РОЛЛЕВИЧ</h3>
        <p class="rv-demo__status" data-demo-status><i></i><span>Запускаем демо-сервер…</span></p>
        <p>Всё работает по-настоящему, но данные хранятся только в вашем браузере — у каждого своя копия.</p>
        <b>Страницы</b>
        <div class="rv-demo__links">
          <a href="index.html">Сайт доставки <span>→</span></a>
          <a href="crm.html">CRM <span>→</span></a>
          <a href="smena.html">Планшет для отметок <span>→</span></a>
        </div>
        <b>Войти в CRM как</b>
        <div class="rv-demo__logins">${LOGINS.map(([l, t]) => `<button type="button" data-demo-login="${l}">${t} <small>${l} / ${PASSWORD}</small></button>`).join('')}</div>
        <b>ПИН-коды на планшете</b>
        <p>1111 — повар, 2222 — кухонный работник, 3333 — уборка, 4444 — курьер, 5555 — администратор</p>
        <button type="button" class="rv-demo__reset" data-demo-reset>Сбросить демо к исходным данным</button>
      </div>`;
    const crmRoot = document.getElementById('crm');
    if (crmRoot) el.classList.add('rv-demo--right'); // в CRM слева внизу — карточка сотрудника
    (crmRoot || document.body).appendChild(el); // CRM скрывает всё, что вне #crm
    const status = el.querySelector('[data-demo-status]');
    ready.then(() => {
      status.className = 'rv-demo__status is-ok';
      status.querySelector('span').textContent = 'Демо-сервер работает';
      el.querySelector('[data-demo-dot]').classList.add('is-ok');
    }, (e) => {
      status.className = 'rv-demo__status is-bad';
      status.querySelector('span').textContent = 'Демо-сервер не запустился: ' + ((e && e.message) || 'ошибка');
    });
    const card = el.querySelector('.rv-demo__card');
    const toggle = (open) => { card.hidden = !open; el.querySelector('.rv-demo__tab').hidden = open; };
    el.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.hasAttribute('data-demo-toggle')) toggle(card.hidden);
      if (t.dataset.demoLogin) { loginAs(t.dataset.demoLogin); toggle(false); }
      if (t.hasAttribute('data-demo-reset')) reset(t);
    });
    // на экране входа в CRM сразу показываем, под кем можно войти
    const watch = () => { if (document.querySelector('.crm.is-login') && !el.dataset.shown) { el.dataset.shown = '1'; toggle(true); } };
    new MutationObserver(watch).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    watch();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel); else panel();
})();
