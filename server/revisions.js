'use strict';
// Ревизия: пересчёт продуктов на кухне. Считать может любой сотрудник с входом в CRM
// (повар, администратор, управляющий) — с планшета или телефона, несколько человек сразу.
// Пересчёт «вслепую»: кто считает, не видит учётных остатков и денег — только вписывает факт.
// Управляющий видит расхождения и проводит ревизию: остатки склада поправляются (инвентаризация).

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const num = (v) => {
  const n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
class RevisionError extends Error { constructor(message, status = 422) { super(message); this.status = status; } }

function setupSchema(raw) {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS revisions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      status     TEXT NOT NULL CHECK (status IN ('open', 'done', 'cancelled')),
      started_at INTEGER NOT NULL,
      started_by TEXT NOT NULL,
      closed_at  INTEGER,
      closed_by  TEXT,
      doc_id     INTEGER,
      shortage   REAL,
      surplus    REAL
    );
    CREATE TABLE IF NOT EXISTS revision_counts (
      revision_id INTEGER NOT NULL REFERENCES revisions(id) ON DELETE CASCADE,
      product_id  INTEGER NOT NULL,
      qty         REAL NOT NULL,
      by_name     TEXT NOT NULL,
      at          INTEGER NOT NULL,
      PRIMARY KEY (revision_id, product_id)
    );
  `);
}

function createRevisions({ db, raw = db.raw, stock, tg, log = console }) {
  setupSchema(raw);
  const q = {
    open: raw.prepare("SELECT * FROM revisions WHERE status = 'open' ORDER BY id DESC LIMIT 1"),
    byId: raw.prepare('SELECT * FROM revisions WHERE id = ?'),
    insert: raw.prepare("INSERT INTO revisions (status, started_at, started_by) VALUES ('open', ?, ?)"),
    close: raw.prepare('UPDATE revisions SET status = ?, closed_at = ?, closed_by = ?, doc_id = ?, shortage = ?, surplus = ? WHERE id = ?'),
    counts: raw.prepare('SELECT product_id, qty, by_name, at FROM revision_counts WHERE revision_id = ?'),
    setCount: raw.prepare(`INSERT INTO revision_counts (revision_id, product_id, qty, by_name, at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (revision_id, product_id) DO UPDATE SET qty = excluded.qty, by_name = excluded.by_name, at = excluded.at`),
    clearCount: raw.prepare('DELETE FROM revision_counts WHERE revision_id = ? AND product_id = ?'),
    history: raw.prepare("SELECT * FROM revisions WHERE status != 'open' ORDER BY id DESC LIMIT 20"),
    countStats: raw.prepare('SELECT COUNT(*) AS n, GROUP_CONCAT(DISTINCT by_name) AS who FROM revision_counts WHERE revision_id = ?')
  };

  // Общий вид для всех; учётные остатки, расхождения и деньги — только управляющему
  function state(isManager) {
    const products = stock.overview().products.filter((p) => p.active);
    const cur = q.open.get();
    let current = null;
    if (cur) {
      const counts = {};
      q.counts.all(cur.id).forEach((c) => { counts[c.product_id] = { qty: c.qty, by: c.by_name, at: c.at }; });
      current = { id: cur.id, startedAt: cur.started_at, startedBy: cur.started_by, counts, counted: Object.keys(counts).length };
      if (isManager) {
        let shortage = 0, surplus = 0;
        products.forEach((p) => {
          const c = counts[p.id];
          if (!c) return;
          const money = (c.qty - p.qty) * p.avgPrice;
          if (money < 0) shortage -= money; else surplus += money;
        });
        current.shortage = round(shortage, 2);
        current.surplus = round(surplus, 2);
      }
    }
    const history = q.history.all().map((r) => {
      const st = q.countStats.get(r.id);
      const h = { id: r.id, status: r.status, startedAt: r.started_at, startedBy: r.started_by, closedAt: r.closed_at, closedBy: r.closed_by, positions: st.n, counters: st.who ? st.who.split(',') : [] };
      if (isManager && r.status === 'done') { h.shortage = r.shortage; h.surplus = r.surplus; }
      return h;
    });
    return {
      current,
      history,
      products: products.map((p) => (isManager
        ? { id: p.id, name: p.name, unit: p.unit, category: p.category, qty: p.qty, avgPrice: p.avgPrice }
        : { id: p.id, name: p.name, unit: p.unit, category: p.category })),
      categories: [...new Set(products.map((p) => p.category))]
    };
  }

  function requireOpen(id) {
    const r = q.byId.get(Number(id));
    if (!r) throw new RevisionError('Нет такой ревизии', 404);
    if (r.status !== 'open') throw new RevisionError('Ревизия уже завершена', 409);
    return r;
  }

  function start(by) {
    if (q.open.get()) throw new RevisionError('Ревизия уже идёт — продолжайте её', 409);
    if (!stock.overview().products.some((p) => p.active)) throw new RevisionError('Справочник сырья пуст. Управляющий заполняет его во вкладке «Склад».');
    return Number(q.insert.run(Date.now(), by).lastInsertRowid);
  }

  function setCount(id, productId, value, by) {
    const r = requireOpen(id);
    const p = stock.overview().products.find((x) => x.id === Number(productId) && x.active);
    if (!p) throw new RevisionError('Нет такого сырья', 404);
    if (value === null || value === undefined || String(value).trim() === '') { q.clearCount.run(r.id, p.id); return null; }
    const qty = num(value);
    if (!(qty >= 0 && qty < 1e6)) throw new RevisionError(`Неверное количество: ${p.name}`);
    q.setCount.run(r.id, p.id, round(qty), by, Date.now());
    return round(qty);
  }

  function close(id, by) {
    const r = requireOpen(id);
    const counts = q.counts.all(r.id).map((c) => ({ productId: c.product_id, actual: c.qty }));
    if (!counts.length) throw new RevisionError('Ничего не посчитано — впишите остатки или отмените ревизию');
    const res = stock.createInventory({ note: `Ревизия № ${r.id}`, counts }, by);
    q.close.run('done', Date.now(), by, res.id, res.shortage, res.surplus, r.id);
    if (tg && tg.enabled) {
      const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
      const result = res.shortage || res.surplus
        ? [res.shortage ? `недостача ${rub(res.shortage)}` : '', res.surplus ? `излишек ${rub(res.surplus)}` : ''].filter(Boolean).join(', ')
        : 'всё сошлось';
      tg.broadcastText(`📋 <b>Ревизия № ${r.id} проведена</b>\nПосчитано позиций: ${counts.length}, ${result}`).catch(() => {});
    }
    log.log(`[revision] № ${r.id} проведена: недостача ${res.shortage}, излишек ${res.surplus}`);
    return { id: r.id, positions: counts.length, shortage: res.shortage, surplus: res.surplus };
  }

  function cancel(id, by) {
    const r = requireOpen(id);
    q.close.run('cancelled', Date.now(), by, null, null, null, r.id);
  }

  function routes({ send, readJson, kitchen, manager, sameOrigin }) {
    // запрос, меняющий данные: нужен вход и свой сайт
    const write = (guard, fn) => async (req, res, url, m) => {
      const user = guard(req, res);
      if (!user) return;
      if (!sameOrigin(req)) return send(res, 403, { error: 'Запрос с чужого сайта' });
      await fn(req, res, user, m); // ошибки с полем status сервер отдаёт как понятный ответ
    };
    const isManager = (user) => user.role === 'manager';
    return {
      exact: {
        'GET /api/staff/revision': (req, res) => {
          const user = kitchen(req, res);
          if (user) send(res, 200, state(isManager(user)));
        },
        'POST /api/staff/revisions': write(kitchen, async (req, res, user) => {
          const id = start(user.name);
          send(res, 201, { id, ...state(isManager(user)) });
        })
      },
      pattern: [
        [/^\/api\/staff\/revisions\/(\d+)\/counts\/(\d+)$/, 'PUT', write(kitchen, async (req, res, user, m) => {
          const body = await readJson(req, 1024);
          send(res, 200, { qty: setCount(m[1], m[2], body.qty, user.name) });
        })],
        [/^\/api\/staff\/revisions\/(\d+)\/close$/, 'POST', write(manager, async (req, res, user, m) => send(res, 200, close(m[1], user.name)))],
        [/^\/api\/staff\/revisions\/(\d+)\/cancel$/, 'POST', write(manager, async (req, res, user, m) => { cancel(m[1], user.name); send(res, 200, { ok: true }); })]
      ]
    };
  }

  return { routes, state, start, setCount, close, cancel };
}

module.exports = { createRevisions };
