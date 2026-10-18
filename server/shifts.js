'use strict';
// Смены: табель сотрудников (отметка по ПИН-коду на планшете) и кассовые смены.
// Кассовая смена здесь — учёт денег в CRM. Фискальная смена на онлайн-кассе (54-ФЗ)
// подключается отдельно, под выбранную модель кассы.
const crypto = require('node:crypto');
const { parseCookies } = require('./auth');

const DEVICE_COOKIE = 'rv_device';
const ROLES = ['Повар', 'Сушист', 'Курьер', 'Кассир', 'Оператор', 'Администратор', 'Другое'];
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
      closed_by   TEXT
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
}

function createShifts({ db, raw = db.raw, secureCookies, broadcast, tg, timeZone, log = console }) {
  setupSchema(raw);

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
    endShift: raw.prepare('UPDATE work_shifts SET ended_at = ?, closed_by = ? WHERE id = ? AND ended_at IS NULL'),
    workShift: raw.prepare('SELECT * FROM work_shifts WHERE id = ?'),
    onShift: raw.prepare(`SELECT w.id, w.started_at, e.id AS employee_id, e.name, e.role
                          FROM work_shifts w JOIN employees e ON e.id = w.employee_id
                          WHERE w.ended_at IS NULL ORDER BY w.started_at`),
    shiftsBetween: raw.prepare(`SELECT w.id, w.employee_id, w.started_at, w.ended_at, w.closed_by, e.name, e.role, e.rate
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
    return q.onShift.all().map((r) => ({ shiftId: r.id, employeeId: r.employee_id, name: r.name, role: r.role, startedAt: r.started_at }));
  }

  function notifyTimeclock() { broadcast('timeclock', { onShift: onShiftNow() }); }

  // Отметка по ПИН: нет открытой смены — начинает, есть — заканчивает
  function punch(pin) {
    const emp = q.employeeByPin.get(pinKey(pin));
    if (!emp || !emp.active) return null;
    const open = q.openShiftOf.get(emp.id);
    const now = Date.now();
    let result;
    if (open) {
      q.endShift.run(now, emp.name, open.id);
      result = { action: 'end', name: emp.name, role: emp.role, startedAt: open.started_at, endedAt: now, minutes: Math.round((now - open.started_at) / 60000) };
    } else {
      q.startShift.run(emp.id, now);
      result = { action: 'start', name: emp.name, role: emp.role, startedAt: now };
    }
    notifyTimeclock();
    return result;
  }

  function timesheet(from, to, withPay) {
    const now = Date.now();
    const rows = q.shiftsBetween.all(to, now, from);
    const shifts = rows.map((r) => {
      const start = Math.max(r.started_at, from);
      const end = Math.min(r.ended_at || now, to);
      const minutes = Math.max(0, Math.round((end - start) / 60000));
      return {
        id: r.id, employeeId: r.employee_id, name: r.name, role: r.role,
        startedAt: r.started_at, endedAt: r.ended_at, closedBy: r.closed_by, minutes,
        ...(withPay ? { pay: Math.round((minutes / 60) * r.rate) } : {})
      };
    });
    const byEmployee = new Map();
    for (const s of shifts) {
      const e = byEmployee.get(s.employeeId) || { employeeId: s.employeeId, name: s.name, role: s.role, shifts: 0, minutes: 0, ...(withPay ? { pay: 0 } : {}) };
      e.shifts += 1;
      e.minutes += s.minutes;
      if (withPay) e.pay += s.pay;
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
    const admin = (req, res) => {
      const user = staff(req, res);
      if (!user) return null;
      if (user.role !== 'admin') { send(res, 403, { error: 'Это может сделать только администратор' }); return null; }
      return user;
    };
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
          const body = await readJson(req, 1024);
          const result = validPin(body.pin) ? punch(body.pin) : null;
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
          send(res, 200, { onShift: onShiftNow(), ...timesheet(from, Math.max(to, from), user.role === 'admin') });
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
          const list = q.employees.all().map((e) => ({ id: e.id, name: e.name, role: e.role, active: !!e.active, ...(user.role === 'admin' ? { rate: e.rate } : {}) }));
          send(res, 200, { employees: list, roles: ROLES });
        },
        'POST /api/staff/employees': mutating(async (req, res) => {
          if (!admin(req, res)) return;
          const body = await readJson(req, 2048);
          const name = clean(body.name, 60);
          const role = ROLES.includes(body.role) ? body.role : 'Другое';
          const rate = money(body.rate || 0);
          if (!name) return send(res, 422, { error: 'Укажите имя', field: 'name' });
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

  return { routes, punch, onShiftNow, ROLES, DEVICE_COOKIE };
}

const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

module.exports = { createShifts, ROLES };
