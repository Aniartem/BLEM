'use strict';
// Хранилище: один файл SQLite. Заказ хранится целиком в JSON, ключевые поля — отдельными колонками.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS orders (
      id         TEXT PRIMARY KEY,
      number     INTEGER NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status     TEXT NOT NULL,
      phone      TEXT NOT NULL,
      data       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS orders_phone ON orders(phone);

    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      login      TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      pass_hash  TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tg_messages (
      order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      chat_id    TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      PRIMARY KEY (order_id, chat_id)
    );

    CREATE TABLE IF NOT EXISTS kv (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // роль входа в CRM: admin — всё; cook — только техкарты (без цен и денег)
  if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
  }
  return wrap(db);
}

function wrap(db) {
  const q = {
    nextNumber: db.prepare('SELECT COALESCE(MAX(number), 1000) + 1 AS n FROM orders'),
    insertOrder: db.prepare('INSERT INTO orders (id, number, created_at, updated_at, status, phone, data) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    getOrder: db.prepare('SELECT data FROM orders WHERE id = ?'),
    updateOrder: db.prepare('UPDATE orders SET status = ?, updated_at = ?, data = ? WHERE id = ?'),
    listOrders: db.prepare('SELECT data FROM orders WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?'),
    countRecentByPhone: db.prepare('SELECT COUNT(*) AS n FROM orders WHERE phone = ? AND created_at >= ?'),

    userByLogin: db.prepare('SELECT * FROM users WHERE login = ?'),
    userById: db.prepare('SELECT id, login, name, role FROM users WHERE id = ?'),
    listUsers: db.prepare('SELECT id, login, name, role, created_at FROM users ORDER BY id'),
    insertUser: db.prepare('INSERT INTO users (login, name, pass_hash, created_at, role) VALUES (?, ?, ?, ?, ?)'),
    setPass: db.prepare('UPDATE users SET pass_hash = ? WHERE login = ?'),
    setRole: db.prepare('UPDATE users SET role = ? WHERE login = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE login = ?'),

    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    sessionUser: db.prepare('SELECT u.id, u.login, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE login = ?)'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),

    saveTg: db.prepare('INSERT OR REPLACE INTO tg_messages (order_id, chat_id, message_id) VALUES (?, ?, ?)'),
    tgFor: db.prepare('SELECT chat_id, message_id FROM tg_messages WHERE order_id = ?'),

    kvGet: db.prepare('SELECT value FROM kv WHERE key = ?'),
    kvSet: db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)')
  };

  return {
    raw: db,

    // Номер присваивается внутри транзакции, чтобы два одновременных заказа не получили один номер
    createOrder(order) {
      db.exec('BEGIN IMMEDIATE');
      try {
        order.number = q.nextNumber.get().n;
        q.insertOrder.run(order.id, order.number, order.createdAt, order.createdAt, order.status, order.phoneDigits, JSON.stringify(order));
        db.exec('COMMIT');
        return order;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    getOrder(id) {
      const row = q.getOrder.get(id);
      return row ? JSON.parse(row.data) : null;
    },
    saveOrder(order) {
      order.updatedAt = Date.now();
      q.updateOrder.run(order.status, order.updatedAt, JSON.stringify(order), order.id);
      return order;
    },
    listOrders(sinceMs, limit) {
      return q.listOrders.all(sinceMs, limit).map((r) => JSON.parse(r.data));
    },
    recentOrdersByPhone(phoneDigits, sinceMs) {
      return q.countRecentByPhone.get(phoneDigits, sinceMs).n;
    },

    userByLogin: (login) => q.userByLogin.get(login),
    userById: (id) => q.userById.get(id),
    listUsers: () => q.listUsers.all(),
    addUser: (login, name, hash, role = 'admin') => q.insertUser.run(login, name, hash, Date.now(), role),
    setPassword(login, hash) {
      const r = q.setPass.run(hash, login);
      q.deleteUserSessions.run(login);
      return r.changes > 0;
    },
    removeUser: (login) => q.deleteUser.run(login).changes > 0,
    setRole: (login, role) => q.setRole.run(role, login).changes > 0,

    addSession: (tokenHash, userId, expiresAt) => q.insertSession.run(tokenHash, userId, expiresAt),
    sessionUser: (tokenHash) => q.sessionUser.get(tokenHash, Date.now()),
    removeSession: (tokenHash) => q.deleteSession.run(tokenHash),
    purgeSessions: () => q.purgeSessions.run(Date.now()),

    saveTgMessage: (orderId, chatId, messageId) => q.saveTg.run(orderId, String(chatId), messageId),
    tgMessages: (orderId) => q.tgFor.all(orderId),

    kvGet(key) { const r = q.kvGet.get(key); return r ? r.value : null; },
    kvSet: (key, value) => q.kvSet.run(key, String(value)),

    backup(file) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      db.prepare('VACUUM INTO ?').run(file);
    },
    close: () => db.close()
  };
}

module.exports = { open };
