(function () {
  const MENU = window.ROLLEVICH_MENU;
  const CFG = window.ROLLEVICH_CONFIG;
  const STORAGE_KEY = 'rollevich-cart';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';

  const ITEMS = {};
  MENU.forEach((cat) => cat.items.forEach((it) => { ITEMS[it.id] = it; }));

  const TAGS = {
    hit: { label: 'Хит', cls: 'tag--hit' },
    new: { label: 'Новинка', cls: 'tag--new' },
    spicy: { label: 'Острое', cls: 'tag--spicy' },
    veg: { label: 'Вегетарианское', cls: 'tag--veg' },
    kids: { label: 'Детское', cls: 'tag--kids' }
  };

  // ---------- Состояние ----------
  const state = { cart: {}, promo: null, method: 'delivery' };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    Object.keys(saved.cart || {}).forEach((id) => { if (ITEMS[id]) state.cart[id] = saved.cart[id]; });
    if (saved.promo && CFG.promoCodes[saved.promo]) state.promo = saved.promo;
  } catch (e) { /* хранилище недоступно — начинаем с пустой корзины */ }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart: state.cart, promo: state.promo })); } catch (e) { /* ignore */ }
  }

  function totals() {
    let subtotal = 0, count = 0;
    Object.entries(state.cart).forEach(([id, q]) => { subtotal += ITEMS[id].price * q; count += q; });
    let rate = state.promo ? CFG.promoCodes[state.promo] : 0;
    if (state.method === 'pickup') rate = Math.max(rate, CFG.pickupDiscount);
    const discount = Math.round(subtotal * rate);
    const delivery = state.method === 'pickup' || subtotal === 0 || subtotal >= CFG.freeDeliveryFrom ? 0 : CFG.deliveryPrice;
    return { subtotal, count, discount, delivery, total: subtotal - discount + delivery };
  }

  // ---------- Меню ----------
  function renderMenu() {
    $('[data-tabs]').innerHTML = MENU.map((c, i) =>
      `<a href="#cat-${c.id}" class="tab${i === 0 ? ' is-active' : ''}" data-tab="${c.id}">${c.title}</a>`).join('');

    $('[data-menu]').innerHTML = MENU.map((c) => `
      <div class="category" id="cat-${c.id}" data-category="${c.id}">
        <h3 class="category__title">${c.title}</h3>
        <div class="grid">${c.items.map(card).join('')}</div>
      </div>`).join('');

    // иллюстрации рисуем, только когда карточка подъезжает к экрану
    const artObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target, it = ITEMS[el.dataset.art];
        el.innerHTML = it.image ? `<img src="${it.image}" alt="${it.name}" loading="lazy">` : window.renderArt(it);
        artObs.unobserve(el);
      });
    }, { rootMargin: '600px 0px' });
    $$('[data-art]').forEach((el) => artObs.observe(el));
  }

  // ---------- Поиск и фильтры ----------
  const filter = { q: '', tag: '' };

  function applyFilter() {
    const q = filter.q.trim().toLowerCase();
    let shown = 0;
    $$('[data-category]').forEach((cat) => {
      let n = 0;
      $$('.card', cat).forEach((card) => {
        const it = ITEMS[card.dataset.id];
        const ok = (!q || (it.name + ' ' + it.desc).toLowerCase().includes(q)) &&
          (!filter.tag || (it.tags || []).includes(filter.tag));
        card.hidden = !ok;
        if (ok) n++;
      });
      cat.hidden = n === 0;
      shown += n;
    });
    $('[data-menu-empty]').hidden = shown > 0;
    $$('.tab').forEach((t) => { t.hidden = $('#cat-' + t.dataset.tab).hidden; });
  }

  function card(it) {
    const tags = (it.tags || []).map((t) => `<span class="tag ${TAGS[t].cls}">${TAGS[t].label}</span>`).join('');
    const meta = it.meta || '';
    return `
      <article class="card" data-id="${it.id}">
        <div class="card__media" data-art="${it.id}"></div>
        <div class="card__tags">${tags}</div>
        <div class="card__body">
          <h4 class="card__name">${it.name}</h4>
          <p class="card__desc">${it.desc}</p>
          <div class="card__foot">
            <div>
              <span class="card__price">${rub(it.price)}</span>
              <span class="card__meta">${meta}</span>
            </div>
            <div class="card__action" data-action="${it.id}"></div>
          </div>
        </div>
      </article>`;
  }

  function actionHTML(id) {
    const q = state.cart[id] || 0;
    if (!q) return `<button class="add-btn" type="button" data-add="${id}" aria-label="Добавить в корзину">В корзину</button>`;
    return stepper(id, q);
  }

  function stepper(id, q) {
    return `<div class="stepper">
      <button type="button" data-dec="${id}" aria-label="Убрать одну">−</button>
      <span>${q}</span>
      <button type="button" data-inc="${id}" aria-label="Добавить ещё">+</button>
    </div>`;
  }

  function syncCards() {
    $$('[data-action]').forEach((el) => { el.innerHTML = actionHTML(el.dataset.action); });
  }

  // ---------- Корзина ----------
  function change(id, delta) {
    const q = (state.cart[id] || 0) + delta;
    if (q <= 0) delete state.cart[id]; else state.cart[id] = Math.min(q, 99);
    if (delta > 0 && q === 1) toast(`«${ITEMS[id].name}» в корзине`);
    save();
    render();
  }

  function renderCart() {
    const t = totals();
    const ids = Object.keys(state.cart);
    const empty = ids.length === 0;

    $$('[data-cart-sum]').forEach((el) => { el.textContent = rub(t.subtotal - t.discount); });
    const badge = $('[data-cart-count]');
    badge.textContent = t.count;
    badge.hidden = t.count === 0;
    $('[data-cart-count-text]').textContent = t.count;
    $('.cart-float').hidden = empty;

    $('[data-cart-empty]').hidden = !empty;
    $('[data-cart-extra]').hidden = empty;
    $('[data-cart-foot]').hidden = empty;

    $('[data-cart-list]').innerHTML = ids.map((id) => {
      const it = ITEMS[id];
      return `<li class="cart-item">
        <div class="cart-item__img">${it.image ? `<img src="${it.image}" alt="">` : window.renderArt(it)}</div>
        <div class="cart-item__info">
          <span class="cart-item__name">${it.name}</span>
          <span class="cart-item__meta">${it.meta || ''}</span>
          ${stepper(id, state.cart[id])}
        </div>
        <span class="cart-item__price">${rub(it.price * state.cart[id])}</span>
      </li>`;
    }).join('');

    // прогресс до бесплатной доставки
    const progress = $('[data-progress]');
    if (state.method === 'pickup') {
      progress.hidden = true;
    } else {
      progress.hidden = false;
      const left = CFG.freeDeliveryFrom - t.subtotal;
      $('[data-progress-text]').innerHTML = left > 0
        ? `До бесплатной доставки — <b>${rub(left)}</b>`
        : 'Доставка <b>бесплатная</b>';
      $('[data-progress-bar]').style.width = Math.min(100, (t.subtotal / CFG.freeDeliveryFrom) * 100) + '%';
    }

    $('[data-t-subtotal]').textContent = rub(t.subtotal);
    $('[data-t-discount-row]').hidden = !t.discount;
    $('[data-t-discount]').textContent = '−' + rub(t.discount);
    $('[data-t-delivery]').textContent = state.method === 'pickup' ? 'самовывоз' : t.delivery ? rub(t.delivery) : 'бесплатно';
    $('[data-t-total]').textContent = rub(t.total);
  }

  function render() {
    syncCards();
    renderCart();
  }

  // ---------- Шторка корзины ----------
  const drawer = $('[data-drawer]');
  const overlay = $('[data-overlay]');

  function openCart() {
    overlay.hidden = false;
    requestAnimationFrame(() => { overlay.classList.add('is-visible'); drawer.classList.add('is-open'); });
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  }

  function closeCart() {
    overlay.classList.remove('is-visible');
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { overlay.hidden = true; }, 300);
  }

  // ---------- Оформление ----------
  function fillTimes() {
    const sel = $('select[name="time"]');
    const now = new Date();
    const start = new Date(now.getTime() + 75 * 60000);
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
    const opts = ['<option>Как можно скорее</option>'];
    const end = new Date(now); end.setHours(CFG.closeHour, 0, 0, 0);
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 30 * 60000)) {
      if (d.getHours() < CFG.openHour) continue;
      const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
      opts.push(`<option>Сегодня к ${hh}:${mm}</option>`);
    }
    for (let h = CFG.openHour + 1; h < CFG.closeHour; h++) opts.push(`<option>Завтра к ${h}:00</option>`);
    sel.innerHTML = opts.join('');
  }

  function formatPhone(v) {
    let d = v.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    let out = '+7';
    if (p[0]) out += ' (' + p[0];
    if (p[0].length === 3) out += ')';
    if (p[1]) out += ' ' + p[1];
    if (p[2]) out += '-' + p[2];
    if (p[3]) out += '-' + p[3];
    return out;
  }

  function submitOrder() {
    const form = $('[data-checkout]');
    const err = $('[data-form-error]');
    const data = Object.fromEntries(new FormData(form).entries());
    const t = totals();
    $$('.field.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'));

    const invalid = [];
    if (!data.name.trim()) invalid.push('name');
    if (data.phone.replace(/\D/g, '').length !== 11) invalid.push('phone');
    if (state.method === 'delivery' && !data.address.trim()) invalid.push('address');
    invalid.forEach((n) => form.elements[n].closest('.field').classList.add('is-invalid'));

    if (invalid.length) { err.textContent = 'Заполните отмеченные поля'; return; }
    if (state.method === 'delivery' && t.subtotal < CFG.minOrder) {
      err.textContent = `Минимальная сумма доставки — ${rub(CFG.minOrder)}`;
      return;
    }
    err.textContent = '';

    const order = {
      items: Object.entries(state.cart).map(([id, q]) => ({ id, name: ITEMS[id].name, qty: q, price: ITEMS[id].price })),
      method: state.method,
      promo: state.promo,
      ...data,
      ...t
    };
    // TODO: отправка заказа (Telegram-бот / CRM / iiko). Пока просто логируем.
    console.info('Новый заказ', order);

    $('[data-modal-text]').textContent =
      `${data.name.trim()}, мы перезвоним на ${data.phone} в течение 5 минут, чтобы подтвердить заказ на ${rub(t.total)}.`;
    state.cart = {};
    state.promo = null;
    save();
    render();
    form.reset();
    state.method = 'delivery';
    syncMethod();
    closeCart();
    $('[data-modal]').hidden = false;
  }

  function syncMethod() {
    $('[data-address-field]').hidden = state.method === 'pickup';
    renderCart();
  }

  // ---------- Мелочи ----------
  let toastTimer;
  function toast(msg) {
    const el = $('[data-toast]');
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 1800);
  }

  function initScrollSpy() {
    const tabs = $('[data-tabs]');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        $$('.tab', tabs).forEach((t) => t.classList.toggle('is-active', t.dataset.tab === e.target.dataset.category));
        const active = $('.tab.is-active', tabs);
        if (active) tabs.scrollTo({ left: active.offsetLeft - 16, behavior: 'smooth' });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('[data-category]').forEach((el) => obs.observe(el));
  }

  function initReveal() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.card, .promo-card, .zone, .info-card, .values li, .section__head').forEach((el) => { el.classList.add('reveal'); obs.observe(el); });
  }

  // ---------- События ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.add) change(t.dataset.add, 1);
    else if (t.dataset.inc) change(t.dataset.inc, 1);
    else if (t.dataset.dec) change(t.dataset.dec, -1);
    else if (t.hasAttribute('data-open-cart')) openCart();
    else if (t.hasAttribute('data-close-cart')) closeCart();
    else if (t.hasAttribute('data-submit-order')) submitOrder();
    else if (t.hasAttribute('data-close-modal')) $('[data-modal]').hidden = true;
    else if (t.hasAttribute('data-burger')) {
      const open = document.body.classList.toggle('nav-open');
      t.setAttribute('aria-expanded', String(open));
    } else if (t.closest('.nav')) {
      document.body.classList.remove('nav-open');
      $('[data-burger]').setAttribute('aria-expanded', 'false');
    }
  });

  overlay.addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeCart();
    $('[data-modal]').hidden = true;
  });

  $('[data-promo-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = e.target.code.value.trim().toUpperCase();
    const msg = $('[data-promo-msg]');
    if (CFG.promoCodes[code]) {
      state.promo = code;
      msg.textContent = `Промокод применён: −${Math.round(CFG.promoCodes[code] * 100)}%`;
      msg.className = 'promo-msg is-ok';
    } else {
      state.promo = null;
      msg.textContent = 'Такого промокода нет';
      msg.className = 'promo-msg is-error';
    }
    save();
    renderCart();
  });

  $$('input[name="method"]').forEach((r) => r.addEventListener('change', () => {
    state.method = r.value;
    syncMethod();
  }));

  $('[data-search]').addEventListener('input', (e) => { filter.q = e.target.value; applyFilter(); });
  $$('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter.tag = filter.tag === b.dataset.filter ? '' : b.dataset.filter;
    $$('[data-filter]').forEach((x) => x.classList.toggle('is-active', x.dataset.filter === filter.tag));
    applyFilter();
  }));

  const phone = $('input[name="phone"]');
  phone.addEventListener('input', () => { phone.value = formatPhone(phone.value); });
  phone.addEventListener('focus', () => { if (!phone.value) phone.value = '+7 '; });

  const header = $('.header');
  window.addEventListener('scroll', () => header.classList.toggle('is-scrolled', window.scrollY > 40), { passive: true });

  // ---------- Старт ----------
  $('[data-year]').textContent = new Date().getFullYear();
  $('[data-hero-art]').innerHTML = window.renderHeroArt();
  renderMenu();
  fillTimes();
  render();
  if (state.promo) {
    const msg = $('[data-promo-msg]');
    msg.textContent = `Промокод ${state.promo} применён`;
    msg.className = 'promo-msg is-ok';
  }
  initScrollSpy();
  initReveal();
})();
