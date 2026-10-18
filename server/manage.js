'use strict';
// Управление CRM из командной строки:
//   node server/manage.js add-user <логин> "<Имя>"   — добавить администратора CRM (пароль спросит).
//        Администраторы видят всё: заказы, кассу, табель, зарплаты. Повара, курьеры и другие
//        сотрудники входа в CRM не имеют — они отмечаются ПИН-кодом на планшете.
//   node server/manage.js passwd <логин>              — сменить пароль (выходит из всех сессий)
//   node server/manage.js remove-user <логин>         — удалить сотрудника
//   node server/manage.js users                       — список сотрудников
//   node server/manage.js backup [файл]               — резервная копия базы
// Пароль можно передать без вопроса через переменную CRM_PASSWORD.
const path = require('node:path');
const readline = require('node:readline');
const { open } = require('./db');
const { hashPassword } = require('./auth');
const { config, loadEnvFile } = require('./server');

loadEnvFile(path.resolve(__dirname, '..', '.env'));
const cfg = config();

function askPassword(question) {
  if (process.env.CRM_PASSWORD) return Promise.resolve(process.env.CRM_PASSWORD);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

async function newPassword() {
  const p1 = await askPassword('Пароль (от 8 символов): ');
  if (p1.length < 8) throw new Error('Пароль короче 8 символов');
  if (!process.env.CRM_PASSWORD) {
    const p2 = await askPassword('Повторите пароль: ');
    if (p1 !== p2) throw new Error('Пароли не совпадают');
  }
  return hashPassword(p1);
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  const db = open(cfg.dbFile);
  try {
    if (cmd === 'add-user') {
      const login = String(a || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(login)) throw new Error('Логин: 3–32 латинские буквы, цифры, точка, дефис');
      if (db.userByLogin(login)) throw new Error(`Сотрудник ${login} уже есть`);
      db.addUser(login, String(b || login).trim(), await newPassword());
      console.log(`Добавлен администратор: ${login}`);
    } else if (cmd === 'passwd') {
      if (!db.userByLogin(String(a || '').toLowerCase())) throw new Error('Нет такого сотрудника');
      db.setPassword(String(a).toLowerCase(), await newPassword());
      console.log('Пароль изменён, все сессии сотрудника завершены');
    } else if (cmd === 'remove-user') {
      console.log(db.removeUser(String(a || '').toLowerCase()) ? 'Удалён' : 'Нет такого сотрудника');
    } else if (cmd === 'users') {
      const list = db.listUsers();
      if (!list.length) console.log('Сотрудников нет');
      list.forEach((u) => console.log(`${u.login}\t${u.name}\tс ${new Date(u.created_at).toLocaleDateString('ru-RU')}`));
    } else if (cmd === 'backup') {
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const file = path.resolve(a || path.join(path.dirname(cfg.dbFile), 'backups', `rollevich-${stamp}.db`));
      db.backup(file);
      console.log(`Копия сохранена: ${file}`);
    } else {
      console.log('Команды: add-user <логин> "<Имя>" | passwd <логин> | remove-user <логин> | users | backup [файл]');
      process.exitCode = 1;
    }
  } finally {
    db.close();
  }
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
