'use strict';
// Пароли — scrypt с солью. Сессия — случайный токен в HttpOnly-cookie, в базе лежит только его хэш.
const crypto = require('node:crypto');

const SESSION_COOKIE = 'rv_session';
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(expected, actual);
}

// Сравнение с «пустышкой», чтобы время ответа не выдавало, существует ли логин
const DUMMY_HASH = hashPassword(crypto.randomBytes(8).toString('hex'));

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i > 0) out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  });
  return out;
}

function createAuth(db, { secureCookies }) {
  function cookie(value, maxAgeSec) {
    return [
      `${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSec}`,
      secureCookies ? 'Secure' : ''
    ].filter(Boolean).join('; ');
  }

  return {
    login(login, password) {
      const user = db.userByLogin(String(login || '').trim().toLowerCase());
      const ok = verifyPassword(password, user ? user.pass_hash : DUMMY_HASH);
      if (!user || !ok) return null;
      const token = crypto.randomBytes(32).toString('base64url');
      db.addSession(sha256(token), user.id, Date.now() + SESSION_DAYS * 864e5);
      return { user: { id: user.id, login: user.login, name: user.name }, setCookie: cookie(token, SESSION_DAYS * 86400) };
    },
    userFrom(req) {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      return token ? db.sessionUser(sha256(token)) || null : null;
    },
    logout(req) {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (token) db.removeSession(sha256(token));
      return cookie('', 0);
    }
  };
}

module.exports = { hashPassword, verifyPassword, createAuth, parseCookies };
