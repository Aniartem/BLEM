'use strict';
// Смены: табель сотрудников (отметка по ПИН-коду и фото на планшете) и кассовые смены.
// Все, кто входит в CRM, — администраторы: им доступны деньги, табель и зарплаты.
// Кассовая смена здесь — учёт денег в CRM. Фискальная смена на онлайн-кассе (54-ФЗ)
// подключается отдельно, под выбранную модель кассы.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { parseCookies } = require('./auth');

const DEVICE_COOKIE = 'rv_device';
const ROLES = ['Повар', 'Кухонный работник', 'Технический персонал', 'Водитель-курьер', 'Администратор'];
const MAX_PHOTO = 1024 * 1024;
const PAYMENT_KIND = { 'Наличными': 'cash', 'Картой курьеру': 'card', 'СБП': 'sbp' };

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const money = (v) => {
  const n = Math.round(Number(String(v).replace(',', '.')) * 100) / 100;
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? n : null;
};
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

function setupSchema(raw) {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      role       TEXT NOT NULL,
      pin_key    TEXT NOT NULL UNIQUE,
      rate       REAL NOT NULL DEFAULT 0,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS work_shifts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      started_at  INTEGER NOT NULL,
      ended_at    INTEGER,
      closed_by   TEXT,
      start_photo TEXT,
      end_photo   TEXT
    );
    CREATE INDEX IF NOT EXISTS work_shifts_started ON work_shifts(started_at);
    CREATE UNIQUE INDEX IF NOT EXISTS work_shifts_one_open ON work_shifts(employee_id) WHERE ended_at IS NULL;

    CREATE TABLE IF NOT EXISTS devices (
      token_hash TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_shifts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      opened_at    INTEGER NOT NULL,
      opened_by    TEXT NOT NULL,
      opening_cash REAL NOT NULL,
      closed_at    INTEGER,
      closed_by    TEXT,
      counted_cash REAL,
      report       TEXT,
      note         TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS cash_one_open ON cash_shifts((closed_at IS NULL)) WHERE closed_at IS NULL;
    CREATE TABLE IF NOT EXISTS cash_moves (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES cash_shifts(id),
      at       INTEGER NOT NULL,
      kind     TEXT NOT NULL CHECK (kind IN ('in', 'out')),
      amount   REAL NOT NULL,
      reason   TEXT NOT NULL,
      by_name  TEXT NOT NULL
    );
  `);
  // миграция для баз, созданных до фото
  const cols = raw.prepare('PRAGMA table_info(work_shifts)').all().map((c) => c.name);
  if (!cols.includes('start_photo')) raw.exec('ALTER TABLE work_shifts ADD COLUMN start_photo TEXT; ALTER TABLE work_shifts ADD COLUMN end_photo TEXT;');
}

// Фото с планшета: data:image/jpeg;base64,… → Buffer. null — фото нет, false — фото испорчено
function decodePhoto(v) {
  if (!v) return null;
  const b64 = String(v).replace(/^data:image\/jpeg;base64,/, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return false;
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 500 || buf.length > MAX_PHOTO || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return false;
  return buf;
}

function createShifts({ db, raw = db.raw, secureCookies, broadcast, tg, timeZone, photoDir, photoDays = 90, log = console }) {
  setupSchema(raw);
  if (photoDir) fs.mkdirSync(photoDir, { recursive: true });

  // ПИН не хранится в открытом виде: HMAC с секретом сервера (секрет создаётся при первом запуске)
  let secret = db.kvGet('pin_secret');
  if (!secret) { secret = crypto.randomBytes(32).toString('hex'); db.kvSet('pin_secret', secret); }
  const pinKey = (pin) => crypto.createHmac('sha256', secret).update(String(pin)).digest('hex');

  const q = {
    employees: raw.prepare('SELECT id, name, role, rate, active, created_at FROM employees ORDER BY active DESC, name'),
    employee: raw.prepare('SELECT id, name, role, rate, active FROM employees WHERE id = ?'),
    employeeByPin: raw.prepare('SELECT id, name, role, active FROM employees WHERE pin_key = ?'),
    insertEmployee: raw.prepare('INSERT INTO employees (name, role, pin_key, rate, created_at) VALUES (?, ?, ?, ?, ?)'),
    updateEmployee: raw.prepare('UPDATE employees SET name = ?, role = ?, rate = ?, active = ? WHERE id = ?'),
    updatePin: raw.prepare('UPDATE employees SET pin_key = ? WHERE id = ?'),

    openShiftOf: raw.prepare('SELECT id, started_at FROM work_shifts WHERE employee_id = ? AND ended_at IS NULL'),
    startShift: raw.prepare('INSERT INTO work_shifts (employee_id, started_at) VALUES (?, ?)'),
    setStartPhoto: raw.prepare('UPDATE work_shifts SET start_photo = ? WHERE id = ?'),
    setEndPhoto: raw.prepare('UPDATE work_shifts SET end_photo = ? WHERE id = ?'),
    oldPhotos: raw.prepare('SELECT id, start_photo, end_photo FROM work_shifts WHERE started_at < ? AND (start_photo IS NOT NULL OR end_photo IS NOT NULL)'),
    clearPhotos: raw.prepare('UPDATE work_shifts SET start_photo = NULL, end_photo = NULL WHERE id = ?'),
    endShift: raw.prepare('UPDATE work_shifts SET ended_at = ?, closed_by = ? WHERE id = ? AND ended_at IS NULL'),
    workShift: raw.prepare('SELECT * FROM work_shifts WHERE id = ?'),
    onShift: raw.prepare(`SELECT w.id, w.started_at, w.start_photo, e.id AS employee_id, e.name, e.role
                          FROM work_shifts w JOIN employees e ON e.id = w.employee_id
                          WHERE w.ended_at IS NULL ORDER BY w.started_at`),
    shiftsBetween: raw.prepare(`SELECT w.id, w.employee_id, w.started_at, w.ended_at, w.closed_by, w.start_photo, w.end_photo, e.name, e.role, e.rate
                                FROM work_shifts w JOIN employees e ON e.id = w.employee_id
                                WHERE w.started_at < ? AND COALESCE(w.ended_at, ?) > ? ORDER BY w.started_at DESC`),

    addDevice: raw.prepare('INSERT INTO devices (token_hash, name, created_at, created_by) VALUES (?, ?, ?, ?)'),
    device: raw.prepare('SELECT name FROM devices WHERE token_hash = ?'),

    openCash: raw.prepare('SELECT * FROM cash_shifts WHERE closed_at IS NULL'),
    insertCash: raw.prepare('INSERT INTO cash_shifts (opened_at, opened_by, opening_cash) VALUES (?, ?, ?)'),
    closeCash: raw.prepare('UPDATE cash_shifts SET closed_at = ?, closed_by = ?, counted_cash = ?, report = ?, note = ? WHERE id = ? AND closed_at IS NULL'),
    cashById: raw.prepare('SELECT * FROM cash_shifts WHERE id = ?'),
    cashHistory: raw.prepare('SELECT * FROM cash_shifts WHERE closed_at IS NOT NULL ORDER BY opened_at DESC LIMIT ?'),
    moves: raw.prepare('SELECT id, at, kind, amount, reason, by_name FROM cash_moves WHERE shift_id = ? ORDER BY at'),
    addMove: raw.prepare('INSERT INTO cash_moves (shift_id, at, kind, amount, reason, by_name) VALUES (?, ?, ?, ?, ?, ?)')
  };

  // ---------- Табель ----------
  function onShiftNow() {
    return q.onShift.all().map((r) => ({ shiftId: r.id, employeeId: r.employee_id, name: r.name, role: r.role, startedAt: r.started_at, startPhoto: !!r.start_photo }));
  }

  function notifyTimeclock() { broadcast('timeclock', { onShift: onShiftNow() }); }

  // Фото хранится файлом: <photoDir>/2026-10/<id смены>-start.jpg
  function savePhoto(shiftId, kind, buf) {
    if (!buf || !photoDir) return null;
    const month = new Date().toISOString().slice(0, 7);
    const rel = `${month}/${shiftId}-${kind}.jpg`;
    try {
      fs.mkdirSync(path.join(photoDir, month), { recursive: true });
      fs.writeFileSync(path.join(photoDir, rel), buf);
      (kind === 'start' ? q.setStartPhoto : q.setEndPhoto).run(rel, shiftId);
      return rel;
    } catch (e) {
      log.error('[photo] не удалось сохранить фото:', e.message);
      return null;
    }
  }

  // Отметка по ПИН: нет открытой смены — начинает, есть — заканчивает
  function punch(pin, photo) {
    const emp = q.employeeByPin.get(pinKey(pin));
    if (!emp || !emp.active) return null;
    const open = q.openShiftOf.get(emp.id);
    const now = Date.now();
    let result;
    if (open) {
      q.endShift.run(now, emp.name, open.id);
      const saved = savePhoto(open.id, 'end', photo);
      result = { action: 'end', name: emp.name, role: emp.role, startedAt: open.started_at, endedAt: now, minutes: Math.round((now - open.started_at) / 60000), photo: !!saved };
    } else {
      const id = Number(q.startShift.run(emp.id, now).lastInsertRowid);
      const saved = savePhoto(id, 'start', photo);
      result = { action: 'start', name: emp.name, role: emp.role, startedAt: now, photo: !!saved };
    }
    notifyTimeclock();
    return result;
  }

  // Старые фото удаляются автоматически (по умолчанию через 90 дней)
  function purgePhotos() {
    if (!photoDir) return;
    for (const r of q.oldPhotos.all(Date.now() - photoDays * 864e5)) {
      for (const rel of [r.start_photo, r.end_photo]) if (rel) fs.rmSync(path.join(photoDir, rel), { force: true });
      q.clearPhotos.run(r.id);
    }
  }
  purgePhotos();
  const purgeTimer = setInterval(purgePhotos, 864e5);
  purgeTimer.unref();

  function timesheet(from, to) {
    const now = Date.now();
    const rows = q.shiftsBetween.all(to, now, from);
    const shifts = rows.map((r) => {
      const start = Math.max(r.started_at, from);
      const end = Math.min(r.ended_at || now, to);
      const minutes = Math.max(0, Math.round((end - start) / 60000));
      return {
        id: r.id, employeeId: r.employee_id, name: r.name, role: r.role,
        startedAt: r.started_at, endedAt: r.ended_at, closedBy: r.closed_by, minutes,
        startPhoto: !!r.start_photo, endPhoto: !!r.end_photo, pay: Math.round((minutes / 60) * r.rate)
      };
    });
    const byEmployee = new Map();
    for (const s of shifts) {
      const e = byEmployee.get(s.employeeId) || { employeeId: s.employeeId, name: s.name, role: s.role, shifts: 0, minutes: 0, pay: 0 };
      e.shifts += 1;
      e.minutes += s.minutes;
      e.pay += s.pay;
      byEmployee.set(s.employeeId, e);
    }
    return { from, to, shifts, employees: [...byEmployee.values()].sort((a, b) => b.minutes - a.minutes) };
  }

  // ---------- Касса ----------
  // Выручка смены — заказы, выполненные за время смены, по способам оплаты
  function cashReport(shift, until) {
    const end = until || Date.now();
    const orders = db.listOrders(shift.opened_at - 7 * 864e5, 5000);
    const totals = { cash: 0, card: 0, sbp: 0, other: 0 };
    const counts = { cash: 0, card: 0, sbp: 0, other: 0 };
    let ordersDone = 0;
    for (const o of orders) {
      if (o.status !== 'done') continue;
      const doneAt = ((o.history || []).filter((h) => h.status === 'done').pop() || {}).at;
      if (!doneAt || doneAt < shift.opened_at || doneAt > end) continue;
      const kind = PAYMENT_KIND[o.payment] || 'other';
      totals[kind] += o.total;
      counts[kind] += 1;
      ordersDone += 1;
    }
    const moves = q.moves.all(shift.id).map((m) => ({ id: m.id, at: m.at, kind: m.kind, amount: m.amount, reason: m.reason, by: m.by_name }));
    const cashIn = moves.filter((m) => m.kind === 'in').reduce((s, m) => s + m.amount, 0);
    const cashOut = moves.filter((m) => m.kind === 'out').reduce((s, m) => s + m.amount, 0);
    const revenue = totals.cash + totals.card + totals.sbp + totals.other;
    return {
      ordersDone, totals, counts, revenue, moves, cashIn, cashOut,
      expectedCash: Math.round((shift.opening_cash + totals.cash + cashIn - cashOut) * 100) / 100
    };
  }

  function cashView(shift) {
    if (!shift) return null;
    const closed = !!shift.closed_at;
    const report = closed ? JSON.parse(shift.report) : cashReport(shift);
    return {
      id: shift.id, openedAt: shift.opened_at, openedBy: shift.opened_by, openingCash: shift.opening_cash,
      closedAt: shift.closed_at, closedBy: shift.closed_by, countedCash: shift.counted_cash, note: shift.note || '',
      difference: closed ? Math.round((shift.counted_cash - report.expectedCash) * 100) / 100 : null,
      ...report
    };
  }

  const rub = (n) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replace(/ /g, ' ') + ' ₽';
  const hhmm = (ms) => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone });

  function tgCash(text) { if (tg && tg.enabled) tg.broadcastText(text).catch(() => {}); }

  // ---------- Маршруты ----------
  function deviceFrom(req) {
    const token = parseCookies(req.headers.cookie)[DEVICE_COOKIE];
    return token ? q.device.get(sha256(token)) || null : null;
  }

  const pinTries = new Map(); // защита от подбора ПИН: 5 ошибок за 5 минут с одного планшета
  function pinAllowed(key) {
    const now = Date.now();
    const list = (pinTries.get(key) || []).filter((t) => now - t < 5 * 60e3);
    pinTries.set(key, list);
    return list.length < 5;
  }
  const pinFailed = (key) => pinTries.get(key).push(Date.now());

  function routes({ send, readJson, staff, sameOrigin }) {
    const admin = staff; // все пользователи CRM — администраторы
    const mutating = (fn) => async (req, res, url, m) => {
      if (!sameOrigin(req)) return send(res, 403, { error: 'Запрос с чужого сайта' });
      return fn(req, res, url, m);
    };
    const validPin = (pin) => /^\d{4,6}$/.test(String(pin || ''));

    return {
      exact: {
        // --- планшет-терминал ---
        'GET /api/timeclock/state': (req, res) => {
          const device = deviceFrom(req);
          if (!device) return send(res, 401, { error: 'Планшет не подключён' });
          send(res, 200, { device: device.name, onShift: onShiftNow(), serverTime: Date.now() });
        },
        'POST /api/timeclock/punch': mutating(async (req, res) => {
          const device = deviceFrom(req);
          if (!device) return send(res, 401, { error: 'Планшет не подключён' });
          const key = parseCookies(req.headers.cookie)[DEVICE_COOKIE];
          if (!pinAllowed(key)) return send(res, 429, { error: 'Слишком много неверных ПИН-кодов. Подождите 5 минут.' });
          const body = await readJson(req, 1.5 * 1024 * 1024);
          const photo = decodePhoto(body.photo);
          if (photo === false) return send(res, 422, { error: 'Фото не получилось. Попробуйте ещё раз.' });
          const result = validPin(body.pin) ? punch(body.pin, photo) : null;
          if (!result) { pinFailed(key); return send(res, 404, { error: 'Неверный ПИН-код' }); }
          send(res, 200, result);
        }),

        // --- CRM: табель ---
        'GET /api/staff/timeclock': (req, res, url) => {
          const user = staff(req, res);
          if (!user) return;
          const now = Date.now();
          const from = Number(url.searchParams.get('from')) || now - 864e5;
          const to = Number(url.searchParams.get('to')) || now;
          send(res, 200, { onShift: onShiftNow(), ...timesheet(from, Math.max(to, from)) });
        },
        'POST /api/staff/devices': mutating(async (req, res) => {
          const user = admin(req, res);
          if (!user) return;
          const body = await readJson(req, 1024);
          const token = crypto.randomBytes(32).toString('base64url');
          q.addDevice.run(sha256(token), clean(body.name, 60) || 'Планшет', Date.now(), user.name);
          send(res, 200, { ok: true }, {
            'Set-Cookie': [`${DEVICE_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${5 * 365 * 86400}`, secureCookies ? 'Secure' : ''].filter(Boolean).join('; ')
          });
        }),

        // --- CRM: сотрудники ---
        'GET /api/staff/employees': (req, res) => {
          const user = staff(req, res);
          if (!user) return;
          const list = q.employees.all().map((e) => ({ id: e.id, name: e.name, role: e.role, active: !!e.active, rate: e.rate }));
          send(res, 200, { employees: list, roles: ROLES });
        },
        'POST /api/staff/employees': mutating(async (req, res) => {
          if (!admin(req, res)) return;
          const body = await readJson(req, 2048);
          const name = clean(body.name, 60);
          const role = body.role;
          const rate = money(body.rate || 0);
          if (!name) return send(res, 422, { error: 'Укажите имя', field: 'name' });
          if (!ROLES.includes(role)) return send(res, 422, { error: 'Выберите должность', field: 'role' });
          if (!validPin(body.pin)) return send(res, 422, { error: 'ПИН-код — от 4 до 6 цифр', field: 'pin' });
          if (rate === null) return send(res, 422, { error: 'Неверная ставка', field: 'rate' });
          try {
            const r = q.insertEmployee.run(name, role, pinKey(body.pin), rate, Date.now());
            send(res, 201, { employee: { id: Number(r.lastInsertRowid), name, role, rate, active: true } });
          } catch (e) {
            if (/UNIQUE/.test(e.message)) return send(res, 422, { error: 'Такой ПИН-код уже у другого сотрудника', field: 'pin' });
            throw e;
          }
        }),

        // --- CRM: касса ---
        'GET /api/staff/cash': (req, res) => {
          if (!staff(req, res)) return;
          send(res, 200, { current: cashView(q.openCash.get()), history: q.cashHistory.all(20).map(cashView) });
        },
        'POST /api/staff/cash/open': mutating(async (req, res) => {
          const user = staff(req, res);
          if (!user) return;
          const body = await readJson(req, 1024);
          const opening = money(body.openingCash);
          if (opening === null) return send(res, 422, { error: 'Укажите сумму наличных в кассе', field: 'openingCash' });
          if (q.openCash.get()) return send(res, 409, { error: 'Кассовая смена уже открыта' });
          const r = q.insertCash.run(Date.now(), user.name, opening);
          const view = cashView(q.cashById.get(r.lastInsertRowid));
          broadcast('cash', { current: view });
          tgCash(`🟢 <b>Касса открыта</b> · ${hhmm(view.openedAt)}\nКассир: ${escHtml(user.name)}\nВ кассе на начало: ${rub(opening)}`);
          send(res, 201, { current: view });
        }),
        'POST /api/staff/cash/move': mutating(async (req, res) => {
          const user = staff(req, res);
          if (!user) return;
          const body = await readJson(req, 1024);
          const shift = q.openCash.get();
          if (!shift) return send(res, 409, { error: 'Сначала откройте кассовую смену' });
          const amount = money(body.amount);
          const reason = clean(body.reason, 120);
          if (!amount) return send(res, 422, { error: 'Укажите сумму', field: 'amount' });
          if (!reason) return send(res, 422, { error: 'Укажите причину', field: 'reason' });
          q.addMove.run(shift.id, Date.now(), body.kind === 'out' ? 'out' : 'in', amount, reason, user.name);
          const view = cashView(q.cashById.get(shift.id));
          broadcast('cash', { current: view });
          send(res, 201, { current: view });
        }),
        'POST /api/staff/cash/close': mutating(async (req, res) => {
          const user = staff(req, res);
          if (!user) return;
          const body = await readJson(req, 2048);
          const shift = q.openCash.get();
          if (!shift) return send(res, 409, { error: 'Кассовая смена не открыта' });
          const counted = money(body.countedCash);
          if (counted === null) return send(res, 422, { error: 'Пересчитайте наличные и укажите сумму', field: 'countedCash' });
          const now = Date.now();
          const report = cashReport(shift, now);
          q.closeCash.run(now, user.name, counted, JSON.stringify(report), clean(body.note, 300), shift.id);
          const view = cashView(q.cashById.get(shift.id));
          broadcast('cash', { current: null, closed: view });
          const diff = view.difference;
          tgCash([
            `🔴 <b>Касса закрыта</b> · ${hhmm(now)}`,
            `Кассир: ${escHtml(user.name)}, смена с ${hhmm(shift.opened_at)}`,
            `Заказов выполнено: ${report.ordersDone}, выручка ${rub(report.revenue)}`,
            `Наличные ${rub(report.totals.cash)} · Карта ${rub(report.totals.card)} · СБП ${rub(report.totals.sbp)}`,
            `Должно быть в кассе: ${rub(report.expectedCash)}, пересчитано: ${rub(counted)}`,
            diff === 0 ? 'Расхождений нет ✅' : diff < 0 ? `⚠️ Недостача ${rub(-diff)}` : `⚠️ Излишек ${rub(diff)}`
          ].join('\n'));
          send(res, 200, { closed: view });
        })
      },

      // маршруты с id в адресе
      pattern: [
        [/^\/api\/staff\/employees\/(\d+)$/, 'PATCH', mutating(async (req, res, url, m) => {
          if (!admin(req, res)) return;
          const emp = q.employee.get(Number(m[1]));
          if (!emp) return send(res, 404, { error: 'Нет такого сотрудника' });
          const body = await readJson(req, 2048);
          const name = body.name !== undefined ? clean(body.name, 60) : emp.name;
          const role = body.role !== undefined ? (ROLES.includes(body.role) ? body.role : emp.role) : emp.role;
          const rate = body.rate !== undefined ? money(body.rate) : emp.rate;
          const active = body.active !== undefined ? (body.active ? 1 : 0) : emp.active;
          if (!name) return send(res, 422, { error: 'Укажите имя', field: 'name' });
          if (rate === null) return send(res, 422, { error: 'Неверная ставка', field: 'rate' });
          if (body.pin !== undefined && body.pin !== '') {
            if (!validPin(body.pin)) return send(res, 422, { error: 'ПИН-код — от 4 до 6 цифр', field: 'pin' });
            try { q.updatePin.run(pinKey(body.pin), emp.id); } catch (e) {
              if (/UNIQUE/.test(e.message)) return send(res, 422, { error: 'Такой ПИН-код уже у другого сотрудника', field: 'pin' });
              throw e;
            }
          }
          q.updateEmployee.run(name, role, rate, active, emp.id);
          if (!active) { const open = q.openShiftOf.get(emp.id); if (open) { q.endShift.run(Date.now(), 'увольнение', open.id); notifyTimeclock(); } }
          send(res, 200, { employee: { id: emp.id, name, role, rate, active: !!active } });
        })],
        [/^\/api\/staff\/photos\/(\d+)\/(start|end)$/, 'GET', (req, res, url, m) => {
          if (!staff(req, res)) return;
          const shift = q.workShift.get(Number(m[1]));
          const rel = shift && (m[2] === 'start' ? shift.start_photo : shift.end_photo);
          if (!rel || !photoDir) return send(res, 404, { error: 'Фото нет' });
          const file = path.join(photoDir, rel);
          fs.readFile(file, (err, buf) => {
            if (err) return send(res, 404, { error: 'Фото нет' });
            res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': buf.length, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
            res.end(buf);
          });
        }],
        [/^\/api\/staff\/work-shifts\/(\d+)\/close$/, 'POST', mutating(async (req, res, url, m) => {
          const user = admin(req, res);
          if (!user) return;
          const shift = q.workShift.get(Number(m[1]));
          if (!shift) return send(res, 404, { error: 'Нет такой смены' });
          if (shift.ended_at) return send(res, 409, { error: 'Смена уже закрыта' });
          q.endShift.run(Date.now(), user.name, shift.id);
          notifyTimeclock();
          send(res, 200, { ok: true });
        })]
      ]
    };
  }

  return { routes, punch, onShiftNow, purgePhotos, ROLES, DEVICE_COOKIE };
}

const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

module.exports = { createShifts, ROLES };
