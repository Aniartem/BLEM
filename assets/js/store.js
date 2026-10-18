/*
 * Хранилище заказов — общее для сайта и CRM.
 *
 * На странице claude.ai заказы лежат в общей базе страницы (capability db):
 * сайт пишет, CRM видит их вживую. При локальном запуске — в localStorage
 * этого браузера (для проверки: сайт и crm.html в одном браузере).
 * Для боевого сайта сюда добавляется третий вариант — свой сервер (REST API).
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

  let ready;
  function backend() {
    if (!ready) {
      ready = (async () => {
        if (window.claude && typeof window.claude.use === 'function') {
          const db = await window.claude.use('db');
          if (db) return dbBackend(db);
        }
        return localBackend();
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
    async update(id, patch) { return (await backend()).update(id, patch); },
    async subscribe(onData, onError) { return (await backend()).subscribe(onData, onError); }
  };
})();
