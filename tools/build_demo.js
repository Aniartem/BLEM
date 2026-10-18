'use strict';
// Сборка демо: сайт + CRM + планшет, где сервер работает прямо в браузере.
//   node tools/build_demo.js <папка>
// В папке появятся страницы, assets/ и demo/: server-bundle.js (код server/*.js, обёрнутый
// для браузера) и demo.js (подмена Node.js, SQLite через sql.js, перехват /api/…).
// Папку можно выложить на любой статический хостинг или открыть через локальный веб-сервер.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'demo-build'));
const SERVER_MODULES = ['server', 'db', 'auth', 'pricing', 'telegram', 'shifts', 'stock', 'techcards', 'revisions'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'demo'), { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(out, 'assets'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'demo', 'demo.js'), path.join(out, 'demo', 'demo.js'));

// каждый модуль — функция с теми же переменными, что даёт Node.js; без eval
const bundle = [
  '/* Сервер РОЛЛЕВИЧ для демо в браузере. Собрано tools/build_demo.js из server/*.js — не редактировать. */',
  'window.ROLLEVICH_SERVER_MODULES = {',
  SERVER_MODULES.map((name) => {
    const src = fs.readFileSync(path.join(ROOT, 'server', `${name}.js`), 'utf8');
    return `${JSON.stringify(name)}: function (require, module, exports, __dirname, __filename, Buffer, process, setTimeout, setInterval, clearTimeout, clearInterval) {\n${src}\n}`;
  }).join(',\n'),
  '};',
  ''
].join('\n');
fs.writeFileSync(path.join(out, 'demo', 'server-bundle.js'), bundle);

const DEMO_SCRIPTS = '<script src="demo/server-bundle.js"></script>\n  <script src="demo/demo.js"></script>\n  ';
function page(file, before, extra = '') {
  let html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const tag = `<script src="${before}"></script>`;
  if (!html.includes(tag)) throw new Error(`${file}: нет ${tag}`);
  html = html.replace(tag, extra + DEMO_SCRIPTS + tag);
  html = html.replace(/href="\/crm"/g, 'href="crm.html"').replace(/href="\/smena"/g, 'href="smena.html"').replace(/href="\/"/g, 'href="index.html"');
  fs.writeFileSync(path.join(out, file), html);
}
page('index.html', 'assets/js/store.js');
page('crm.html', 'assets/js/store.js');
page('smena.html', 'assets/js/smena.js', '<script src="assets/js/menu.js"></script>\n  ');

console.log(`Демо собрано: ${out}`);
