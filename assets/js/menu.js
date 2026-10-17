/*
 * Меню РОЛЛЕВИЧ — сгенерировано по структуре меню-образца, цены пересчитаны под Ижевск.
 * Поля блюда: name, desc (состав), meta (кол-во), price (₽),
 * art/palette — векторная иллюстрация (art.js), image — путь к фото (заменит иллюстрацию),
 * tags — hit | new | spicy | kids
 */
window.ROLLEVICH_MENU = [
  {
    id: "sets",
    title: "Сеты",
    items: [
      { id: "sushi-set-10-pcs", name: "Суши сет", desc: "Суши с лососем — 2 шт, Суши с копченым лососем — 2 шт, Суши с угрем — 2 шт, Суши с тунцом — 2 шт, Суши с креветками — 2 шт", meta: "10 шт", price: 1570, art: "nigiri", palette: "salmon" },
      { id: "maki-set-24-pcs", name: "Маки сет", desc: "Маки с лососем — 4 шт, Маки с угрем — 4 шт, Маки с креветками — 4 шт, Маки с тунцом — 4 шт, Маки с огурцом — 4 шт, Маки с авокадо — 4 шт", meta: "24 шт", price: 1050, art: "maki-set", palette: "mix" },
      { id: "rainbow-set-24-pcs", name: "Радуга сет", desc: "Радуга — 8 шт, Калифорния — 8 шт, Зеленый дом — 8 шт", meta: "24 шт", price: 1390, art: "set", palette: "salmon" },
      { id: "mini-set-24-pcs", name: "Мини сет", desc: "Калифорния — 8 шт, Филадельфия с огурцом — 8 шт, Туна маки — 8 шт", meta: "24 шт", price: 1490, art: "set", palette: "salmon" },
      { id: "trio-set-24-pcs", name: "Трио сет", desc: "Филадельфия с сыром — 8 шт, Калифорния — 8 шт, Тори — 8 шт", meta: "24 шт", price: 1580, art: "set", palette: "salmon" },
      { id: "green-dragon-set-24-pcs", name: "Зелёный дракон сет", desc: "Эби Авокадо — 8 шт, Калифорния с лососем — 8 шт, Зеленый дом — 8 шт", meta: "24 шт", price: 1600, art: "set", palette: "eel" },
      { id: "mini-set-tempura-24-pcs", name: "Мини сет Темпура", desc: "Филадельфия с креветками в духовке — 8 шт, Горячий краб — 8 шт, Горячая Мексика — 8 шт", meta: "24 шт", price: 1700, art: "set", palette: "baked" },
      { id: "mini-set-plus-24-pcs", name: "Мини сет Плюс", desc: "Эби Ролл — 8 шт, Калифорния — 8 шт, Филадельфия с авокадо — 8 шт", meta: "24 шт", price: 2000, art: "set", palette: "salmon" },
      { id: "eel-set-24-pcs", name: "Угорь сет", desc: "Канада — 8 шт, Филадельфия с угрем — 8 шт, Маки с угрем — 8 шт, Суши с угрем — 3 шт", meta: "27 шт", price: 3330, art: "set", palette: "eel" },
      { id: "tokyo-set-32-pcs", name: "Токио сет", desc: "Филадельфия с огурцом — 8 шт, Калифорния с креветками — 8 шт, Маки с авокадо — 8 шт, Маки с сыром — 8 шт", meta: "32 шт", price: 1570, art: "set", palette: "salmon" },
      { id: "tamago-set-32-pcs", name: "Тамаго сет", desc: "Филадельфия с тамаго — 8 шт, Калифорния с тамаго — 8 шт, Ролл Тамаго — 8 шт, Тамаго маки — 8 шт", meta: "32 шт", price: 1820, art: "set", palette: "salmon" },
      { id: "tu-san-set-32-pcs", name: "Ту Сан сет", desc: "Калифорния с лососем — 8 шт, Калифорния — 8 шт, Нежный лосось — 8 шт, Ту Сан маки — 8 шт", meta: "32 шт", price: 1920, art: "set", palette: "salmon" },
      { id: "prada-set-32-pcs", name: "Прада сет", desc: "Филадельфия с авокадо — 8 шт, Эби с огурцом — 8 шт, Маки с угрем и огурцом — 8 шт, Тамаго маки — 8 шт", meta: "32 шт", price: 2060, art: "set", palette: "salmon" },
      { id: "finix-set-32-pcs", name: "Феникс сет", desc: "Филадельфия с огурцом, Феникс, Фрайд, Зебра", meta: "32 шт", price: 2140, art: "set", palette: "salmon" },
      { id: "zenshi-set-32-pcs", name: "Зенши сет", desc: "Ролл Самурай — 8 шт, Калифорния — 8 шт, Филадельфия с авокадо — 8 шт, Ролл с масляной рыбой — 8 шт", meta: "32 шт", price: 2320, art: "set", palette: "salmon" },
      { id: "classic-set-32-pcs", name: "Классический сет", desc: "Филадельфия с авокадо — 8 шт, Радуга — 8 шт, Эби с авокадо — 8 шт, Ролл Тамаго — 8 шт", meta: "32 шт", price: 2500, art: "set", palette: "salmon" },
      { id: "samurai-set-32-pcs", name: "Самурай сет", desc: "Филадельфия авокадо — 8 шт, Канада — 8 шт, Калифорния лосось — 8 шт, Острый Самурай — 8 шт", meta: "32 шт", price: 2750, art: "set", palette: "salmon" },
      { id: "royal-set-32-pcs", name: "Королевский сет", desc: "Аристократ ролл — 8 шт, Инь-Ян ролл — 8 шт, Калифорния классическая в духовке — 8 шт, Ролл Дракон — 8 шт", meta: "32 шт", price: 4060, art: "set", palette: "baked" },
      { id: "salmon-set-35-pcs", name: "Лосось сет", desc: "Калифорния с лососем — 8 шт, Филадельфия авокадо — 8 шт, Самурай — 8 шт, Маки с лососем — 8 шт, Суши с лососем — 3 шт", meta: "35 шт", price: 2540, art: "set", palette: "salmon" },
      { id: "vegetable-set-40-pcs", name: "Овощной сет", desc: "Овощной ролл — 8 шт, Зеленый дом — 8 шт, Чука маки — 8 шт, Авокадо маки — 8 шт, Маки с огурцом — 8 шт", meta: "40 шт", price: 1200, art: "set", palette: "veg", tags: ["kids"] },
      { id: "tempura-set-40-pcs", name: "Темпура сет", desc: "Филадельфия с огурцом — 8 шт, Цезарь темпура — 8 шт, Мумия ролл — 8 шт, Спайс темпура — 8 шт, Запеченная Калифорния — 8 шт", meta: "40 шт", price: 2480, art: "set", palette: "baked" },
      { id: "dragon-set-40-pcs", name: "Дракон сет", desc: "Маки с угрем, Маки с лососем и тобико — 8 шт, Дракон — 8 шт, Филадельфия с угрем — 4 шт, Филадельфия с креветками — 4 шт, Калифорния — 4 шт, Калифорния с лососем — 4 шт", meta: "40 шт", price: 3840, art: "set", palette: "eel" },
      { id: "deluxe-set-48-pcs", name: "Делюкс сет", desc: "Ролл с масляной рыбой — 8 шт, Ролл Тамаго — 8 шт, Канада — 8 шт, Калифорния — 8 шт, Филадельфия с сыром — 8 шт, Эби с авокадо — 8 шт", meta: "48 шт", price: 3970, art: "set", palette: "salmon" },
      { id: "family-set-64-pcs", name: "Семейный сет", desc: "Филадельфия с огурцом — 8 шт, Калифорния — 8 шт, Канада — 8 шт, Острый Самурай — 8 шт, Нежный тунец — 8 шт, Мумия ролл — 8 шт, Аризона — 8 шт, Запеченная Калифорния — 8 шт", meta: "64 шт", price: 4690, art: "set", palette: "baked" },
      { id: "friends-set-72-pcs", name: "Сет для друзей", desc: "Ролл с масляной рыбой — 8 шт, Филадельфия с авокадо — 8 шт, Калифорния с копченым лососем — 8 шт, Эби с огурцом — 8 шт, Острый самурай — 8 шт, Ролл чука — 8 шт, Маки с угрем и огурцом — 8 шт, Маки с лососем и огурцом — 8 шт, Маки с огурцом — 8 шт", meta: "72 шт", price: 4540, art: "set", palette: "mix" },
      { id: "sakura-set-100-pcs", name: "Сакура сет", desc: "Маки с огурцами — 8 шт, Маки с угрем — 8 шт, Маки Чука — 8 шт, Горячий Чука с лососем — 8 шт, Горячий ролл Цезарь Темпура — 8 шт, Ролл Филадельфия с креветками — 8 шт, Ролл Филадельфия с угрем — 8 шт, Ролл Калифорния классик — 8 шт, Ролл Канада — 8 шт, Ролл Нежный копченый лосось — 8 шт, Ролл Радуга — 8 шт, Суши с лососем — 2 шт, Суши с тунцом — 2 шт, Суши с креветками — 2 шт, Гункан с креветками — 1 шт, Острый Гункан с креветками — 1 шт, Гункан с угрем — 1 шт, Острый Гункан с угрем — 1 шт, Гункан с копченой курицей — 1 шт, Острый Гункан с копченой курицей — 1 шт", meta: "100 шт", price: 8530, art: "set", palette: "baked" },
      { id: "salmon-box", name: "Бокс с лососем", desc: "Филадельфия с авокадо 8 шт, суши с лососем 6 шт, сашими с лососем 7 кусков, маки с лососем и сыром 8 шт, гункан с лососем и сыром 3 шт, салат чука", meta: "32 шт + салат", price: 4300, art: "set", palette: "salmon" },
      { id: "ebi-box", name: "Эби Бокс", desc: "Эби с авокадо 8 шт, суши с креветками 6 шт, эби сашими 7 шт, тусан маки 8 шт, гункан с креветками и сыром 3 шт", meta: "32 шт", price: 3180, art: "set", palette: "salmon" }
    ]
  },
  {
    id: "rolls",
    title: "Роллы",
    items: [
      { id: "philadelphia-with-avocado", name: "Филадельфия с авокадо", desc: "Нори, рис, лосось, сливочный сыр, авокадо", meta: "8 шт", price: 770, art: "roll", palette: "salmon", tags: ["hit"] },
      { id: "philadelphia-with-cucumber", name: "Филадельфия с огурцом", desc: "Нори, рис, лосось, сливочный сыр, огурец", meta: "8 шт", price: 670, art: "roll", palette: "salmon", tags: ["hit"] },
      { id: "philadelphia-with-shrimps", name: "Филадельфия с креветками", desc: "Нори, рис, лосось, сыр, креветка, огурец", meta: "8 шт", price: 770, art: "roll", palette: "shrimp" },
      { id: "philadelphia-with-cheese", name: "Филадельфия с сыром", desc: "Нори, рис, лосось, сливочный сыр", meta: "8 шт", price: 720, art: "roll", palette: "salmon", tags: ["hit"] },
      { id: "philadelphia-with-eel", name: "Филадельфия с угрем", desc: "Нори, рис, лосось, сыр, угорь, огурец", meta: "8 шт", price: 1040, art: "roll", palette: "eel" },
      { id: "philadelphia-with-tamago", name: "Филадельфия с тамаго", desc: "Нори, рис, тамаго, сыр, лосось", meta: "8 шт", price: 670, art: "roll", palette: "tamago" },
      { id: "philadelphia-with-apple", name: "Филадельфия с яблоком", desc: "Нори, рис, лосось, сыр, яблоко", meta: "8 шт", price: 690, art: "roll", palette: "salmon" },
      { id: "soft-philadelphia", name: "Нежная филадельфия", desc: "Соевая бумага, рис, лосось, сыр, огурец, авокадо, кунжут", meta: "8 шт", price: 830, art: "roll", palette: "salmon" },
      { id: "philadelphia-luxury", name: "Филадельфия Люкс", desc: "Соевая бумага, рис, сыр, огурец, авокадо, икра лосося", meta: "8 шт", price: 1230, art: "roll", palette: "tobiko" },
      { id: "california", name: "Калифорния", desc: "Нори, рис, крабовые палочки, сливочный сыр, огурец, икра тобико", meta: "8 шт", price: 460, art: "roll", palette: "tobiko", tags: ["hit"] },
      { id: "california-with-tamago", name: "Калифорния с тамаго", desc: "Нори, рис, тамаго, тобико, сыр, огурцы", meta: "8 шт", price: 460, art: "roll", palette: "tamago" },
      { id: "california-with-smocked-salmon", name: "Калифорния с копченым лососем", desc: "Нори, рис, огурец, сыр, копченый лосось, тобико", meta: "8 шт", price: 670, art: "roll", palette: "salmon" },
      { id: "california-with-eel", name: "Калифорния с угрём", desc: "Нори, рис, сыр, огурец, угорь, тобико", meta: "8 шт", price: 720, art: "roll", palette: "eel" },
      { id: "california-with-salmon", name: "Калифорния с лососем", desc: "Нори, рис, огурец, сыр, лосось, тобико", meta: "8 шт", price: 580, art: "roll", palette: "salmon" },
      { id: "california-with-shrimps", name: "Калифорния с креветкой", desc: "Нори, рис, огурец, сыр, креветка, тобико", meta: "8 шт", price: 510, art: "roll", palette: "shrimp" },
      { id: "california-classic", name: "Калифорния классическая", desc: "Нори, рис, огурец, сыр, мясо краба, тобико", meta: "8 шт", price: 800, art: "roll", palette: "tobiko" },
      { id: "roll-ebi", name: "Ролл Эби", desc: "Рис, нори, сыр, лосось, огурец, креветки", meta: "8 шт", price: 770, art: "roll", palette: "shrimp" },
      { id: "ebi-with-avocado", name: "Ролл Эби с авокадо", desc: "Рис, нори, сыр, авокадо, креветки", meta: "8 шт", price: 670, art: "roll", palette: "shrimp" },
      { id: "ebi-with-cucumber", name: "Ролл Эби с огурцом", desc: "Рис, нори, сыр, огурец, креветки", meta: "8 шт", price: 610, art: "roll", palette: "shrimp" },
      { id: "tender-oilfish", name: "Нежная масляная рыба", desc: "Соевая бумага, рис, сыр, огурец, масляная рыба, тобико", meta: "8 шт", price: 580, art: "roll", palette: "butter" },
      { id: "tender-tamago", name: "Нежное тамаго", desc: "Рис, тамаго, тобико, сыр, огурцы", meta: "8 шт", price: 430, art: "roll", palette: "tamago" },
      { id: "tender-eel", name: "Нежный угорь", desc: "Сыр, тобико, огурцы, угорь, рис", meta: "8 шт", price: 740, art: "roll", palette: "eel" },
      { id: "tender-tuna", name: "Нежный тунец", desc: "Сыр, огурцы, тунец, тобико, рис", meta: "8 шт", price: 540, art: "roll", palette: "tuna" },
      { id: "tender-shrimp", name: "Нежная креветка", desc: "Рис, сыр, огурец, креветки, тобико", meta: "8 шт", price: 480, art: "roll", palette: "shrimp" },
      { id: "tender-salmon", name: "Нежный лосось", desc: "Сыр, огурцы, лосось, тобико, рис", meta: "8 шт", price: 560, art: "roll", palette: "salmon" },
      { id: "tender-smoked-salmon", name: "Нежный копченый лосось", desc: "Сыр, огурцы, копченый лосось, тобико, рис", meta: "8 шт", price: 660, art: "roll", palette: "salmon" },
      { id: "caesar", name: "Цезарь", desc: "Нори, рис, копченая курица, майонез, китайская капуста, помидоры", meta: "8 шт", price: 320, art: "roll", palette: "baked", tags: ["kids"] },
      { id: "with-vegetables", name: "Овощной", desc: "Нори, рис, перец, огурец, авокадо, китайская капуста", meta: "8 шт", price: 340, art: "roll", palette: "veg", tags: ["kids"] },
      { id: "with-vegetables-cheese", name: "С овощями и сыром", desc: "Нори, рис, перец, огурец, авокадо, китайская капуста, сыр", meta: "8 шт", price: 350, art: "roll", palette: "veg", tags: ["hit", "kids"] },
      { id: "green-house", name: "Зеленый дом", desc: "Нори, рис, огурец, авокадо, китайская капуста, кунжут, укроп", meta: "8 шт", price: 350, art: "roll", palette: "veg", tags: ["kids"] },
      { id: "yin-and-yang", name: "Инь-Ян", desc: "Нори, рис, лосось, тунец", meta: "8 шт", price: 560, art: "roll", palette: "tuna" },
      { id: "yin-and-yang-plus", name: "Инь-Ян плюс", desc: "Нори, рис, креветки, копчёный лосось", meta: "8 шт", price: 580, art: "roll", palette: "salmon" },
      { id: "samurai", name: "Самурай", desc: "Нори, рис, сыр, лосось, огурец, кунжут", meta: "8 шт", price: 400, art: "roll", palette: "salmon", tags: ["hit"] },
      { id: "samurai-spicy", name: "Самурай острый", desc: "Нори, рис, жареный лосось, огурец, кунжут, спайси соус", meta: "8 шт", price: 460, art: "roll", palette: "salmon", tags: ["spicy"] },
      { id: "aristocrat", name: "Аристократ", desc: "Нори, рис, сыр, мясо краба, лосось, икра лосося, креветка", meta: "8 шт", price: 1360, art: "roll", palette: "tobiko" },
      { id: "murakami", name: "Роллевич", desc: "Нори, рис, лосось, сыр, огурец, киви и лососевая икра", meta: "8 шт", price: 960, art: "roll", palette: "salmon" },
      { id: "dragon", name: "Дракон", desc: "Нори, рис, авокадо, сыр, угорь, унаги, кунжут", meta: "8 шт", price: 1100, art: "roll", palette: "eel" },
      { id: "canada", name: "Канада", desc: "Нори, рис, авокадо, сыр, лосось, угорь, унаги, кунжут", meta: "8 шт", price: 940, art: "roll", palette: "eel" },
      { id: "imperator", name: "Ролл Император", desc: "Нори, рис, лосось, огурец, угорь, сыр виола, соус унаги, кунжут", meta: "8 шт", price: 830, art: "roll", palette: "eel" },
      { id: "prada", name: "Прада", desc: "Нори, рис, креветка, лосось, сыр", meta: "8 шт", price: 850, art: "roll", palette: "salmon" },
      { id: "tokio", name: "Токио", desc: "Нори, рис, огурец, креветка, лосось", meta: "8 шт", price: 780, art: "roll", palette: "salmon" },
      { id: "roll-with-pineapple", name: "Ролл с ананасом", desc: "Рис, сыр, угорь, ананас, соус унаги", meta: "8 шт", price: 690, art: "roll", palette: "eel" },
      { id: "roll-with-butterfish", name: "Ролл с масляной рыбой", desc: "Рис, нори, огурец, сыр, масляная рыба, тобико", meta: "8 шт", price: 690, art: "roll", palette: "butter" },
      { id: "tamago", name: "Тамаго", desc: "Нори, рис, тамаго, тобико, креветки, чука", meta: "8 шт", price: 480, art: "roll", palette: "tamago" },
      { id: "rainbow", name: "Радуга", desc: "Нори, рис, креветка, тунец, лосось, авокадо, огурец, сыр", meta: "8 шт", price: 580, art: "roll", palette: "tuna" },
      { id: "finix", name: "Феникс", desc: "Нори, рис, огурец, сыр, жареный лосось, тобико", meta: "8 шт", price: 590, art: "roll", palette: "salmon" },
      { id: "zenshi", name: "Зенши", desc: "Нори, рис, масляная рыба, огурец, тобико, спайси соус", meta: "8 шт", price: 610, art: "roll", palette: "tobiko", tags: ["spicy"] },
      { id: "bonito", name: "Бонито", desc: "Нори, рис, тунец, лосось, огурец, корка тунца, спайси соус", meta: "8 шт", price: 530, art: "roll", palette: "tuna", tags: ["spicy"] },
      { id: "wasabi", name: "Васаби", desc: "Нори, рис, креветка, огурец, тобико, спайси соус", meta: "8 шт", price: 500, art: "roll", palette: "tobiko", tags: ["spicy"] },
      { id: "frayd", name: "Фрайд", desc: "Нори, рис, лук, огурец, жареный лосось, кунжут", meta: "8 шт", price: 480, art: "roll", palette: "salmon" },
      { id: "mexico", name: "Мексика", desc: "Нори, рис, сыр, огурцы, говядина, соус Кимчи, ветчина", meta: "8 шт", price: 530, art: "roll", palette: "baked" },
      { id: "chuka", name: "Чука", desc: "Нори, рис, сыр, огурец, тунец, чука, соус грецкого ореха", meta: "8 шт", price: 420, art: "roll", palette: "tuna" },
      { id: "zebra", name: "Зебра", desc: "Нори, рис, сыр, огурец, масляная рыба, Кунжут", meta: "8 шт", price: 420, art: "roll", palette: "butter" },
      { id: "tori", name: "Тори", desc: "Нори, рис, копченая курица, огурец, кунжут, тартар", meta: "8 шт", price: 400, art: "roll", palette: "baked" },
      { id: "dallas", name: "Даллас", desc: "Нори, рис, жареный лосось, укроп, перец, помидор, спайси соус", meta: "8 шт", price: 400, art: "roll", palette: "salmon", tags: ["spicy"] },
      { id: "chicken", name: "Чикен", desc: "Нори, рис, копченая курица, огурец, кунжут, майонез", meta: "8 шт", price: 340, art: "roll", palette: "baked", tags: ["kids"] },
      { id: "salmon-volcano-roll", name: "Вулкан с лососем", desc: "Нори, рис, авокадо, огурец, лосось, тобико, зелёный лук, кунжут", meta: "8 шт", price: 830, art: "roll", palette: "salmon" },
      { id: "kyoto-roll", name: "Ролл Киото", desc: "Нори, рис, авокадо, огурец, лосось, креветка, зелёный лук, соус унаги", meta: "8 шт", price: 820, art: "roll", palette: "salmon" },
      { id: "kaizen-roll", name: "Ролл Кайзен", desc: "Нори, рис, угорь, перец Рамиро, сливочный сыр, зелёный лук, кунжут, соус унаги", meta: "8 шт", price: 670, art: "roll", palette: "eel" },
      { id: "tropica-roll", name: "Ролл Тропика", desc: "Нори, рис, авокадо, кумкват, лосось, тобико", meta: "8 шт", price: 900, art: "roll", palette: "salmon" },
      { id: "lemongrass-ebi", name: "Лемонграсс Эби", desc: "Нори, рис, креветка, авокадо, сливочный сыр, зелёный лук, соус лемонграсс", meta: "8 шт", price: 610, art: "roll", palette: "shrimp", tags: ["new"] },
      { id: "tuna-fusion", name: "Тунец Фьюжн", desc: "Нори, рис, авокадо, тунец, креветка в темпуре, зелёный лук, соус унаги", meta: "8 шт", price: 720, art: "roll", palette: "tuna", tags: ["new"] },
      { id: "velvet-salmon", name: "Вельвет лосось", desc: "Нори, рис, авокадо, лосось, креветка в темпуре, зелёный лук, соус лемонграсс", meta: "8 шт", price: 850, art: "roll", palette: "salmon", tags: ["new"] },
      { id: "tuna-volcano", name: "Вулкан Тунец", desc: "Нори, рис, авокадо, огурец, тунец, зелёный лук, карамелизированный лук, трюфельный соус", meta: "8 шт", price: 800, art: "roll", palette: "tuna", tags: ["new"] },
      { id: "salmon-crown", name: "Салмон Краун", desc: "Нори, рис, авокадо, угорь, лосось, икра летучей рыбы, зелёный лук, рисовые шарики, фирменный соус", meta: "8 шт", price: 860, art: "roll", palette: "eel", tags: ["new"] },
      { id: "tuna-crown", name: "Туна Краун", desc: "Нори, рис, авокадо, огурец, лосось, тунец, зелёный лук, соус унаги, соус спайси, фирменный соус", meta: "8 шт", price: 830, art: "roll", palette: "tuna", tags: ["new"] },
      { id: "creamy-ebi", name: "Крими Эби", desc: "Нори, рис, авокадо, креветка темпура, икра летучей рыбы, зелёный лук, соус унаги, сливочный соус", meta: "8 шт", price: 400, art: "roll", palette: "shrimp", tags: ["new"] },
      { id: "yuzu-salmon", name: "Юдзу Салмон", desc: "Нори, рис, авокадо, огурец, кумкват, лосось, икра летучей рыбы, сок юдзу, зелёный лук", meta: "8 шт", price: 1040, art: "roll", palette: "salmon", tags: ["new"] }
    ]
  },
  {
    id: "hot",
    title: "Горячие роллы",
    items: [
      { id: "philadelphia-with-avocado-hot-roll", name: "Горячий ролл Филадельфия с авокадо", desc: "Нори, рис, лосось, сыр, авокадо, рис, кунжут, сухарик", meta: "8 шт", price: 620, art: "tempura", palette: "salmon", tags: ["hit"] },
      { id: "philadelphia-with-cucumber-hot-roll", name: "Горячий ролл Филадельфия с огурцом", desc: "Нори, рис, лосось, сыр, огурцы, рис, унаги, кунжут, сухарики", meta: "8 шт", price: 580, art: "tempura", palette: "salmon", tags: ["hit"] },
      { id: "hot-roll-philadelphia-with-shrimps", name: "Горячий ролл Филадельфия с креветками", desc: "Рис, нори, сыр, креветки, лосось, соус унаги, кунжут, панировочные сухари", meta: "8 шт", price: 620, art: "tempura", palette: "shrimp", tags: ["hit"] },
      { id: "philadelphia-with-eel-hot-roll", name: "Горячий ролл Филадельфия с угрем", desc: "Нори, рис, сыр, лосось, угорь, огурец, унаги, кунжут, кляр", meta: "8 шт", price: 850, art: "tempura", palette: "eel" },
      { id: "caesar-tempura-hot-roll", name: "Горячий ролл Цезарь темпура", desc: "Нори, рис, майонез, копченая курица, китайская капуста, помидор, унаги, кунжут", meta: "8 шт", price: 340, art: "tempura", palette: "baked" },
      { id: "mummy-hot-roll", name: "Горячий ролл Мумия", desc: "Нори, рис, жареный лосось, спайси соус, огурец, унаги, кунжут, кляр", meta: "8 шт", price: 480, art: "tempura", palette: "salmon" },
      { id: "imperator-hot", name: "Горячий ролл Император", desc: "Нори, рис, угорь, лосось, огурцы, сыр Виола, унаги, кунжут, кляр", meta: "8 шт", price: 660, art: "tempura", palette: "eel" },
      { id: "arizona-hot-roll", name: "Горячий ролл Аризона", desc: "Нори, рис, сыр, креветка, лосось, китайская капуста, унаги, кунжут, кляр", meta: "8 шт", price: 460, art: "tempura", palette: "salmon", tags: ["hit"] },
      { id: "mexico-hot-roll", name: "Горячий ролл Мексика", desc: "Нори, рис, огурцы, говядина, ветчина, Ширача, унаги, кунжут, кляр", meta: "8 шт", price: 480, art: "tempura", palette: "baked" },
      { id: "spicy-tempura-hot-roll", name: "Горячий ролл Спайси темпура", desc: "Нори, рис, спайси соус, имбирь, огурец, лосось, кляр", meta: "8 шт", price: 430, art: "tempura", palette: "salmon", tags: ["spicy"] },
      { id: "hot-california", name: "Горячая Калифорния", desc: "Нори, рис, сыр, огурец, крабовые палочки, унаги, кунжут, кляр", meta: "8 шт", price: 430, art: "tempura", palette: "tobiko", tags: ["hit"] },
      { id: "classic-california-hot-roll", name: "Горячий ролл Классическая Калифорния", desc: "Нори, рис, сыр, огурец, мясо краба, унаги, кунжут, кляр", meta: "8 шт", price: 820, art: "tempura", palette: "tobiko" },
      { id: "chuka-with-salmon-hot-roll", name: "Горячий ролл Чука с лососем", desc: "Лосось, чука, авокадо, соус грецкого ореха", meta: "8 шт", price: 830, art: "tempura", palette: "salmon" },
      { id: "roasted-philadelphia-with-eel", name: "Филадельфия с угрем в духовке", desc: "Нори, рис, сыр, огурец, угорь, лосось", meta: "8 шт", price: 1060, art: "baked", palette: "eel" },
      { id: "roasted-philadelphia-with-shrimps", name: "Филадельфия с креветкой в духовке", desc: "Нори, рис, сыр, огурец, креветка, лосось", meta: "8 шт", price: 780, art: "baked", palette: "shrimp" },
      { id: "roasted-california", name: "Калифорния в духовке", desc: "Нори, рис, сыр, огурец, крабовые палочки, тобико, соус тобико", meta: "8 шт", price: 660, art: "baked", palette: "tobiko" },
      { id: "roasted-california-classic", name: "Калифорния классическая в духовке", desc: "Нори, рис, сыр, огурец, мясо краба, тобико, соус тобико", meta: "8 шт", price: 1040, art: "baked", palette: "tobiko" }
    ]
  },
  {
    id: "maki",
    title: "Маки",
    items: [
      { id: "salmon-maki", name: "Маки с лососем", desc: "Нори, рис, лосось", meta: "8 шт", price: 420, art: "maki", palette: "salmon" },
      { id: "eel-maki", name: "Маки с угрем", desc: "Нори, рис, угорь, соус унаги", meta: "8 шт", price: 670, art: "maki", palette: "eel" },
      { id: "shrimp-maki", name: "Маки с креветками", desc: "Нори, рис, креветки", meta: "8 шт", price: 320, art: "maki", palette: "shrimp" },
      { id: "tuna-maki", name: "Маки с тунцом", desc: "Нори, рис, тунец", meta: "8 шт", price: 350, art: "maki", palette: "tuna" },
      { id: "butterfish-maki", name: "Маки с масляной рыбой", desc: "Нори, рис, масляная рыба", meta: "8 шт", price: 420, art: "maki", palette: "butter" },
      { id: "smoked-salmon-maki", name: "Маки с копчёным лососем", desc: "Нори, рис, копчёный лосось", meta: "8 шт", price: 560, art: "maki", palette: "salmon" },
      { id: "cucumber-maki", name: "Маки с огурцом", desc: "Нори, рис, огурец", meta: "8 шт", price: 130, art: "maki", palette: "veg", tags: ["hit", "kids"] },
      { id: "avocado-maki", name: "Маки с авокадо", desc: "Нори, рис, авокадо", meta: "8 шт", price: 210, art: "maki", palette: "veg", tags: ["kids"] },
      { id: "chuka-maki", name: "Маки с чукой", desc: "Нори, рис, салат чука", meta: "8 шт", price: 180, art: "maki", palette: "veg" },
      { id: "tu-san-maki", name: "Маки Ту-Сан", desc: "Нори, рис, креветки, сливочный сыр", meta: "8 шт", price: 320, art: "maki", palette: "shrimp" },
      { id: "salmon-and-cucumber-maki", name: "Маки с лососем и огурцом", desc: "Нори, рис, лосось, огурец", meta: "8 шт", price: 320, art: "maki", palette: "salmon" },
      { id: "eel-and-cucumber-maki", name: "Маки с угрем и огурцом", desc: "Нори, рис, угорь, огурец, соус унаги", meta: "8 шт", price: 480, art: "maki", palette: "eel" },
      { id: "salmon-caviar-maki", name: "Маки с икрой лосося", desc: "Нори, рис, икра лосося", meta: "8 шт", price: 640, art: "maki", palette: "tobiko" },
      { id: "cheese-maki", name: "Маки с сыром", desc: "Нори, рис, сливочный сыр", meta: "8 шт", price: 180, art: "maki", palette: "veg", tags: ["kids"] },
      { id: "tamago-maki", name: "Маки с тамаго", desc: "Нори, рис, тамаго", meta: "8 шт", price: 210, art: "maki", palette: "tamago" },
      { id: "spicy-salmon-maki", name: "Острое маки с лососем", desc: "Нори, рис, лосось, острый соус", meta: "8 шт", price: 430, art: "maki", palette: "salmon", tags: ["spicy"] },
      { id: "spicy-eeal-maki", name: "Острое маки с угрем", desc: "Нори, рис, угорь, соус унаги, острый соус", meta: "8 шт", price: 690, art: "maki", palette: "eel", tags: ["spicy"] },
      { id: "spicy-tuna-maki", name: "Острое маки с тунцом", desc: "Нори, рис, тунец, острый соус", meta: "8 шт", price: 370, art: "maki", palette: "tuna", tags: ["spicy"] },
      { id: "spicy-shrip-maki", name: "Острое маки с креветками", desc: "Нори, рис, креветки, острый соус", meta: "8 шт", price: 340, art: "maki", palette: "shrimp", tags: ["spicy"] }
    ]
  },
  {
    id: "spring",
    title: "Спринг-роллы",
    items: [
      { id: "spring-with-shrimps", name: "Спринг с креветками", desc: "Лист риса, китайская капуста, сыр, перец, огурец, авокадо, креветки", meta: "4 шт", price: 510, art: "roll", palette: "shrimp" },
      { id: "spring-with-salmon", name: "Спринг с лососем", desc: "Лист риса, китайская капуста, сыр, перец, огурец, авокадо, лосось", meta: "4 шт", price: 610, art: "roll", palette: "salmon" },
      { id: "spring-with-tuna", name: "Спринг с тунцом", desc: "Лист риса, китайская капуста, сыр, перец, огурец, авокадо, тунец", meta: "4 шт", price: 510, art: "roll", palette: "tuna" },
      { id: "spring-with-tamago", name: "Спринг с тамаго", desc: "Лист риса, китайская капуста, сыр, перец, огурец, авокадо, тамаго", meta: "4 шт", price: 380, art: "roll", palette: "tamago" },
      { id: "spring-with-vegetables", name: "Спринг с овощами", desc: "Лист риса, китайская капуста, сыр, перец, огурец, авокадо, чука", meta: "4 шт", price: 350, art: "roll", palette: "veg" }
    ]
  },
  {
    id: "sweet",
    title: "Сладкие роллы",
    items: [
      { id: "sweet-banana-kiwi", name: "Сладкий ролл банан-киви", desc: "Соевая бумага, пудинг, банан, киви, клубничный топпинг, йогурт", meta: "8 шт", price: 480, art: "roll", palette: "sweet" },
      { id: "sweet-roll-pear-apple", name: "Сладкий ролл груша-яблоко", desc: "Соевая бумага, пудинг, груша, яблоко, клубничный топпинг, йогурт", meta: "8 шт", price: 510, art: "roll", palette: "sweet" },
      { id: "sweet-roll-nutella-banana", name: "Сладкий ролл нутелла-банан", desc: "Соевая бумага, пудинг, банан, нутелла, лесной орех шоколадный топпинг, йогурт", meta: "8 шт", price: 560, art: "roll", palette: "sweet" },
      { id: "sweet-roll-orange-apple", name: "Сладкий ролл апельсин-яблоко", desc: "Соевая бумага, пудинг, апельсин, яблоко, лесной орех карамельный топпинг, йогурт", meta: "8 шт", price: 530, art: "roll", palette: "sweet" },
      { id: "sweet-role-chocolate", name: "Сладкий ролл шоколадный", desc: "Соевая бумага, пудинг, шоколад, нутелла, лесной орех шоколадный топпинг, йогурт", meta: "8 шт", price: 720, art: "roll", palette: "sweet" }
    ]
  },
  {
    id: "sushi",
    title: "Суши",
    items: [
      { id: "sushi-with-smoked-salmon", name: "Суши с копченым лососем", desc: "Копченый лосось, рис", meta: "1 шт", price: 160, art: "nigiri", palette: "salmon" },
      { id: "sushi-with-salmon", name: "Суши с лососем", desc: "Лосось, рис", meta: "1 шт", price: 130, art: "nigiri", palette: "salmon", tags: ["hit"] },
      { id: "sushi-with-eel", name: "Суши с угрем", desc: "Угорь, унаги, кунжут", meta: "1 шт", price: 220, art: "nigiri", palette: "eel" },
      { id: "sushi-with-tuna", name: "Суши с тунцом", desc: "Тунец, рис", meta: "1 шт", price: 130, art: "nigiri", palette: "tuna" },
      { id: "shrimp-sushi", name: "Суши с креветками", desc: "Креветки, рис", meta: "1 шт", price: 140, art: "nigiri", palette: "shrimp" },
      { id: "sushi-with-tamago", name: "Суши с тамаго", desc: "Тамаго, рис", meta: "1 шт", price: 100, art: "nigiri", palette: "tamago" },
      { id: "sushi-with-butterfish", name: "Суши с масляной рыбой", desc: "Масляная рыба, рис", meta: "1 шт", price: 100, art: "nigiri", palette: "butter" }
    ]
  },
  {
    id: "gunkan",
    title: "Гунканы",
    items: [
      { id: "gunkan-with-salmon-caviar", name: "Гункан с икрой лосося", desc: "Нори, рис, икра лосося", meta: "1 шт", price: 480, art: "gunkan", palette: "tobiko" },
      { id: "gunkan-with-red-flying-fish-roe", name: "Гункан с красной икрой летучей рыбы", desc: "Нори, рис, икра красной летучей рыбы", meta: "1 шт", price: 220, art: "gunkan", palette: "roe-red" },
      { id: "gunkan-with-orange-flying-fish-roe", name: "Гункан с оранжевой икрой летучей рыбы", desc: "Нори, рис, икра оранжевой летучей рыбы", meta: "1 шт", price: 220, art: "gunkan", palette: "roe-orange" },
      { id: "gunkan-with-green-flying-fish-roe", name: "Гункан с зеленой икрой летучей рыбы", desc: "Нори, рис, икра зеленой летучей рыбы", meta: "1 шт", price: 220, art: "gunkan", palette: "roe-green" },
      { id: "gunkan-with-black-flying-fish-roe", name: "Гункан с черной икрой летучей рыбы", desc: "Нори, рис, икра черной летучей рыбы", meta: "1 шт", price: 220, art: "gunkan", palette: "roe-black" },
      { id: "gunkan-with-chuka", name: "Гункан с чукой", desc: "Нори, рис, чука, соус чука", meta: "1 шт", price: 100, art: "gunkan", palette: "veg" },
      { id: "gunkan-with-smoked-chicken", name: "Гункан с копченой курицей", desc: "Нори, рис, копченая курица", meta: "1 шт", price: 100, art: "gunkan", palette: "baked" },
      { id: "gunkan-with-salmon", name: "Гункан с лососем", desc: "Нори, рис, лосось", meta: "1 шт", price: 160, art: "gunkan", palette: "salmon" },
      { id: "gunkan-with-eel", name: "Гункан с угрем", desc: "Нори, рис, угорь, унаги, кунжут", meta: "1 шт", price: 260, art: "gunkan", palette: "eel" },
      { id: "gunkan-with-shrimps", name: "Гункан с креветками", desc: "Нори, рис, креветки", meta: "1 шт", price: 140, art: "gunkan", palette: "shrimp" },
      { id: "gunkan-with-tuna", name: "Гункан с тунцом", desc: "Нори, рис, тунец", meta: "1 шт", price: 140, art: "gunkan", palette: "tuna" },
      { id: "gunkan-with-tamago", name: "Гункан с тамаго", desc: "Нори, рис, тамаго, унаги, кунжут", meta: "1 шт", price: 130, art: "gunkan", palette: "tamago" },
      { id: "butterfish-gunkan", name: "Гункан с масляной рыбой", desc: "Нори, рис, масляная рыба", meta: "1 шт", price: 130, art: "gunkan", palette: "butter" },
      { id: "spicy-salmon-gunkan", name: "Гункан с острым лососем", desc: "Нори, рис, лосось, острый соус", meta: "1 шт", price: 180, art: "gunkan", palette: "salmon", tags: ["spicy"] },
      { id: "spice-eel-gunkan", name: "Гункан с острым угрем", desc: "Нори, рис, острый соус, угорь", meta: "1 шт", price: 240, art: "gunkan", palette: "eel", tags: ["spicy"] },
      { id: "spicy-shrimps-gunkan", name: "Гункан с острыми креветками", desc: "Нори, рис, острый соус, креветки", meta: "1 шт", price: 160, art: "gunkan", palette: "shrimp", tags: ["spicy"] },
      { id: "spicy-tuna-gunkan", name: "Гункан с острым тунцом", desc: "Нори, рис, острый соус, тунец", meta: "1 шт", price: 160, art: "gunkan", palette: "tuna", tags: ["spicy"] },
      { id: "spicy-butterfish-gunkan", name: "Гункан с острой масляной рыбой", desc: "Нори, рис, острый соус, масляная рыба", meta: "1 шт", price: 140, art: "gunkan", palette: "butter", tags: ["spicy"] },
      { id: "spicy-smoked-chicken-gunkan", name: "Гункан с острой копченой курицей", desc: "Нори, рис, острый соус, копчёная курица", meta: "1 шт", price: 110, art: "gunkan", palette: "baked", tags: ["spicy"] }
    ]
  },
  {
    id: "sashimi",
    title: "Сашими",
    items: [
      { id: "sake-sashimi", name: "Сяке сашими", desc: "Лосось", meta: "5 шт", price: 880, art: "sashimi", palette: "salmon" },
      { id: "teka-sashimi", name: "Тека сашими", desc: "Тунец", meta: "5 шт", price: 720, art: "sashimi", palette: "tuna" },
      { id: "ebi-sashimi", name: "Эби сашими", desc: "Креветка", meta: "5 шт", price: 640, art: "sashimi", palette: "shrimp" },
      { id: "unagi-sashimi", name: "Унаги сашими", desc: "Угорь, унаги, кунжут", meta: "5 шт", price: 960, art: "sashimi", palette: "eel" },
      { id: "zen-shi-sashimi", name: "Зен ши сашими", desc: "Масляная рыба", meta: "5 шт", price: 800, art: "sashimi", palette: "butter" },
      { id: "tamago-sashimi", name: "Тамаго сашими", desc: "Тамаго, унаги, кунжут", meta: "5 шт", price: 320, art: "sashimi", palette: "tamago" },
      { id: "set-sashimi", name: "Сет сашими", desc: "Лосось, тунец, креветки, угорь", meta: "8 шт", price: 1280, art: "sashimi", palette: "mix" }
    ]
  },
  {
    id: "sandwich",
    title: "Сэндвичи и онигири",
    items: [
      { id: "salmon-sandwich", name: "Сэндвич с лососем", desc: "Нори, рис, пекинская капуста, сыр, лосось, огурец, авокадо", meta: "1 шт", price: 610, art: "sandwich", palette: "salmon" },
      { id: "shrimp-sandwich", name: "Сэндвич с креветками", desc: "Нори, рис, пекинская капуста, сыр, креветки, огурец", meta: "1 шт", price: 480, art: "sandwich", palette: "shrimp" },
      { id: "sandwich-with-tuna", name: "Сэндвич с тунцом", desc: "Нори, рис, пекинская капуста, сыр, тунец, огурец", meta: "1 шт", price: 500, art: "sandwich", palette: "tuna" },
      { id: "sandwich-with-eel", name: "Сэндвич с угрём", desc: "Нори, рис, пекинская капуста, сыр, угорь, авокадо, соус унаги", meta: "1 шт", price: 800, art: "sandwich", palette: "eel" },
      { id: "sandwich-with-fried-salmon", name: "Сэндвич с жареным лососем", desc: "Нори, рис, пекинская капуста, сыр, жареный лосось, огурец", meta: "1 шт", price: 800, art: "sandwich", palette: "salmon" },
      { id: "sandwich-with-crab-sticks", name: "Сэндвич с крабовыми палочками", desc: "Нори, рис, пекинская капуста, сыр, крабовые палочки, огурец", meta: "1 шт", price: 480, art: "sandwich", palette: "tobiko" },
      { id: "sandwich-with-vegetables", name: "Сэндвич с овощами", desc: "Нори, рис, пекинская капуста, сыр, огурец, авокадо, перец", meta: "1 шт", price: 400, art: "sandwich", palette: "veg", tags: ["kids"] },
      { id: "sandwich-with-vegetables-in-tempura", name: "Сэндвич темпура с овощами", desc: "Нори, рис, пекинская капуста, сыр, чука, огурец, авокадо, ореховый соус, кляр, панко", meta: "1 шт", price: 460, art: "sandwich", palette: "veg", tags: ["kids"] },
      { id: "tempura-sandwich-with-crab-sticks", name: "Сэндвич темпура с крабовыми палочками", desc: "Нори, рис, пекинская капуста, сыр, крабовые палочки, огурец, унаги соус, кляр, панко", meta: "1 шт", price: 540, art: "sandwich", palette: "tobiko" },
      { id: "tempura-sandwich-with-tuna", name: "Сэндвич темпура с тунцом", desc: "Нори, рис, пекинская капуста, сыр, тунец, огурец, унаги соус, кляр, панко", meta: "1 шт", price: 560, art: "sandwich", palette: "tuna" },
      { id: "tempura-sandwich-with-shrimp", name: "Сэндвич темпура с креветками", desc: "Нори, рис, пекинская капуста, сыр, креветки, огурец, унаги соус, кляр, панко", meta: "1 шт", price: 540, art: "sandwich", palette: "shrimp" },
      { id: "tempura-sandwich-with-salmon", name: "Сэндвич темпура с лососем", desc: "Нори, рис, пекинская капуста, сыр, лосось, огурец, авокадо, унаги соус, кляр, панко", meta: "1 шт", price: 670, art: "sandwich", palette: "salmon" },
      { id: "tempura-sandwich-with-fried-salmon", name: "Сэндвич темпура с жареным лососем", desc: "Нори, рис, пекинская капуста, сыр, жареный лосось, огурец, унаги соус, кляр, панко", meta: "1 шт", price: 860, art: "sandwich", palette: "salmon" },
      { id: "tempura-sandwich-with-eel", name: "Сэндвич темпура с угрем", desc: "Нори, рис, пекинская капуста, сыр, угорь, авокадо, унаги соус, кляр, панко", meta: "1 шт", price: 860, art: "sandwich", palette: "eel" },
      { id: "onigiri-with-vegetable", name: "Онигири с овощами", desc: "Рис, нори, перец, руккола, авокадо, соус", meta: "1 шт", price: 160, art: "onigiri", palette: "veg" },
      { id: "onigiri-with-tomago", name: "Онигири с тамаго", desc: "Рис, нори, авокадо, тамаго, соус унаги", meta: "1 шт", price: 160, art: "onigiri", palette: "tamago" },
      { id: "onigiri-with-crab-sticks", name: "Онигири с крабовыми палочками", desc: "Рис, нори, крабовая палочка, соус для запекания", meta: "1 шт", price: 160, art: "onigiri", palette: "tobiko" },
      { id: "onigiri-with-smoked-chicken", name: "Онигири с копченой курицей", desc: "Рис, нори, копченая курица, соус тартар", meta: "1 шт", price: 160, art: "onigiri", palette: "baked" },
      { id: "onigiri-with-shrimp", name: "Онигири с креветками", desc: "Рис, нори, огурец, майонез, креветки", meta: "1 шт", price: 190, art: "onigiri", palette: "shrimp" },
      { id: "onigiri-with-salmon", name: "Онигири с лососем", desc: "Рис, нори, авокадо, сыр, лосось", meta: "1 шт", price: 260, art: "onigiri", palette: "salmon" },
      { id: "onigiri-with-tuna", name: "Онигири с тунцом", desc: "Рис, нори, тунец, стружка тунца, соус спайси", meta: "1 шт", price: 290, art: "onigiri", palette: "tuna" },
      { id: "onigiri-with-fried-salmon", name: "Онигири с жареным лососем", desc: "Рис, нори, лук-порей, жареный лосось, соус спайси", meta: "1 шт", price: 350, art: "onigiri", palette: "salmon" },
      { id: "onigiri-with-eel", name: "Онигири с угрем", desc: "Рис, нори, авокадо, угорь, соус унаги", meta: "1 шт", price: 370, art: "onigiri", palette: "eel" },
      { id: "onigiri-with-salmon-roe", name: "Онигири с икрой лосося", desc: "Рис, нори, сыр, икра лосося", meta: "1 шт", price: 580, art: "onigiri", palette: "tobiko" }
    ]
  },
  {
    id: "snacks",
    title: "Закуски и салаты",
    items: [
      { id: "shrimps-tempura", name: "Креветки в темпуре", desc: "Креветки в кляре темпура, соус", meta: "1 порция", price: 640, art: "plate", palette: "shrimp", tags: ["hit"] },
      { id: "roasted-mussels", name: "Мидии в духовке", desc: "Мидии, запечённые с соусом", meta: "1 порция", price: 800, art: "plate", palette: "veg" },
      { id: "edamame", name: "Эдамаме", desc: "Соевые бобы на пару, морская соль", meta: "1 порция", price: 460, art: "plate", palette: "edamame" },
      { id: "salad-with-avocado", name: "Салат с авокадо", desc: "Руккола, пекинская капуста, авокадо, помидоры черри, петрушка, кунжут, соус", meta: "1 порция", price: 510, art: "salad", palette: "veg", tags: ["kids"] },
      { id: "salad-avocado-with-salmon", name: "Салат с авокадо и лососем", desc: "Руккола, пекинская капуста, авокадо, лосось, помидоры черри, кунжут, соус", meta: "1 порция", price: 720, art: "salad", palette: "salmon" },
      { id: "salad-avocado-with-shrimps", name: "Салат с авокадо и креветками", desc: "Руккола, пекинская капуста, креветки, авокадо, помидоры черри, петрушка, кунжут, соус", meta: "1 порция", price: 660, art: "salad", palette: "shrimp" },
      { id: "ebi-fried", name: "Эби жареный", desc: "Креветка, соя, терияки, кунжут, укроп", meta: "1 порция", price: 2060, art: "plate", palette: "shrimp" },
      { id: "ebi-fried-spicy", name: "Эби жареный острый", desc: "Креветка, соя, терияки, кунжут, укроп, чилли", meta: "1 порция", price: 2100, art: "plate", palette: "shrimp", tags: ["spicy"] },
      { id: "mussel-salad", name: "Салат с мидиями", desc: "Мидии, пекинская капуста, перец, огурец, майонез, соя, масло, кунжут", meta: "1 порция", price: 380, art: "salad", palette: "veg" },
      { id: "shrimp-salad", name: "Салат с креветками", desc: "Креветки, перец, соя, масло, кунжут, майонез, пекинская капуста, морковь", meta: "1 порция", price: 510, art: "salad", palette: "shrimp" },
      { id: "salad-with-smoked-chicken", name: "Салат с копченой курицей", desc: "Копченая курица, майонез, пекинская капуста, соя, масло, кунжут, сухарики, помидоры черри, укроп, сыр пармезан", meta: "1 порция", price: 480, art: "salad", palette: "baked" },
      { id: "eel-salad", name: "Салат с угрем", desc: "Угорь, пекинская капуста, перец, огурец, унаги, соя, кунжут", meta: "1 порция", price: 780, art: "salad", palette: "eel" },
      { id: "chuka-salad", name: "Салат чука", desc: "Чука, ореховый соус, кунжут", meta: "1 порция", price: 320, art: "salad", palette: "veg" },
      { id: "edamame-with-chili", name: "Эдамаме с чили", desc: "Соевые бобы, перец чили, морская соль", meta: "1 порция", price: 480, art: "plate", palette: "edamame", tags: ["spicy"] },
      { id: "mussels-in-cheese-sauce", name: "Мидии в сырном соусе", desc: "Мидии, сыр рокфор, сливочное масло, сливки, вино, розмарин, листья салата, оливковое масло, черный перец, соль, петрушка", meta: "1 порция", price: 740, art: "plate", palette: "veg" },
      { id: "chicken-nuggets-in-spicy-sauce", name: "Куриные наггетсы в остром соусе", desc: "Свежая курица, фирменный острый соус, соя, кунжут, зеленый лук", meta: "1 порция", price: 590, art: "plate", palette: "baked" },
      { id: "salad-with-chicken-and-mixed-cabbage", name: "Салат с курицей и микс-капустой", desc: "Микс капуста, авокадо, фирменный соус, кинза, куриные наггетсы, кунжут", meta: "1 порция", price: 560, art: "salad", palette: "baked" },
      { id: "caesar-salad-with-chicken", name: "Салат Цезарь с курицей", desc: "Куриные наггетсы, салат айсберг, авокадо, заправка Цезарь, сухари, пармезан", meta: "1 порция", price: 670, art: "salad", palette: "baked" },
      { id: "caesar-salad-with-shrimp", name: "Салат Цезарь с креветками", desc: "Креветки, салат айсберг, авокадо, заправка Цезарь, сухари, пармезан", meta: "1 порция", price: 780, art: "salad", palette: "shrimp" },
      { id: "chicken-nuggetss", name: "Куриные наггетсы", desc: "Свежая курица", meta: "1 порция", price: 450, art: "plate", palette: "baked" },
      { id: "fried-spring-rolls-with-shrimp", name: "Жареные спринг-роллы с креветками", desc: "Креветки, кунжут, лук порей, кинза, морковь, китайская капуста, свежий имбирь, чеснок", meta: "1 порция", price: 430, art: "plate", palette: "shrimp" },
      { id: "fried-spring-rolls-with-salmon", name: "Жареные спринг-роллы с лососем", desc: "Лосось, лук-порей, болгарский перец, кориандр, лимонный сок", meta: "1 порция", price: 480, art: "plate", palette: "salmon" },
      { id: "salad-with-shrimp-and-spinach", name: "Салат с креветками и шпинатом", desc: "Креветки, авокадо, шпинат, ореховый соус, кориандр, оливковое масло, кунжут", meta: "1 порция", price: 780, art: "salad", palette: "shrimp" },
      { id: "vitamin-salad-with-quinoa", name: "Витаминный салат с киноа", desc: "Кукуруза, маслины, оливки, помидоры черри, авокадо, шпинат, фирменный соус, руккола, огурец, киноа", meta: "1 порция", price: 620, art: "salad", palette: "baked" },
      { id: "shrimp-dynamite", name: "Креветки динамит", desc: "Соус «Динамит», креветки, фунчоза, кунжут", meta: "1 порция", price: 690, art: "plate", palette: "shrimp", tags: ["spicy"] },
      { id: "shrimp-wasabi", name: "Креветки васаби", desc: "Соус васаби, креветки, фунчоза, кунжут", meta: "1 порция", price: 670, art: "plate", palette: "shrimp", tags: ["spicy"] },
      { id: "shrimp-in-truffle-sauce", name: "Креветки в трюфельном соусе", desc: "Тигровые креветки, фунчоза, трюфельный соус", meta: "1 порция", price: 720, art: "plate", palette: "shrimp" },
      { id: "shrimp-in-cheese-sauce", name: "Креветки в сырном соусе", desc: "Тигровые креветки, сырный соус, шпинат", meta: "1 порция", price: 940, art: "plate", palette: "shrimp" },
      { id: "rice-bowl-with-shrimp", name: "Рисовый боул с креветками", desc: "Рис, тигровые креветки, соус «Динамит»", meta: "1 порция", price: 700, art: "plate", palette: "shrimp" },
      { id: "squid-frito", name: "Кальмар фрито", desc: "Кальмар в хрустящей панировке, соус «Динамит»", meta: "1 порция", price: 620, art: "plate", palette: "veg" },
      { id: "curry-with-chicken-and-rice", name: "Карри с курицей и рисом", desc: "Курица, рис, японский соус карри", meta: "1 порция", price: 510, art: "plate", palette: "baked" },
      { id: "chicken-katsu-with-rice", name: "Курица кацу с рисом", desc: "Курица в панировке панко, рис, соус кацу", meta: "1 порция", price: 480, art: "plate", palette: "baked" },
      { id: "tokpok-with-shrimp", name: "Токпокки с креветками", desc: "Рисовые клёцки токпокки, креветки, острый соус", meta: "1 порция", price: 720, art: "plate", palette: "shrimp" },
      { id: "tokpok-with-chicken", name: "Токпокки с курицей", desc: "Рисовые клёцки токпокки, курица, острый соус", meta: "1 порция", price: 620, art: "plate", palette: "baked" },
      { id: "tataki-tuna", name: "Татаки тунец", desc: "Слегка обжаренный тунец, кунжут, соус", meta: "1 порция", price: 620, art: "plate", palette: "tuna" },
      { id: "tataki-salmon", name: "Татаки лосось", desc: "Слегка обжаренный лосось, кунжут, соус", meta: "1 порция", price: 720, art: "plate", palette: "salmon" },
      { id: "salmon-tartare", name: "Тартар из лосося", desc: "Лосось, авокадо, оливковое масло", meta: "1 порция", price: 830, art: "plate", palette: "salmon" }
    ]
  },
  {
    id: "gyoza",
    title: "Гёдза",
    items: [
      { id: "chicken-yaki-gyoza", name: "Яки гёдза с курицей", desc: "Куриная грудка, тесто для гёдза, зелёный лук, кунжут", meta: "4 шт", price: 400, art: "gyoza", palette: "baked" },
      { id: "chicken-and-mushroom-yaki-gyoza", name: "Яки гёдза с курицей и грибами", desc: "Куриная грудка, грибы, тесто для гёдза, зелёный лук, кунжут", meta: "4 шт", price: 370, art: "gyoza", palette: "baked" },
      { id: "shrimp-yaki-gyoza", name: "Яки гёдза с креветками", desc: "Креветки, тесто для гёдза, зелёный лук, кунжут", meta: "4 шт", price: 530, art: "gyoza", palette: "shrimp" },
      { id: "salmon-and-shrimp-yaki-gyoza", name: "Яки гёдза с лососем и креветками", desc: "Лосось, креветки, тесто для гёдза, зелёный лук, кунжут", meta: "4 шт", price: 640, art: "gyoza", palette: "salmon" },
      { id: "musi-gyoza-with-salmon-and-shrimp", name: "Муси гёдза с лососем и креветками", desc: "Лосось, креветки, тесто для гёдза, зелёный лук, кунжут", meta: "4 шт", price: 620, art: "gyoza", palette: "salmon" },
      { id: "musi-gyoza-with-chicken", name: "Муси гёдза с курицей", desc: "Куриная грудка, тесто для гёдза, зелёный лук, кунжут", meta: "4 шт", price: 380, art: "gyoza", palette: "baked" },
      { id: "musi-gyoza-with-shrimp", name: "Муси гёдза с креветками", desc: "Креветки, тесто для гёдза, зелёный лук, кунжут", meta: "4 шт", price: 510, art: "gyoza", palette: "shrimp" },
      { id: "musi-gyoza-with-chicken-and-mushrooms", name: "Муси гёдза с курицей и грибами", desc: "Куриная грудка, грибы, тесто для гёдза, зелёный лук, кунжут", meta: "4 шт", price: 350, art: "gyoza", palette: "baked" }
    ]
  },
  {
    id: "bao",
    title: "Бао",
    items: [
      { id: "chicken-bao", name: "Бао с курицей", desc: "Авокадо, курица кацу, капуста, зелёный лук, булочка бао, фирменный соус", meta: "2 шт", price: 500, art: "bao", palette: "baked" },
      { id: "veal-bao", name: "Бао с телятиной", desc: "Телячьи щёчки, соус унаги, зелёный лук, соус динамит, булочка бао, перец Рамиро", meta: "2 шт", price: 770, art: "bao", palette: "baked" },
      { id: "shrimp-bao", name: "Бао с креветками", desc: "Креветки в темпуре, огурец, авокадо, соус унаги, ореховый соус, зелёный лук, булочка бао", meta: "2 шт", price: 560, art: "bao", palette: "shrimp" }
    ]
  },
  {
    id: "soups",
    title: "Супы",
    items: [
      { id: "soimano-soup", name: "Соймано суп", desc: "Соус кимчи, соя, вакаме, кунжут, зеленый лук, хондаши", meta: "1 порция", price: 160, art: "soup", palette: "tomyam", tags: ["spicy"] },
      { id: "soimano-soup-with-shrimps", name: "Соймано суп с креветками", desc: "Соус кимчи, креветки, соя, вакаме, кунжут, зеленый лук, хондаши", meta: "1 порция", price: 480, art: "soup", palette: "tomyam", tags: ["spicy"] },
      { id: "soymano-soup-with-salmon", name: "Соймано суп с лососем", desc: "Соус кимчи, лосось, соя, вакаме, кунжут, зеленый лук, хондаши", meta: "1 порция", price: 640, art: "soup", palette: "tomyam", tags: ["spicy"] },
      { id: "soimano-soup-with-tuna", name: "Соймано суп с тунцом", desc: "Соус кимчи, тунец, соя, вакаме, кунжут, зеленый лук, хондаши", meta: "1 порция", price: 540, art: "soup", palette: "tomyam", tags: ["spicy"] },
      { id: "miso-soup-with-tuna", name: "Мисо суп с тунцом", desc: "Мисо, тунец, соя, вакаме, кунжут, зеленый лук, хондаши", meta: "1 порция", price: 540, art: "soup", palette: "miso" },
      { id: "miso-soup-with-salmon", name: "Мисо суп с лососем", desc: "Мисо, лосось, соя, вакаме, кунжут, зелёный лук, хондаши", meta: "1 порция", price: 640, art: "soup", palette: "miso" },
      { id: "miso-soup-with-shrimps", name: "Мисо суп с креветками", desc: "Мисо, креветки, соя, вакаме, кунжут, зеленый лук, хондаши", meta: "1 порция", price: 480, art: "soup", palette: "miso" },
      { id: "miso-soup", name: "Мисо суп", desc: "Мисо, соя, вакаме, кунжут, зеленый лук, хондаши", meta: "1 порция", price: 160, art: "soup", palette: "miso" },
      { id: "tom-yum", name: "Том Ям", desc: "Курица, рис, масло, имбирь, бульон, кокосовое молоко, лимонный сок, грибы, креветки, Хондаши, соя, перец чили, помидоры, лук, кориандр", meta: "1 порция", price: 780, art: "soup", palette: "tomyam" },
      { id: "tom-kha", name: "Том кха", desc: "Кокосовое молоко, курица, грибы, лемонграсс, лайм", meta: "1 порция", price: 560, art: "soup", palette: "cream" }
    ]
  },
  {
    id: "ramen",
    title: "Рамэн",
    items: [
      { id: "ramen-with-chicken", name: "Рамэн с курицей", desc: "Лапша рамэн, куриный бульон, куриная грудка, яйцо, чеснок, имбирь, зелёный лук, кунжут", meta: "1 порция", price: 480, art: "ramen", palette: "baked" },
      { id: "soup-with-pork", name: "Рамэн со свининой", desc: "Лапша рамэн, свиной бульон, свиная вырезка, яйцо, чеснок, имбирь, зелёный лук, кунжут", meta: "1 порция", price: 560, art: "ramen", palette: "baked" },
      { id: "soup-with-beef", name: "Рамэн с говядиной", desc: "Лапша рамэн, говяжий бульон, говядина, яйцо, чеснок, имбирь, зелёный лук, кунжут", meta: "1 порция", price: 640, art: "ramen", palette: "baked" },
      { id: "soup-with-shrimp", name: "Рамэн с креветками", desc: "Лапша рамэн, овощной бульон, креветки, яйцо, чеснок, имбирь, зелёный лук, кунжут", meta: "1 порция", price: 720, art: "ramen", palette: "shrimp" },
      { id: "peanut-paste-ramen-with-shrimp", name: "Рамэн с арахисовой пастой и креветками", desc: "Лапша рамэн, бульон с арахисовой пастой, креветки, яйцо, зелёный лук", meta: "1 порция", price: 640, art: "ramen", palette: "shrimp" },
      { id: "shoyu-ramen-with-chicken", name: "Шою рамэн с курицей", desc: "Лапша рамэн, соевый бульон шою, курица, яйцо, зелёный лук", meta: "1 порция", price: 610, art: "ramen", palette: "baked" },
      { id: "miso-ramen-with-pork", name: "Мисо рамэн со свининой", desc: "Лапша рамэн, бульон мисо, свинина, яйцо, зелёный лук", meta: "1 порция", price: 660, art: "ramen", palette: "baked" }
    ]
  },
  {
    id: "rice",
    title: "Рис",
    items: [
      { id: "rice-with-vegtables", name: "Рис с овощами", desc: "Рис, морковь, перец, масло, соя, кунжут", meta: "1 порция", price: 260, art: "wok", palette: "veg", tags: ["kids"] },
      { id: "rice-with-salmon", name: "Рис с лососем", desc: "Рис, лосось, помидоры, чеснок, соя, масло, кунжут", meta: "1 порция", price: 700, art: "wok", palette: "salmon" },
      { id: "rice-with-seafood-vegetables", name: "Рис с морепродуктами и овощами", desc: "Рис, мидии, кальмары, осьминог, креветки, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 690, art: "wok", palette: "shrimp" },
      { id: "rice-with-shrimp-vegetables", name: "Рис с креветками и овощами", desc: "Рис, креветка, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 640, art: "wok", palette: "shrimp" },
      { id: "rice-with-beef-vegetables", name: "Рис с говядиной и овощами", desc: "Рис, говядина, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 540, art: "wok", palette: "baked" },
      { id: "rice-with-pork-vegetables", name: "Рис со свининой и овощами", desc: "Рис, свинина, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 400, art: "wok", palette: "baked" },
      { id: "rice-with-chicken-vegetables", name: "Рис с курицей и овощами", desc: "Рис, куриная грудка, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 320, art: "wok", palette: "baked", tags: ["hit", "kids"] },
      { id: "rice-with-octopus", name: "Рис с осьминогом", desc: "Рис, морковь, перец, соя, терияки, кунжут, осьминог", meta: "1 порция", price: 670, art: "wok", palette: "veg" }
    ]
  },
  {
    id: "wok",
    title: "Вок",
    items: [
      { id: "rice-noodles-with-octopus", name: "Рисовая лапша с осьминогом", desc: "Рисовая лапша, морковь, перец, соя, терияки, кунжут, осьминог", meta: "1 порция", price: 700, art: "wok", palette: "veg" },
      { id: "rice-noodles-with-salmon", name: "Рисовая лапша с лососем", desc: "Рисовая лапша, лосось, помидоры, чеснок, соя, масло, кунжут", meta: "1 порция", price: 770, art: "wok", palette: "salmon" },
      { id: "rice-noodles-with-seafood-and-vegetables", name: "Рисовая лапша с морепродуктами и овощами", desc: "Рисовая лапша, мидии, кальмары, осьминог, креветки, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 720, art: "wok", palette: "shrimp" },
      { id: "rice-noodles-with-shrimp-and-vegetables", name: "Рисовая лапша с креветками и овощами", desc: "Рисовая лапша, креветка, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 670, art: "wok", palette: "shrimp" },
      { id: "rice-noodles-with-beef-and-vegetables", name: "Рисовая лапша с говядиной и овощами", desc: "Рисовая лапша, говядина, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 590, art: "wok", palette: "baked" },
      { id: "rice-noodles-with-pork-and-vegetables", name: "Рисовая лапша со свининой и овощами", desc: "Рисовая лапша, свинина, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 450, art: "wok", palette: "baked" },
      { id: "rice-noodles-with-chicken-and-vegetables", name: "Рисовая лапша с курицей и овощами", desc: "Рисовая лапша, куриная грудка, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 370, art: "wok", palette: "baked" },
      { id: "rice-noodles-with-vegetables", name: "Рисовая лапша с овощами", desc: "Рисовая лапша, морковь, перец, масло, соя, кунжут", meta: "1 порция", price: 290, art: "wok", palette: "veg" },
      { id: "egg-noodles-with-octopus", name: "Яичная лапша с осьминогом", desc: "Яичная лапша, морковь, перец, соя, терияки, кунжут, осьминог", meta: "1 порция", price: 700, art: "wok", palette: "veg" },
      { id: "egg-noodles-with-salmon", name: "Яичная лапша с лососем", desc: "Яичная лапша, лосось, помидоры, чеснок, соя, масло, кунжут", meta: "1 порция", price: 770, art: "wok", palette: "salmon" },
      { id: "egg-noodles-with-seafood-and-vegetables", name: "Яичная лапша с морепродуктами и овощами", desc: "Яичная лапша, мидии, кальмары, осьминог, креветки, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 720, art: "wok", palette: "shrimp" },
      { id: "egg-noodles-with-shrimp-and-vegetables", name: "Яичная лапша с креветками и овощами", desc: "Яичная лапша, креветка, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 670, art: "wok", palette: "shrimp" },
      { id: "egg-noodles-with-beef-and-vegetables", name: "Яичная лапша с говядиной и овощами", desc: "Яичная лапша, говядина, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 590, art: "wok", palette: "baked" },
      { id: "egg-noodles-with-pork-and-vegetables", name: "Яичная лапша со свининой и овощами", desc: "Яичная лапша, свинина, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 450, art: "wok", palette: "baked" },
      { id: "egg-noodles-with-chicken-and-vegetables", name: "Яичная лапша с курицей и овощами", desc: "Яичная лапша, куриная грудка, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 370, art: "wok", palette: "baked" },
      { id: "egg-noodles-with-vegetables", name: "Яичная лапша с овощами", desc: "Яичная лапша, морковь, перец, масло, соя, кунжут", meta: "1 порция", price: 290, art: "wok", palette: "veg" },
      { id: "wheat-noodles-with-octopus", name: "Лапша пшеничная с осьминогом", desc: "Лапша пшеничная, морковь, перец, соя, терияки, кунжут, осьминог", meta: "1 порция", price: 700, art: "wok", palette: "veg" },
      { id: "wheat-noodles-with-salmon", name: "Пшеничная лапша с лососем", desc: "Пшеничная лапша, лосось, помидоры, чеснок, соя, масло, кунжут", meta: "1 порция", price: 770, art: "wok", palette: "salmon" },
      { id: "wheat-noodles-with-seafood-and-vegetables", name: "Пшеничная лапша с морепродуктами и овощами", desc: "Пшеничная лапша, мидии, кальмары, осьминог, креветки, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 720, art: "wok", palette: "shrimp" },
      { id: "wheat-noodles-with-shrimp-and-vegetables", name: "Пшеничная лапша с креветками и овощами", desc: "Пшеничная лапша, креветка, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 670, art: "wok", palette: "shrimp" },
      { id: "wheat-noodles-with-beef-and-vegetables", name: "Пшеничная лапша с говядиной и овощами", desc: "Пшеничная лапша, говядина, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 590, art: "wok", palette: "baked" },
      { id: "wheat-noodles-with-pork-and-vegetables", name: "Пшеничная лапша со свининой и овощами", desc: "Пшеничная лапша, свинина, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 450, art: "wok", palette: "baked" },
      { id: "wheat-noodles-with-chicken-and-vegetables", name: "Пшеничная лапша с курицей и овощами", desc: "Пшеничная лапша, куриная грудка, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 370, art: "wok", palette: "baked" },
      { id: "wheat-noodles-with-vegetables", name: "Пшеничная лапша с овощами", desc: "Пшеничная лапша, морковь, перец, масло, соя, кунжут", meta: "1 порция", price: 290, art: "wok", palette: "veg" },
      { id: "buckwheat-noodles-with-octopus", name: "Гречневая лапша с осьминогом", desc: "Лапша гречневая, морковь, перец, соя, терияки, кунжут, осьминог", meta: "1 порция", price: 700, art: "wok", palette: "veg" },
      { id: "buckwheat-noodles-with-salmon", name: "Гречневая лапша с лососем", desc: "Гречневая лапша, лосось, помидоры, чеснок, соя, масло, кунжут", meta: "1 порция", price: 770, art: "wok", palette: "salmon" },
      { id: "buckwheat-noodles-with-seafood-and-vegetables", name: "Гречневая лапша с морепродуктами и овощами", desc: "Гречневая лапша, мидии, кальмары, осьминог, креветки, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 720, art: "wok", palette: "shrimp" },
      { id: "buckwheat-noodles-with-shrimp-and-vegetables", name: "Гречневая лапша с креветками и овощами", desc: "Гречневая лапша, креветка, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 670, art: "wok", palette: "shrimp" },
      { id: "buckwheat-noodles-with-beef-and-vegetables", name: "Гречневая лапша с говядиной и овощами", desc: "Гречневая лапша, говядина, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 590, art: "wok", palette: "baked" },
      { id: "buckwheat-noodles-with-pork-and-vegetables", name: "Гречневая лапша со свининой и овощами", desc: "Гречневая лапша, свинина, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 450, art: "wok", palette: "baked" },
      { id: "buckwheat-noodles-with-chicken-and-vegetables", name: "Гречневая лапша с курицей и овощами", desc: "Гречневая лапша, куриная грудка, морковь, перец, масло, соя, соус терияки, кунжут", meta: "1 порция", price: 370, art: "wok", palette: "baked" },
      { id: "buckwheat-noodles-with-vegetables", name: "Гречневая лапша с овощами", desc: "Гречневая лапша, морковь, перец, масло, соя, кунжут", meta: "1 порция", price: 290, art: "wok", palette: "veg" }
    ]
  },
  {
    id: "yaki",
    title: "Яки",
    items: [
      { id: "yaki-with-salmon", name: "Яки с лососем", desc: "Лосось, соус яки", meta: "1 порция", price: 740, art: "plate", palette: "salmon" },
      { id: "yaki-with-tuna", name: "Яки с тунцом", desc: "Тунец, соус яки", meta: "1 порция", price: 580, art: "plate", palette: "tuna" },
      { id: "yaks-with-eel", name: "Яки с угрем", desc: "Угорь, соус яки", meta: "1 порция", price: 1040, art: "plate", palette: "eel" },
      { id: "yaki-with-shrimps", name: "Яки с креветками", desc: "Креветки, соус яки", meta: "1 порция", price: 480, art: "plate", palette: "shrimp" },
      { id: "yaki-set", name: "Яки сет", desc: "Лосось, тунец, рыба, креветки, соус яки", meta: "4 порции", price: 2720, art: "plate", palette: "tuna" }
    ]
  },
  {
    id: "poke",
    title: "Поке",
    items: [
      { id: "poke-with-salmon", name: "Поке с лососем", desc: "Рис, лосось, эдамаме, авокадо, чука, огурец, помидоры черри, соус", meta: "1 порция", price: 880, art: "poke", palette: "salmon" },
      { id: "poke-with-tuna", name: "Поке с тунцом", desc: "Рис, тунец, эдамаме, авокадо, чука, огурец, помидоры черри, соус", meta: "1 порция", price: 830, art: "poke", palette: "tuna" },
      { id: "poke-with-shrimps", name: "Поке с креветками", desc: "Рис, эдамаме, авокадо, чука, чука соус, ананас, помидоры черри, огурец, креветка", meta: "1 порция", price: 740, art: "poke", palette: "shrimp" },
      { id: "poke-with-smoked-chicken", name: "Поке с копченой курицей", desc: "Рис, копчёная курица, эдамаме, авокадо, чука, огурец, помидоры черри, соус", meta: "1 порция", price: 670, art: "poke", palette: "baked" },
      { id: "poke-with-vegetables", name: "Поке с овощами", desc: "Рис, эдамаме, авокадо, чука, чука соус, ананас, помидоры черри, огурец, сыр тофу", meta: "1 порция", price: 640, art: "poke", palette: "veg" }
    ]
  },
  {
    id: "desserts",
    title: "Десерты",
    items: [
      { id: "coconut-mochi", name: "Моти с кокосом", desc: "Кокосовый мусс, рисовое тесто", meta: "1 шт", price: 190, art: "mochi", palette: "coconut" },
      { id: "pistachio-mochi", name: "Моти с фисташкой", desc: "Фисташковый мусс, рисовое тесто", meta: "1 шт", price: 190, art: "mochi", palette: "matcha" },
      { id: "salted-caramel-mochi", name: "Моти с солёной карамелью", desc: "Мусс из белого шоколада, солёная карамель, рисовое тесто", meta: "1 шт", price: 190, art: "mochi", palette: "caramel" },
      { id: "mochi-set", name: "Сет моти", desc: "Моти с кокосом 1 шт., моти с фисташкой 1 шт., моти с солёной карамелью 1 шт., моти с манго-маракуйей 1 шт", meta: "4 шт", price: 770, art: "mochi", palette: "mixmochi" },
      { id: "mango-passion-fruit-mochi", name: "Моти манго-маракуйя", desc: "Мусс манго-маракуйя, рисовое тесто", meta: "1 шт", price: 190, art: "mochi", palette: "yuzu" }
    ]
  },
  {
    id: "drinks",
    title: "Напитки",
    items: [
      { id: "spring-water", name: "Вода питьевая 0,5 л", desc: "Негазированная", meta: "", price: 90, art: "drink", palette: "water" },
      { id: "mineral-jermuk", name: "Вода минеральная газированная 0,5 л", desc: "Газированная", meta: "", price: 100, art: "drink", palette: "water" },
      { id: "sprite", name: "Спрайт 0,25 л", desc: "", meta: "", price: 100, art: "drink", palette: "lime" },
      { id: "sprite-1", name: "Спрайт 0,5 л", desc: "", meta: "", price: 150, art: "drink", palette: "lime" },
      { id: "fanta", name: "Фанта 0,25 л", desc: "", meta: "", price: 100, art: "drink", palette: "orange" },
      { id: "fanta-1", name: "Фанта 0,5 л", desc: "", meta: "", price: 150, art: "drink", palette: "orange" },
      { id: "coca-cola-zero", name: "Кока-Кола Зеро 0,5 л", desc: "", meta: "", price: 150, art: "drink", palette: "cola" },
      { id: "coca-cola", name: "Кока-Кола 0,25 л", desc: "", meta: "", price: 100, art: "drink", palette: "cola" },
      { id: "coca-cola-1", name: "Кока-Кола 0,5 л", desc: "", meta: "", price: 150, art: "drink", palette: "cola" },
      { id: "yan-orange", name: "Сок апельсиновый 0,25 л", desc: "", meta: "", price: 150, art: "drink", palette: "orange" },
      { id: "yan-rose-hip-025", name: "Морс из шиповника 0,25 л", desc: "", meta: "", price: 150, art: "drink", palette: "cherry" },
      { id: "yan-mango-025", name: "Сок манго 0,25 л", desc: "", meta: "", price: 150, art: "drink", palette: "yuzu" },
      { id: "yan-cherry-025", name: "Сок вишнёвый 0,25 л", desc: "", meta: "", price: 150, art: "drink", palette: "cherry" },
      { id: "yan-red-orange-025", name: "Сок красный апельсин 0,25 л", desc: "", meta: "", price: 150, art: "drink", palette: "orange" }
    ]
  },
  {
    id: "sauces",
    title: "Соусы",
    items: [
      { id: "sweet-chili-sauce", name: "Сладкий чили-соус", desc: "", meta: "", price: 100, art: "sauce", palette: "sauce-red" },
      { id: "dynamite-sauce", name: "Соус «Динамит»", desc: "", meta: "", price: 100, art: "sauce", palette: "sauce-orange" },
      { id: "mayonnaise", name: "Майонез", desc: "", meta: "", price: 60, art: "sauce", palette: "sauce-white" },
      { id: "wasabi-sauce", name: "Соус васаби", desc: "", meta: "", price: 80, art: "sauce", palette: "sauce-green" },
      { id: "truffle-sauce", name: "Трюфельный соус", desc: "", meta: "", price: 120, art: "sauce", palette: "sauce-beige" },
      { id: "sriracha-sauce", name: "Соус шрирача", desc: "", meta: "", price: 120, art: "sauce", palette: "sauce-red" },
      { id: "tartar-sauce", name: "Соус тартар", desc: "", meta: "", price: 100, art: "sauce", palette: "sauce-white" },
      { id: "spice-sauce", name: "Спайси соус", desc: "", meta: "", price: 80, art: "sauce", palette: "sauce-orange" },
      { id: "teriyaki-sauce", name: "Соус терияки", desc: "", meta: "", price: 80, art: "sauce", palette: "sauce-dark" },
      { id: "unagi-saucee", name: "Соус унаги", desc: "", meta: "", price: 80, art: "sauce", palette: "sauce-dark" },
      { id: "kimchi-sauce-with-peanuts", name: "Соус кимчи с арахисом", desc: "", meta: "", price: 150, art: "sauce", palette: "sauce-red" },
      { id: "walnut-sauce", name: "Ореховый соус", desc: "", meta: "", price: 150, art: "sauce", palette: "sauce-beige" },
      { id: "sesame-sauce", name: "Кунжутный соус", desc: "", meta: "", price: 120, art: "sauce", palette: "sauce-beige" },
      { id: "soy-sauce", name: "Соевый соус", desc: "", meta: "", price: 80, art: "sauce", palette: "sauce-dark" },
      { id: "gingerr", name: "Имбирь маринованный", desc: "", meta: "", price: 80, art: "sauce", palette: "sauce-pink" },
      { id: "wassabi", name: "Васаби", desc: "", meta: "", price: 80, art: "sauce", palette: "sauce-green" }
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
