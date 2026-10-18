'use strict';
// Меню и правила цен берутся из того же assets/js/menu.js, что и у сайта.
// Сервер пересчитывает заказ сам: цены и скидки из браузера не принимаются.
const fs = require('node:fs');
const vm = require('node:vm');

function loadMenu(file) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file, timeout: 2000 });
  const menu = sandbox.window.ROLLEVICH_MENU;
  const config = sandbox.window.ROLLEVICH_CONFIG;
  if (!Array.isArray(menu) || !config) throw new Error('menu.js: нет ROLLEVICH_MENU или ROLLEVICH_CONFIG');
  const items = new Map();
  menu.forEach((cat) => cat.items.forEach((it) => items.set(it.id, it)));
  return { items, config };
}

class OrderError extends Error {
  constructor(message, field) { super(message); this.field = field; }
}

const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

// Разбирает заказ из формы сайта и считает суммы. Бросает OrderError с понятным текстом.
function priceOrder(input, { items, config }) {
  if (!input || typeof input !== 'object') throw new OrderError('Пустой заказ');

  const name = str(input.name, 80);
  if (!name) throw new OrderError('Укажите имя', 'name');

  let digits = String(input.phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
  if (digits.length !== 11 || digits[0] !== '7') throw new OrderError('Укажите телефон в формате +7 (XXX) XXX-XX-XX', 'phone');
  const phone = `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;

  const method = input.method === 'pickup' ? 'pickup' : 'delivery';
  const address = method === 'delivery' ? str(input.address, 200) : '';
  if (method === 'delivery' && !address) throw new OrderError('Укажите адрес доставки', 'address');

  if (!Array.isArray(input.items) || !input.items.length) throw new OrderError('Корзина пуста');
  if (input.items.length > 100) throw new OrderError('Слишком много позиций в заказе');
  const lines = [];
  for (const raw of input.items) {
    const it = items.get(String(raw && raw.id));
    if (!it) throw new OrderError('В заказе есть блюдо, которого больше нет в меню. Обновите страницу.');
    const qty = Math.floor(Number(raw.qty));
    if (!(qty >= 1 && qty <= 99)) throw new OrderError('Неверное количество');
    lines.push({ id: it.id, name: it.name, qty, price: it.price });
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const promo = str(input.promo, 30).toUpperCase();
  let rate = config.promoCodes && config.promoCodes[promo] ? config.promoCodes[promo] : 0;
  if (method === 'pickup') rate = Math.max(rate, config.pickupDiscount || 0);
  const discount = Math.round(subtotal * rate);
  const delivery = method === 'pickup' || subtotal >= config.freeDeliveryFrom ? 0 : config.deliveryPrice;
  if (method === 'delivery' && subtotal < config.minOrder) {
    throw new OrderError(`Минимальная сумма доставки — ${config.minOrder} ₽`);
  }

  const persons = Math.min(Math.max(Math.floor(Number(input.persons)) || 1, 1), 20);
  return {
    name,
    phone,
    phoneDigits: digits,
    method,
    address,
    persons,
    time: str(input.time, 40) || 'Как можно скорее',
    payment: str(input.payment, 40) || 'Картой курьеру',
    comment: str(input.comment, 500),
    promo: config.promoCodes && config.promoCodes[promo] ? promo : '',
    items: lines,
    subtotal,
    discount,
    delivery,
    total: subtotal - discount + delivery
  };
}

module.exports = { loadMenu, priceOrder, OrderError };
