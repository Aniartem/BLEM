'use strict';
// Техкарты: из чего и сколько в каждом блюде меню, выход порции, технология приготовления.
// Строка техкарты — сырьё со склада (в единицах склада: кг, л, шт, уп) или другое блюдо меню
// (для сетов: «Филадельфия — 1 порция»). Когда заказ уходит на кухню, сырьё списывается со склада.

const MAX_DEPTH = 4; // сет → ролл → … глубже не раскрываем (защита от циклов)

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const num = (v) => {
  const n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
class CardError extends Error { constructor(message, status = 422) { super(message); this.status = status; } }

function setupSchema(raw) {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS tech_cards (
      dish_id    TEXT PRIMARY KEY,
      yield_g    REAL NOT NULL DEFAULT 0,
      method     TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL,
      updated_by TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tech_card_lines (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      dish_id TEXT NOT NULL REFERENCES tech_cards(dish_id) ON DELETE CASCADE,
      kind    TEXT NOT NULL CHECK (kind IN ('product', 'dish')),
      ref     TEXT NOT NULL,
      qty     REAL NOT NULL,
      pos     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tech_card_lines_dish ON tech_card_lines(dish_id, pos);
  `);
}

function createTechCards({ db, raw = db.raw, stock, getMenu, log = console }) {
  setupSchema(raw);
  const q = {
    cards: raw.prepare('SELECT * FROM tech_cards'),
    card: raw.prepare('SELECT * FROM tech_cards WHERE dish_id = ?'),
    lines: raw.prepare('SELECT dish_id, kind, ref, qty FROM tech_card_lines ORDER BY dish_id, pos'),
    upsert: raw.prepare(`INSERT INTO tech_cards (dish_id, yield_g, method, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
                         ON CONFLICT(dish_id) DO UPDATE SET yield_g = excluded.yield_g, method = excluded.method,
                         updated_at = excluded.updated_at, updated_by = excluded.updated_by`),
    clearLines: raw.prepare('DELETE FROM tech_card_lines WHERE dish_id = ?'),
    insertLine: raw.prepare('INSERT INTO tech_card_lines (dish_id, kind, ref, qty, pos) VALUES (?, ?, ?, ?, ?)'),
    deleteCard: raw.prepare('DELETE FROM tech_cards WHERE dish_id = ?')
  };

  // Все техкарты разом: Map dishId → { yield, method, lines, updatedAt, updatedBy }
  function loadAll() {
    const map = new Map(q.cards.all().map((c) => [c.dish_id, { yield: c.yield_g, method: c.method, lines: [], updatedAt: c.updated_at, updatedBy: c.updated_by }]));
    for (const l of q.lines.all()) { const c = map.get(l.dish_id); if (c) c.lines.push({ kind: l.kind, ref: l.ref, qty: l.qty }); }
    return map;
  }

  // Раскрывает блюдо до сырья: Map productId → количество. missing — блюда без техкарты
  function expand(cards, dishId, mult, acc, missing, depth = 0) {
    const card = cards.get(dishId);
    if (!card || !card.lines.length) { missing.add(dishId); return; }
    if (depth > MAX_DEPTH) return;
    for (const l of card.lines) {
      if (l.kind === 'product') acc.set(Number(l.ref), (acc.get(Number(l.ref)) || 0) + l.qty * mult);
      else expand(cards, l.ref, l.qty * mult, acc, missing, depth + 1);
    }
  }

  function costOf(cards, prices, dishId) {
    const acc = new Map(), missing = new Set();
    expand(cards, dishId, 1, acc, missing);
    let cost = 0;
    for (const [pid, qty] of acc) cost += qty * ((prices.get(pid) || {}).avgPrice || 0);
    return { cost: round(cost, 2), incomplete: missing.size > 0 }; // в сете есть блюдо без техкарты
  }

  // проверка на цикл: блюдо не может входить само в себя (напрямую или через сет)
  function makesCycle(cards, dishId, lines) {
    const seen = new Set();
    const walk = (id, depth) => {
      if (id === dishId) return true;
      if (depth > MAX_DEPTH + 2 || seen.has(id)) return false;
      seen.add(id);
      const c = cards.get(id);
      return !!c && c.lines.some((l) => l.kind === 'dish' && walk(l.ref, depth + 1));
    };
    return lines.some((l) => l.kind === 'dish' && walk(l.ref, 0));
  }

  function list(withMoney) {
    const { menu } = getMenu();
    const cards = loadAll();
    const prices = stock.prices();
    const dishes = [];
    menu.forEach((cat) => cat.items.forEach((it) => {
      const card = cards.get(it.id) || null;
      const row = { id: it.id, name: it.name, category: cat.title, desc: it.desc, meta: it.meta, card: card && { ...card, lines: card.lines.map((l) => describe(l, prices)) } };
      if (withMoney) {
        row.price = it.price;
        if (card && card.lines.length) {
          const c = costOf(cards, prices, it.id);
          row.cost = c.cost;
          row.foodCost = it.price ? round((c.cost / it.price) * 100, 1) : null;
          row.incomplete = c.incomplete;
        }
      }
      dishes.push(row);
    }));
    const products = [...prices.values()].filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, unit: p.unit, category: p.category, ...(withMoney ? { avgPrice: p.avgPrice } : {}) }));
    return { dishes, products, filled: dishes.filter((d) => d.card && d.card.lines.length).length, total: dishes.length };
  }

  function describe(l, prices) {
    if (l.kind === 'product') {
      const p = prices.get(Number(l.ref));
      return { kind: 'product', ref: Number(l.ref), qty: l.qty, name: p ? p.name : 'Удалённое сырьё', unit: p ? p.unit : '' };
    }
    return { kind: 'dish', ref: l.ref, qty: l.qty };
  }

  function save(dishId, body, by) {
    const { items } = getMenu();
    if (!items.has(dishId)) throw new CardError('Такого блюда нет в меню', 404);
    const prices = stock.prices();
    const yieldG = body.yield === undefined || body.yield === '' ? 0 : num(body.yield);
    if (!(yieldG >= 0 && yieldG < 100000)) throw new CardError('Неверный выход порции');
    if (!Array.isArray(body.lines)) throw new CardError('Нет строк техкарты');
    if (body.lines.length > 60) throw new CardError('Слишком много строк');
    const lines = body.lines.map((l, i) => {
      const qty = num(l.qty);
      if (!(qty > 0 && qty < 100000)) throw new CardError(`Строка ${i + 1}: укажите количество`);
      if (l.kind === 'dish') {
        if (!items.has(String(l.ref))) throw new CardError(`Строка ${i + 1}: блюда нет в меню`);
        if (String(l.ref) === dishId) throw new CardError('Блюдо не может входить само в себя');
        return { kind: 'dish', ref: String(l.ref), qty: round(qty) };
      }
      if (!prices.has(Number(l.ref))) throw new CardError(`Строка ${i + 1}: этого сырья нет на складе`);
      return { kind: 'product', ref: String(Number(l.ref)), qty: round(qty, 4) };
    });
    const cards = loadAll();
    if (makesCycle(cards, dishId, lines)) throw new CardError('Получается замкнутый круг: блюдо входит само в себя через другое блюдо');
    raw.exec('BEGIN IMMEDIATE');
    try {
      q.upsert.run(dishId, round(yieldG, 1), clean(body.method, 4000), Date.now(), by);
      q.clearLines.run(dishId);
      lines.forEach((l, i) => q.insertLine.run(dishId, l.kind, l.ref, l.qty, i));
      raw.exec('COMMIT');
    } catch (e) { raw.exec('ROLLBACK'); throw e; }
    return { ok: true };
  }

  // Вес порций для сайта: { dishId: граммы }
  function weights() {
    const out = {};
    for (const c of q.cards.all()) if (c.yield_g > 0) out[c.dish_id] = Math.round(c.yield_g);
    return out;
  }

  // Списание сырья по заказу. Возвращает список блюд без техкарты
  function consumeOrder(order, by) {
    const cards = loadAll();
    const acc = new Map(), missing = new Set();
    for (const it of order.items || []) expand(cards, it.id, it.qty, acc, missing);
    const lines = [...acc].map(([productId, qty]) => ({ productId, qty }));
    const doc = lines.length ? stock.createSale(order.number, lines, by) : null;
    const { items } = getMenu();
    return { doc, missing: [...missing].map((id) => (items.get(id) || {}).name || id) };
  }

  function routes({ send, readJson, kitchen, sameOrigin }) {
    return {
      exact: {
        'GET /api/staff/techcards': (req, res) => {
          const user = kitchen(req, res);
          if (user) send(res, 200, list(user.role === 'admin'));
        },
        'GET /api/public/weights': (req, res) => send(res, 200, { weights: weights() }, { 'Cache-Control': 'public, max-age=300' })
      },
      pattern: [
        [/^\/api\/staff\/techcards\/([\w-]{1,80})$/, 'PUT', async (req, res, url, m) => {
          const user = kitchen(req, res);
          if (!user) return;
          if (!sameOrigin(req)) return send(res, 403, { error: 'Запрос с чужого сайта' });
          try {
            send(res, 200, save(m[1], await readJson(req, 64 * 1024), user.name));
          } catch (e) {
            if (e instanceof CardError) return send(res, e.status, { error: e.message });
            throw e;
          }
        }]
      ]
    };
  }

  return { routes, list, save, weights, consumeOrder };
}

module.exports = { createTechCards };
