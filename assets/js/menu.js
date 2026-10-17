/*
 * Меню РОЛЛЕВИЧ.
 * art   — тип иллюстрации (см. art.js), пока нет фотографий.
 * image — путь к фото блюда; если указан, показывается вместо иллюстрации.
 * tags  — hit | new | spicy | veg
 */
window.ROLLEVICH_MENU = [
  {
    id: 'sets',
    title: 'Сеты',
    items: [
      { id: 's1', name: 'Сет «Ижевск»', desc: 'Филадельфия, Калифорния с крабом, запечённый с лососем, ролл с угрём', weight: '1 120 г', pcs: 32, price: 2690, art: 'set', palette: 'salmon', tags: ['hit'] },
      { id: 's2', name: 'Сет «Филармония»', desc: 'Три вида Филадельфии: классика, с огурцом, с икрой тобико', weight: '840 г', pcs: 24, price: 2290, art: 'set', palette: 'salmon' },
      { id: 's3', name: 'Сет «Тёплый вечер»', desc: 'Четыре запечённых ролла с лососем, крабом, угрём и курицей', weight: '1 000 г', pcs: 32, price: 2190, art: 'set', palette: 'baked', tags: ['new'] },
      { id: 's4', name: 'Сет «Для двоих»', desc: 'Филадельфия, Канада, нигири с лососем и тунцом', weight: '760 г', pcs: 22, price: 1990, art: 'set', palette: 'mix' }
    ]
  },
  {
    id: 'rolls',
    title: 'Роллы',
    items: [
      { id: 'r1', name: 'Филадельфия', desc: 'Лосось, сливочный сыр, огурец', weight: '280 г', pcs: 8, price: 690, art: 'roll', palette: 'salmon', tags: ['hit'] },
      { id: 'r2', name: 'Филадельфия люкс', desc: 'Двойной лосось, сливочный сыр, икра лосося', weight: '320 г', pcs: 8, price: 890, art: 'roll', palette: 'salmon', tags: ['new'] },
      { id: 'r3', name: 'Калифорния', desc: 'Снежный краб, авокадо, огурец, икра тобико', weight: '250 г', pcs: 8, price: 590, art: 'roll', palette: 'tobiko' },
      { id: 'r4', name: 'Канада', desc: 'Угорь, лосось, сливочный сыр, соус унаги, кунжут', weight: '290 г', pcs: 8, price: 790, art: 'roll', palette: 'eel' },
      { id: 'r5', name: 'Дракон', desc: 'Угорь, авокадо, креветка темпура, соус унаги', weight: '300 г', pcs: 8, price: 820, art: 'roll', palette: 'eel', tags: ['hit'] },
      { id: 'r6', name: 'Спайси тунец', desc: 'Тунец, огурец, острый соус, лук фри', weight: '240 г', pcs: 8, price: 650, art: 'roll', palette: 'tuna', tags: ['spicy'] },
      { id: 'r7', name: 'Овощной', desc: 'Авокадо, огурец, перец, салат айсберг, кунжут', weight: '220 г', pcs: 8, price: 390, art: 'roll', palette: 'veg', tags: ['veg'] },
      { id: 'r8', name: 'Камчатка', desc: 'Камчатский краб, сливочный сыр, огурец, масаго', weight: '270 г', pcs: 8, price: 990, art: 'roll', palette: 'tobiko' }
    ]
  },
  {
    id: 'baked',
    title: 'Запечённые',
    items: [
      { id: 'b1', name: 'Запечённый с лососем', desc: 'Лосось, сливочный сыр, огурец, сырная шапка', weight: '290 г', pcs: 8, price: 620, art: 'baked', palette: 'baked', tags: ['hit'] },
      { id: 'b2', name: 'Запечённый с крабом', desc: 'Снежный краб, огурец, сырный соус, тобико', weight: '280 г', pcs: 8, price: 560, art: 'baked', palette: 'baked' },
      { id: 'b3', name: 'Запечённый с угрём', desc: 'Угорь, сливочный сыр, соус унаги, кунжут', weight: '290 г', pcs: 8, price: 690, art: 'baked', palette: 'eel' },
      { id: 'b4', name: 'Запечённый с гребешком', desc: 'Морской гребешок, спайси соус, огурец', weight: '280 г', pcs: 8, price: 760, art: 'baked', palette: 'baked', tags: ['spicy', 'new'] }
    ]
  },
  {
    id: 'tempura',
    title: 'Темпура',
    items: [
      { id: 't1', name: 'Темпура с лососем', desc: 'Лосось, сливочный сыр, хрустящий кляр, соус спайси', weight: '300 г', pcs: 8, price: 640, art: 'tempura', palette: 'salmon' },
      { id: 't2', name: 'Темпура с креветкой', desc: 'Тигровая креветка, сыр, огурец, соус унаги', weight: '290 г', pcs: 8, price: 660, art: 'tempura', palette: 'tobiko' },
      { id: 't3', name: 'Темпура с курицей', desc: 'Копчёная курица, сыр, салат, соус терияки', weight: '290 г', pcs: 8, price: 520, art: 'tempura', palette: 'baked' }
    ]
  },
  {
    id: 'sushi',
    title: 'Суши',
    items: [
      { id: 'n1', name: 'Нигири лосось', desc: 'Охлаждённый лосось на рисе', weight: '40 г', pcs: 1, price: 160, art: 'nigiri', palette: 'salmon' },
      { id: 'n2', name: 'Нигири тунец', desc: 'Тунец на рисе', weight: '40 г', pcs: 1, price: 180, art: 'nigiri', palette: 'tuna' },
      { id: 'n3', name: 'Нигири угорь', desc: 'Копчёный угорь, соус унаги, кунжут', weight: '40 г', pcs: 1, price: 190, art: 'nigiri', palette: 'eel' },
      { id: 'n4', name: 'Гункан с икрой', desc: 'Икра лосося, рис, нори', weight: '45 г', pcs: 1, price: 290, art: 'gunkan', palette: 'tobiko', tags: ['new'] }
    ]
  },
  {
    id: 'hot',
    title: 'Горячее',
    items: [
      { id: 'h1', name: 'Удон с курицей', desc: 'Пшеничная лапша, курица, овощи, соус терияки', weight: '350 г', price: 490, art: 'wok', palette: 'baked' },
      { id: 'h2', name: 'Соба с говядиной', desc: 'Гречневая лапша, говядина, перец, лук', weight: '350 г', price: 560, art: 'wok', palette: 'eel', tags: ['spicy'] },
      { id: 'h3', name: 'Рис с морепродуктами', desc: 'Креветки, мидии, кальмар, яйцо, соус', weight: '330 г', price: 590, art: 'wok', palette: 'tobiko' }
    ]
  },
  {
    id: 'soups',
    title: 'Супы',
    items: [
      { id: 'p1', name: 'Мисо', desc: 'Тофу, вакаме, зелёный лук', weight: '300 мл', price: 290, art: 'soup', palette: 'miso', tags: ['veg'] },
      { id: 'p2', name: 'Том ям', desc: 'Креветки, кальмар, грибы, кокосовое молоко', weight: '350 мл', price: 590, art: 'soup', palette: 'tomyam', tags: ['spicy', 'hit'] },
      { id: 'p3', name: 'Сливочный с лососем', desc: 'Лосось, сливки, картофель, укроп', weight: '350 мл', price: 520, art: 'soup', palette: 'cream' }
    ]
  },
  {
    id: 'drinks',
    title: 'Напитки и десерты',
    items: [
      { id: 'd1', name: 'Лимонад юдзу', desc: 'Домашний лимонад с японским цитрусом', weight: '400 мл', price: 290, art: 'drink', palette: 'yuzu' },
      { id: 'd2', name: 'Матча латте холодный', desc: 'Японский чай матча, молоко', weight: '350 мл', price: 320, art: 'drink', palette: 'matcha' },
      { id: 'd3', name: 'Моти манго', desc: 'Рисовое тесто, мороженое манго', weight: '2 шт', price: 260, art: 'mochi', palette: 'yuzu' },
      { id: 'd4', name: 'Моти маракуйя', desc: 'Рисовое тесто, мороженое маракуйя', weight: '2 шт', price: 260, art: 'mochi', palette: 'tomyam' }
    ]
  }
];

window.ROLLEVICH_CONFIG = {
  deliveryPrice: 200,
  freeDeliveryFrom: 1500,
  minOrder: 900,
  pickupDiscount: 0.10,
  promoCodes: { 'ПЕРВЫЙ': 0.15 },
  openHour: 11,
  closeHour: 23
};
