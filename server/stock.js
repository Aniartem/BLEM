'use strict';
// Склад: справочник сырья и поставщиков, приход по накладным, списания, инвентаризация, остатки,
// автосписание по техкартам при продаже.
// Остаток — сумма движений по сырью; средняя цена — по всем приходам (средневзвешенная).

const UNITS = ['кг', 'л', 'шт', 'уп'];
const CATEGORIES = ['Рыба и морепродукты', 'Мясо и птица', 'Овощи и фрукты', 'Молочное и яйца', 'Бакалея', 'Соусы и специи', 'Напитки', 'Упаковка', 'Хозтовары'];
const WRITEOFF_REASONS = ['Порча', 'Истёк срок', 'Брак поставщика', 'Питание персонала', 'Проработка блюд', 'Другое'];

// Типовой список сырья для доставки роллов — добавляется кнопкой, если справочник пуст
const STARTER = [
  ['Лосось охлаждённый', 'кг', 'Рыба и морепродукты', 3], ['Лосось копчёный', 'кг', 'Рыба и морепродукты', 1],
  ['Тунец', 'кг', 'Рыба и морепродукты', 1], ['Угорь копчёный', 'кг', 'Рыба и морепродукты', 1],
  ['Креветка тигровая', 'кг', 'Рыба и морепродукты', 1.5], ['Масляная рыба', 'кг', 'Рыба и морепродукты', 1],
  ['Снежный краб', 'кг', 'Рыба и морепродукты', 1], ['Икра тобико', 'кг', 'Рыба и морепродукты', 0.5],
  ['Икра лосося', 'кг', 'Рыба и морепродукты', 0.3], ['Мидии', 'кг', 'Рыба и морепродукты', 1],
  ['Курица копчёная', 'кг', 'Мясо и птица', 1], ['Куриное филе', 'кг', 'Мясо и птица', 2], ['Говядина', 'кг', 'Мясо и птица', 1],
  ['Огурцы', 'кг', 'Овощи и фрукты', 2], ['Авокадо', 'кг', 'Овощи и фрукты', 2], ['Пекинская капуста', 'кг', 'Овощи и фрукты', 1],
  ['Перец болгарский', 'кг', 'Овощи и фрукты', 1], ['Зелёный лук', 'кг', 'Овощи и фрукты', 0.3], ['Помидоры черри', 'кг', 'Овощи и фрукты', 0.5],
  ['Сливочный сыр', 'кг', 'Молочное и яйца', 3], ['Яйцо куриное', 'шт', 'Молочное и яйца', 60], ['Сыр пармезан', 'кг', 'Молочное и яйца', 0.3],
  ['Рис для суши', 'кг', 'Бакалея', 20], ['Нори (листы)', 'шт', 'Бакалея', 100], ['Соевая бумага', 'уп', 'Бакалея', 2],
  ['Панко', 'кг', 'Бакалея', 2], ['Мука темпурная', 'кг', 'Бакалея', 2], ['Кунжут', 'кг', 'Бакалея', 0.5],
  ['Лапша удон', 'кг', 'Бакалея', 3], ['Рисовая лапша', 'кг', 'Бакалея', 2], ['Масло фритюрное', 'л', 'Бакалея', 5],
  ['Уксус рисовый', 'л', 'Соусы и специи', 2], ['Соевый соус', 'л', 'Соусы и специи', 5], ['Соус унаги', 'л', 'Соусы и специи', 1],
  ['Соус спайси', 'л', 'Соусы и специи', 1], ['Имбирь маринованный', 'кг', 'Соусы и специи', 2], ['Васаби', 'кг', 'Соусы и специи', 0.5],
  ['Контейнер для роллов', 'шт', 'Упаковка', 200], ['Пакет крафт', 'шт', 'Упаковка', 200], ['Палочки', 'шт', 'Упаковка', 300],
  ['Перчатки нитриловые', 'уп', 'Хозтовары', 2]
];

// ключ для сравнения названий без учёта регистра и «ё» (SQLite NOCASE понимает только латиницу)
const nameKey = (s) => String(s).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const num = (v) => {
  const n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

class StockError extends Error { constructor(message, status = 422) { super(message); this.status = status; } }

function setupSchema(raw) {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS stock_products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      name_key   TEXT NOT NULL UNIQUE,
      unit       TEXT NOT NULL,
      category   TEXT NOT NULL,
      min_qty    REAL NOT NULL DEFAULT 0,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stock_suppliers (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      phone    TEXT NOT NULL DEFAULT ''
    );
    -- документ: приход (накладная), списание или инвентаризация
    CREATE TABLE IF NOT EXISTS stock_docs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kind        TEXT NOT NULL CHECK (kind IN ('receipt', 'writeoff', 'inventory', 'sale')),
      at          INTEGER NOT NULL,
      doc_date    TEXT NOT NULL,
      supplier_id INTEGER REFERENCES stock_suppliers(id),
      number      TEXT NOT NULL DEFAULT '',
      reason      TEXT NOT NULL DEFAULT '',
      note        TEXT NOT NULL DEFAULT '',
      total       REAL NOT NULL DEFAULT 0,
      by_name     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stock_docs_at ON stock_docs(kind, at DESC);
    -- движение: + приход, − списание, ± поправка инвентаризации
    CREATE TABLE IF NOT EXISTS stock_moves (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id     INTEGER NOT NULL REFERENCES stock_docs(id),
      product_id INTEGER NOT NULL REFERENCES stock_products(id),
      qty        REAL NOT NULL,
      price      REAL NOT NULL DEFAULT 0,
      expiry     TEXT,
      system_qty REAL
    );
    CREATE INDEX IF NOT EXISTS stock_moves_product ON stock_moves(product_id);
  `);
}

function createStock({ db, raw = db.raw, tg, timeZone = 'Europe/Samara', log = console }) {
  setupSchema(raw);
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });

  const q = {
    products: raw.prepare(`
      SELECT p.id, p.name, p.unit, p.category, p.min_qty, p.active,
             COALESCE(SUM(m.qty), 0) AS qty,
             COALESCE(SUM(CASE WHEN d.kind = 'receipt' THEN m.qty * m.price END), 0) AS in_sum,
             COALESCE(SUM(CASE WHEN d.kind = 'receipt' THEN m.qty END), 0) AS in_qty,
             MAX(CASE WHEN d.kind = 'receipt' THEN m.price END) AS max_price,
             (SELECT m2.price FROM stock_moves m2 JOIN stock_docs d2 ON d2.id = m2.doc_id
               WHERE m2.product_id = p.id AND d2.kind = 'receipt' ORDER BY d2.at DESC, m2.id DESC LIMIT 1) AS last_price
      FROM stock_products p
      LEFT JOIN stock_moves m ON m.product_id = p.id
      LEFT JOIN stock_docs d ON d.id = m.doc_id
      GROUP BY p.id ORDER BY p.category, p.name`),
    product: raw.prepare('SELECT * FROM stock_products WHERE id = ?'),
    productQty: raw.prepare('SELECT COALESCE(SUM(qty), 0) AS qty FROM stock_moves WHERE product_id = ?'),
    insertProductRaw: raw.prepare('INSERT INTO stock_products (name, name_key, unit, category, min_qty, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    updateProductRaw: raw.prepare('UPDATE stock_products SET name = ?, name_key = ?, unit = ?, category = ?, min_qty = ?, active = ? WHERE id = ?'),
    countProducts: raw.prepare('SELECT COUNT(*) AS n FROM stock_products'),

    suppliers: raw.prepare('SELECT id, name, phone FROM stock_suppliers ORDER BY name'),
    supplierByKey: raw.prepare('SELECT id FROM stock_suppliers WHERE name_key = ?'),
    insertSupplierRaw: raw.prepare('INSERT INTO stock_suppliers (name, name_key, phone) VALUES (?, ?, ?)'),

    insertDoc: raw.prepare('INSERT INTO stock_docs (kind, at, doc_date, supplier_id, number, reason, note, total, by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    insertMove: raw.prepare('INSERT INTO stock_moves (doc_id, product_id, qty, price, expiry, system_qty) VALUES (?, ?, ?, ?, ?, ?)'),
    docs: raw.prepare(`
      SELECT d.*, s.name AS supplier FROM stock_docs d LEFT JOIN stock_suppliers s ON s.id = d.supplier_id
      WHERE d.kind = ? AND d.at >= ? AND d.at < ? ORDER BY d.at DESC LIMIT 300`),
    docLines: raw.prepare(`
      SELECT m.product_id, p.name, p.unit, m.qty, m.price, m.expiry, m.system_qty
      FROM stock_moves m JOIN stock_products p ON p.id = m.product_id WHERE m.doc_id = ? ORDER BY m.id`),
    productMoves: raw.prepare(`
      SELECT d.kind, d.at, d.doc_date, d.number, d.reason, d.by_name, s.name AS supplier, m.qty, m.price, m.expiry
      FROM stock_moves m JOIN stock_docs d ON d.id = m.doc_id LEFT JOIN stock_suppliers s ON s.id = d.supplier_id
      WHERE m.product_id = ? ORDER BY d.at DESC, m.id DESC LIMIT 200`),
    // партии с истекающим сроком из приходов за последние 30 дней
    expiring: raw.prepare(`
      SELECT p.id, p.name, p.unit, m.qty, m.expiry, d.doc_date, s.name AS supplier
      FROM stock_moves m JOIN stock_docs d ON d.id = m.doc_id JOIN stock_products p ON p.id = m.product_id
      LEFT JOIN stock_suppliers s ON s.id = d.supplier_id
      WHERE d.kind = 'receipt' AND m.expiry IS NOT NULL AND m.expiry <= ? AND d.at >= ?
      ORDER BY m.expiry`)
  };

  q.insertProduct = { run: (name, unit, category, min, at) => q.insertProductRaw.run(name, nameKey(name), unit, category, min, at) };
  q.updateProduct = { run: (name, unit, category, min, active, id) => q.updateProductRaw.run(name, nameKey(name), unit, category, min, active, id) };
  q.supplierByName = { get: (name) => q.supplierByKey.get(nameKey(name)) };
  q.insertSupplier = { run: (name, phone) => q.insertSupplierRaw.run(name, nameKey(name), phone) };

  // ---------- Остатки ----------
  function productView(r) {
    const qty = round(r.qty);
    const avg = r.in_qty > 0 ? round(r.in_sum / r.in_qty, 2) : (r.last_price || 0);
    return {
      id: r.id, name: r.name, unit: r.unit, category: r.category, min: r.min_qty, active: !!r.active,
      qty, avgPrice: avg, lastPrice: r.last_price || 0, value: round(Math.max(qty, 0) * avg, 2),
      // none — ещё не поступало: не считаем «заканчивается», чтобы новый справочник не засорял предупреждения
      status: r.in_qty <= 0 && qty <= 0 ? 'none' : qty <= 0 ? 'out' : qty < r.min_qty ? 'low' : 'ok'
    };
  }

  // дата по часовому поясу заведения, а не сервера: 'ГГГГ-ММ-ДД'
  const today = (offsetDays = 0) => dayFmt.format(new Date(Date.now() + offsetDays * 864e5));

  function overview() {
    const products = q.products.all().map(productView);
    const expiring = q.expiring.all(today(2), Date.now() - 30 * 864e5)
      .filter((e) => (products.find((p) => p.id === e.id) || {}).qty > 0)
      .map((e) => ({ productId: e.id, name: e.name, unit: e.unit, qty: e.qty, expiry: e.expiry, received: e.doc_date, supplier: e.supplier || '', expired: e.expiry < today() }));
    return { products, suppliers: q.suppliers.all(), units: UNITS, categories: CATEGORIES, reasons: WRITEOFF_REASONS, expiring, today: today() };
  }

  // ---------- Уведомления «заканчивается» ----------
  function lowStockAlerts(before) {
    if (!tg || !tg.enabled) return;
    const crossed = q.products.all().map(productView).filter((p) => {
      const was = before.get(p.id);
      return p.active && p.min > 0 && p.status !== 'none' && p.qty < p.min && was !== undefined && was >= p.min;
    });
    if (!crossed.length) return;
    const fmt = (p) => `• ${p.name} — ${String(p.qty).replace('.', ',')} ${p.unit} (минимум ${String(p.min).replace('.', ',')} ${p.unit})`;
    tg.broadcastText(`⚠️ <b>Заканчивается на складе</b>\n${crossed.map((p) => escHtml(fmt(p))).join('\n')}`).catch(() => {});
  }
  const snapshotQty = () => new Map(q.products.all().map((r) => [r.id, round(r.qty)]));

  // ---------- Документы ----------
  function withTransaction(fn) {
    raw.exec('BEGIN IMMEDIATE');
    try { const r = fn(); raw.exec('COMMIT'); return r; } catch (e) { raw.exec('ROLLBACK'); throw e; }
  }

  const docDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : today());

  function requireProduct(id) {
    const p = q.product.get(Number(id));
    if (!p) throw new StockError('В документе есть сырьё, которого нет в справочнике. Обновите страницу.');
    return p;
  }

  function createReceipt(body, by) {
    if (!Array.isArray(body.lines) || !body.lines.length) throw new StockError('Добавьте в накладную хотя бы одну позицию');
    if (body.lines.length > 200) throw new StockError('Слишком много позиций');
    const lines = body.lines.map((l, i) => {
      const p = requireProduct(l.productId);
      const qty = num(l.qty), price = num(l.price || 0);
      if (!(qty > 0 && qty < 1e6)) throw new StockError(`Строка ${i + 1}: укажите количество (${p.name})`);
      if (!(price >= 0 && price < 1e7)) throw new StockError(`Строка ${i + 1}: неверная цена (${p.name})`);
      const expiry = /^\d{4}-\d{2}-\d{2}$/.test(String(l.expiry || '')) ? l.expiry : null;
      return { p, qty: round(qty), price: round(price, 2), expiry };
    });
    const name = clean(body.supplier, 80);
    if (!name) throw new StockError('Укажите поставщика');
    return withTransaction(() => {
      let sup = q.supplierByName.get(name);
      if (!sup) sup = { id: Number(q.insertSupplier.run(name, clean(body.supplierPhone, 30)).lastInsertRowid) };
      const total = round(lines.reduce((s, l) => s + l.qty * l.price, 0), 2);
      const id = Number(q.insertDoc.run('receipt', Date.now(), docDate(body.date), sup.id, clean(body.number, 40), '', clean(body.note, 300), total, by).lastInsertRowid);
      lines.forEach((l) => q.insertMove.run(id, l.p.id, l.qty, l.price, l.expiry, null));
      return { id, total };
    });
  }

  function createWriteoff(body, by) {
    if (!Array.isArray(body.lines) || !body.lines.length) throw new StockError('Добавьте хотя бы одну позицию для списания');
    const reason = WRITEOFF_REASONS.includes(body.reason) ? body.reason : null;
    if (!reason) throw new StockError('Выберите причину списания');
    if (reason === 'Другое' && !clean(body.note, 300)) throw new StockError('Для причины «Другое» напишите в комментарии, что случилось');
    const before = snapshotQty();
    const views = new Map(q.products.all().map((r) => [r.id, productView(r)]));
    const lines = body.lines.map((l, i) => {
      const p = requireProduct(l.productId);
      const qty = num(l.qty);
      if (!(qty > 0 && qty < 1e6)) throw new StockError(`Строка ${i + 1}: укажите количество (${p.name})`);
      return { p, qty: round(qty), price: views.get(p.id).avgPrice };
    });
    const res = withTransaction(() => {
      const total = round(lines.reduce((s, l) => s + l.qty * l.price, 0), 2);
      const id = Number(q.insertDoc.run('writeoff', Date.now(), docDate(body.date), null, '', reason, clean(body.note, 300), total, by).lastInsertRowid);
      lines.forEach((l) => q.insertMove.run(id, l.p.id, -l.qty, l.price, null, null));
      return { id, total };
    });
    lowStockAlerts(before);
    return res;
  }

  // Инвентаризация: фактический остаток → поправки на разницу с учётным
  function createInventory(body, by) {
    if (!Array.isArray(body.counts) || !body.counts.length) throw new StockError('Введите фактические остатки хотя бы по одной позиции');
    const before = snapshotQty();
    const all = new Map(q.products.all().map((r) => [r.id, productView(r)]));
    const lines = body.counts.map((c) => {
      const p = requireProduct(c.productId);
      const actual = num(c.actual);
      if (!(actual >= 0 && actual < 1e6)) throw new StockError(`Неверный остаток: ${p.name}`);
      const view = all.get(p.id);
      return { p, actual: round(actual), system: view.qty, diff: round(actual - view.qty), price: view.avgPrice };
    });
    const res = withTransaction(() => {
      const total = round(lines.reduce((s, l) => s + l.diff * l.price, 0), 2);
      const id = Number(q.insertDoc.run('inventory', Date.now(), docDate(body.date), null, '', '', clean(body.note, 300), total, by).lastInsertRowid);
      lines.forEach((l) => q.insertMove.run(id, l.p.id, l.diff, l.price, null, l.system));
      return { id, total, shortage: round(lines.filter((l) => l.diff < 0).reduce((s, l) => s - l.diff * l.price, 0), 2), surplus: round(lines.filter((l) => l.diff > 0).reduce((s, l) => s + l.diff * l.price, 0), 2) };
    });
    lowStockAlerts(before);
    return res;
  }

  // Списание сырья по проданному заказу (по техкартам). lines: [{ productId, qty }] в единицах склада
  function createSale(orderNumber, lines, by) {
    if (!lines.length) return null;
    const before = snapshotQty();
    const views = new Map(q.products.all().map((r) => [r.id, productView(r)]));
    const res = withTransaction(() => {
      const valid = lines.filter((l) => views.has(l.productId) && l.qty > 0);
      const total = round(valid.reduce((s, l) => s + l.qty * views.get(l.productId).avgPrice, 0), 2);
      const id = Number(q.insertDoc.run('sale', Date.now(), today(), null, String(orderNumber), `Заказ № ${orderNumber}`, '', total, by).lastInsertRowid);
      valid.forEach((l) => q.insertMove.run(id, l.productId, -round(l.qty), views.get(l.productId).avgPrice, null, null));
      return { id, total, lines: valid.length };
    });
    lowStockAlerts(before);
    return res;
  }

  // Средняя цена по сырью — для себестоимости техкарт
  const prices = () => new Map(q.products.all().map((r) => { const v = productView(r); return [v.id, v]; }));

  function docsView(kind, from, to) {
    return q.docs.all(kind, from, to).map((d) => ({
      id: d.id, at: d.at, date: d.doc_date, supplier: d.supplier || '', number: d.number, reason: d.reason, note: d.note,
      total: d.total, by: d.by_name,
      lines: q.docLines.all(d.id).map((l) => ({ productId: l.product_id, name: l.name, unit: l.unit, qty: l.qty, price: l.price, expiry: l.expiry, system: l.system_qty }))
    }));
  }

  // ---------- Маршруты ----------
  function routes({ send, readJson, staff, sameOrigin }) {
    const write = (fn) => async (req, res, url, m) => {
      const user = staff(req, res);
      if (!user) return;
      if (!sameOrigin(req)) return send(res, 403, { error: 'Запрос с чужого сайта' });
      try { return await fn(req, res, user, m); } catch (e) {
        if (e instanceof StockError) return send(res, e.status, { error: e.message });
        if (/UNIQUE/.test(e.message)) return send(res, 422, { error: 'Такое название уже есть в справочнике' });
        throw e;
      }
    };
    const product = (body, current = {}) => {
      const name = clean(body.name !== undefined ? body.name : current.name, 80);
      const unit = body.unit !== undefined ? body.unit : current.unit;
      const category = body.category !== undefined ? body.category : current.category;
      const min = body.min !== undefined ? num(body.min || 0) : (current.min_qty || 0);
      if (!name) throw new StockError('Укажите название');
      if (!UNITS.includes(unit)) throw new StockError('Выберите единицу измерения');
      if (!CATEGORIES.includes(category)) throw new StockError('Выберите категорию');
      if (!(min >= 0 && min < 1e6)) throw new StockError('Неверный минимальный остаток');
      return { name, unit, category, min: round(min) };
    };

    return {
      exact: {
        'GET /api/staff/stock': (req, res) => { if (staff(req, res)) send(res, 200, overview()); },
        'POST /api/staff/stock/products': write(async (req, res) => {
          const p = product(await readJson(req, 4096));
          const id = Number(q.insertProduct.run(p.name, p.unit, p.category, p.min, Date.now()).lastInsertRowid);
          send(res, 201, { id });
        }),
        'POST /api/staff/stock/starter': write(async (req, res) => {
          if (q.countProducts.get().n > 0) throw new StockError('Справочник уже заполнен', 409);
          withTransaction(() => STARTER.forEach(([n, u, c, min]) => q.insertProduct.run(n, u, c, min, Date.now())));
          send(res, 201, { added: STARTER.length });
        }),
        'POST /api/staff/stock/receipts': write(async (req, res, user) => send(res, 201, createReceipt(await readJson(req, 128 * 1024), user.name))),
        'POST /api/staff/stock/writeoffs': write(async (req, res, user) => send(res, 201, createWriteoff(await readJson(req, 128 * 1024), user.name))),
        'POST /api/staff/stock/inventory': write(async (req, res, user) => send(res, 201, createInventory(await readJson(req, 256 * 1024), user.name))),
        'GET /api/staff/stock/docs': (req, res, url) => {
          if (!staff(req, res)) return;
          const kind = url.searchParams.get('kind');
          if (!['receipt', 'writeoff', 'inventory', 'sale'].includes(kind)) return send(res, 400, { error: 'Неизвестный вид документа' });
          const from = Number(url.searchParams.get('from')) || Date.now() - 31 * 864e5;
          const to = Number(url.searchParams.get('to')) || Date.now() + 864e5;
          send(res, 200, { docs: docsView(kind, from, to) });
        }
      },
      pattern: [
        [/^\/api\/staff\/stock\/products\/(\d+)$/, 'PATCH', write(async (req, res, user, m) => {
          const cur = q.product.get(Number(m[1]));
          if (!cur) throw new StockError('Нет такого сырья', 404);
          const body = await readJson(req, 4096);
          const p = product(body, cur);
          q.updateProduct.run(p.name, p.unit, p.category, p.min, body.active !== undefined ? (body.active ? 1 : 0) : cur.active, cur.id);
          send(res, 200, { ok: true });
        })],
        [/^\/api\/staff\/stock\/products\/(\d+)\/moves$/, 'GET', (req, res, url, m) => {
          if (!staff(req, res)) return;
          const p = q.product.get(Number(m[1]));
          if (!p) return send(res, 404, { error: 'Нет такого сырья' });
          send(res, 200, {
            product: productView(q.products.all().find((r) => r.id === p.id)),
            moves: q.productMoves.all(p.id).map((r) => ({ kind: r.kind, at: r.at, date: r.doc_date, number: r.number, reason: r.reason, by: r.by_name, supplier: r.supplier || '', qty: r.qty, price: r.price, expiry: r.expiry }))
          });
        }]
      ]
    };
  }

  return { routes, overview, createReceipt, createWriteoff, createInventory, createSale, prices, STARTER };
}

const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

module.exports = { createStock, UNITS, CATEGORIES, WRITEOFF_REASONS };
