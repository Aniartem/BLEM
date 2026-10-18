/*
 * Хранилище заказов — общее для сайта и CRM.
 *
 * Три варианта, выбираются сами:
 *  - api   — свой сервер (server/server.js): сайт отправляет заказ, CRM получает
 *            изменения через Server-Sent Events, вход для персонала по паролю;
 *  - db    — страница на claude.ai: общая база страницы (capability db);
 *  - local — файлы открыты без сервера: localStorage этого браузера, для проверки.
 */
window.RollevichStore = (function () {
  const COLLECTION = 'orders';
  const LS_KEY = 'rollevich-orders';

  function dbBackend(db) {
    const col = db.collection(COLLECTION);
    return {
      kind: 'db',
      create: (order) => col.doc(order.id).set(order),
      update: (id, patch) => col.doc(id).update(patch),
      subscribe(onData, onError) {
        return col.orderBy('createdAt', 'desc').limit(1000).onSnapshot(
          (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
          (e) => onError && onError(e)
        );
      }
    };
  }

  function localBackend() {
    const read = () => {
      try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; }
    };
    const write = (list) => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) { throw { code: 'unavailable', message: e.message }; }
    };
    const listeners = new Set();
    const emit = () => {
      const list = read().sort((a, b) => b.createdAt - a.createdAt);
      listeners.forEach((fn) => fn(list));
    };
    window.addEventListener('storage', (e) => { if (e.key === LS_KEY) emit(); });
    return {
      kind: 'local',
      async create(order) { write([order, ...read()]); emit(); },
      async update(id, patch) {
        write(read().map((o) => (o.id === id ? { ...o, ...patch } : o)));
        emit();
      },
      subscribe(onData) {
        listeners.add(onData);
        onData(read().sort((a, b) => b.createdAt - a.createdAt));
        return () => listeners.delete(onData);
      }
    };
  }

  // подписчики служебных событий сервера (касса, смены)
  const eventHandlers = {};

  function apiBackend() {
    async function req(method, url, body) {
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw { code: res.status === 401 ? 'unauthorized' : res.status === 429 ? 'rate_limited' : 'rejected', status: res.status, message: data.error || 'Ошибка сервера' };
      return data;
    }
    return {
      kind: 'api',
      async create(order) {
        const r = await req('POST', '/api/orders', order);
        return { number: r.number, total: r.total };
      },
      async createStaff(order) { return (await req('POST', '/api/staff/orders', order)).order; },
      async setStatus(order, status) { return (await req('PATCH', '/api/orders/' + encodeURIComponent(order.id), { status })).order; },
      async me() {
        try { return (await req('GET', '/api/me')).user; } catch (e) { if (e.code === 'unauthorized') return null; throw e; }
      },
      async login(login, password) { return (await req('POST', '/api/login', { login, password })).user; },
      async logout() { await req('POST', '/api/logout'); },
      request: req,
      subscribe(onData, onError) {
        const map = new Map();
        const emit = () => onData([...map.values()].sort((a, b) => b.createdAt - a.createdAt));
        const load = () => req('GET', '/api/orders').then((r) => {
          map.clear();
          r.orders.forEach((o) => map.set(o.id, o));
          emit();
        }).catch((e) => onError && onError(e));
        load();
        let opened = false;
        const es = new EventSource('/api/events');
        es.addEventListener('order', (e) => {
          const o = JSON.parse(e.data);
          map.set(o.id, o);
          emit();
        });
        ['cash', 'timeclock'].forEach((name) => es.addEventListener(name, (e) => {
          const data = JSON.parse(e.data);
          (eventHandlers[name] || []).forEach((fn) => fn(data));
        }));
        // после обрыва связи догружаем то, что могли пропустить
        es.onopen = () => { if (opened) load(); opened = true; };
        es.onerror = () => {
          req('GET', '/api/me').catch((e) => { if (e.code === 'unauthorized') { es.close(); onError && onError(e); } });
        };
        return () => es.close();
      }
    };
  }

  // История статусов для вариантов без сервера считается в браузере
  function withSetStatus(b) {
    b.setStatus = async (order, status, by) => {
      const history = [...(order.history || []), { status, at: Date.now(), ...(by ? { by } : {}) }];
      await b.update(order.id, { status, history });
    };
    const create = b.create;
    b.create = async (order) => { await create(order); return { number: order.number, total: order.total }; };
    b.createStaff = async (order) => { await create(order); return order; };
    return b;
  }

  async function hasServer() {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      return res.ok && (await res.json()).ok === true;
    } catch (e) { return false; }
  }

  let ready;
  function backend() {
    if (!ready) {
      ready = (async () => {
        if (window.claude && typeof window.claude.use === 'function') {
          const db = await window.claude.use('db');
          if (db) return withSetStatus(dbBackend(db));
        }
        if (await hasServer()) return apiBackend();
        return withSetStatus(localBackend());
      })();
    }
    return ready;
  }

  function newId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // Номер заказа для людей: 4 цифры, по нему клиент называет заказ по телефону
  function newNumber() {
    return String(1000 + Math.floor(Math.random() * 9000));
  }

  return {
    backend,
    newId,
    newNumber,
    async create(order) { return (await backend()).create(order); },
    async createStaff(order) { return (await backend()).createStaff(order); },
    async setStatus(order, status, by) { return (await backend()).setStatus(order, status, by); },
    async me() { const b = await backend(); return b.me ? b.me() : null; },
    async login(login, password) { return (await backend()).login(login, password); },
    async logout() { const b = await backend(); if (b.logout) await b.logout(); },
    async subscribe(onData, onError) { return (await backend()).subscribe(onData, onError); },
    // запросы к своему серверу (касса, смены); на других вариантах недоступны
    async request(method, url, body) {
      const b = await backend();
      if (!b.request) throw { code: 'unavailable', message: 'Нужен сервер РОЛЛЕВИЧ' };
      return b.request(method, url, body);
    },
    on(name, fn) { (eventHandlers[name] = eventHandlers[name] || []).push(fn); }
  };
})();
