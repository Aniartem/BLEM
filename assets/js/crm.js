/*
 * CRM РОЛЛЕВИЧ: заказы с сайта в реальном времени и база клиентов.
 * Монтируется в <div id="crm">. На общей странице открывается по адресу …#crm.
 */
(function () {
  const root = document.getElementById('crm');
  if (!root) return;
  const Store = window.RollevichStore;
  const MENU = window.ROLLEVICH_MENU || [];

  const STATUSES = [
    { id: 'new', title: 'Новые', next: 'Принять' },
    { id: 'accepted', title: 'Приняты', next: 'На кухню' },
    { id: 'cooking', title: 'Готовятся', next: 'Передать курьеру' },
    { id: 'delivering', title: 'В пути', next: 'Выполнен' },
    { id: 'done', title: 'Выполнены' },
    { id: 'cancelled', title: 'Отменены' }
  ];
  const STATUS = Object.fromEntries(STATUSES.map((s, i) => [s.id, { ...s, index: i }]));
  const FLOW = ['new', 'accepted', 'cooking', 'delivering', 'done'];
  const BOARD = ['new', 'accepted', 'cooking', 'delivering', 'done'];

  const state = {
    orders: [],
    view: 'board',
    q: '',
    historyFilter: 'all',
    openId: null,
    openClient: null,
    confirmCancel: false,
    sound: false,
    seen: null,
    fresh: new Set(),
    kind: null,
    error: '',
    user: null,
    needLogin: false,
    loginError: '',
    unsubscribe: null
  };
  try { state.sound = localStorage.getItem('rollevich-crm-sound') === '1'; } catch (e) { /* ignore */ }

  // ---------- Утилиты ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = (n) => Math.round(n || 0).toLocaleString('ru-RU') + ' ₽';
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (t) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dateShort = (t) => {
    const d = new Date(t), today = new Date();
    if (d.toDateString() === today.toDateString()) return 'сегодня ' + hhmm(t);
    const y = new Date(today); y.setDate(today.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'вчера ' + hhmm(t);
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' ' + hhmm(t);
  };
  const ago = (t) => {
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return m + ' мин';
    const h = Math.floor(m / 60);
    return h < 24 ? h + ' ч ' + (m % 60) + ' мин' : Math.floor(h / 24) + ' дн';
  };
  const digits = (p) => String(p || '').replace(/\D/g, '');
  const isToday = (t) => new Date(t).toDateString() === new Date().toDateString();
  const plural = (n, a, b, c) => {
    const m10 = n % 10, m100 = n % 100;
    return n + ' ' + (m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c);
  };
  const itemsLine = (o) => (o.items || []).map((i) => i.name + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ');
  const byId = (id) => state.orders.find((o) => o.id === id);

  // ---------- Значки (линейные, в духе SF Symbols) ----------
  const ICONS = {
    tray: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    badge: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
    site: '<path d="M7 17 17 7M8 7h9v9"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 13 2 2 4-4"/>'
  };
  const icon = (name) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  const ROLE_TEXT = { manager: 'Управляющий', admin: 'Администратор', cook: 'Повар' };
  const TITLES = { board: 'Заказы', history: 'Архив', clients: 'Клиенты' };

  // ---------- Каркас: боковая панель + рабочая область ----------
  root.innerHTML = `
    <div class="crm">
      <aside class="crm-side" data-side>
        <div class="crm-brand"><span class="crm-mark">Р</span><span><b>РОЛЛЕВИЧ</b><small>CRM</small></span></div>
        <nav class="crm-tabs crm-nav" role="tablist" aria-label="Разделы">
          <div class="crm-nav__group" data-group="Продажи">
            <p class="crm-nav__label">Продажи</p>
            <button type="button" data-view="board" role="tab">${icon('tray')}<span>Заказы</span><span class="crm-count" data-new-count hidden></span></button>
            <button type="button" data-view="history" role="tab">${icon('clock')}<span>Архив</span></button>
            <button type="button" data-view="clients" role="tab">${icon('people')}<span>Клиенты</span></button>
          </div>
        </nav>
        <div class="crm-side__foot">
          <button type="button" class="crm-switch" data-sound role="switch" aria-checked="false"><span>Звук новых заказов</span><i aria-hidden="true"></i></button>
          <div class="crm-user" data-user hidden></div>
        </div>
      </aside>
      <div class="crm-shade" data-side-close hidden></div>
      <div class="crm-content">
        <header class="crm-top">
          <button type="button" class="crm-icon-btn crm-menu" data-side-open aria-label="Разделы">${icon('sidebar')}</button>
          <div class="crm-heading">
            <h1 data-title>Заказы</h1>
            <p class="crm-status" data-conn></p>
          </div>
          <div class="crm-tools">
            <label class="crm-search">${icon('search')}<input id="crm-search" type="search" placeholder="Поиск: №, имя, телефон" data-q></label>
            <button type="button" class="crm-btn" data-compose-open>${icon('plus')}<span>Новый заказ</span></button>
          </div>
        </header>
        <section class="crm-stats" data-stats></section>
        <main class="crm-main" data-main></main>
      </div>
      <div class="crm-overlay" data-overlay hidden></div>
      <aside class="crm-drawer" data-drawer aria-hidden="true"></aside>
      <div class="crm-compose" data-compose hidden></div>
      <div class="crm-toast" data-toast role="status"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);

  // ---------- Сводка ----------
  function renderStats() {
    const today = state.orders.filter((o) => isToday(o.createdAt));
    const paid = today.filter((o) => o.status !== 'cancelled');
    const revenue = paid.reduce((s, o) => s + (o.total || 0), 0);
    const active = state.orders.filter((o) => ['new', 'accepted', 'cooking', 'delivering'].includes(o.status));
    const waiting = state.orders.filter((o) => o.status === 'new');
    const oldest = waiting.length ? Math.max(...waiting.map((o) => Date.now() - o.createdAt)) : 0;
    $('[data-stats]').innerHTML = `
      <div class="stat"><span>Заказов сегодня</span><b>${today.length}</b>${active.length ? `<em class="muted">в работе ${active.length}</em>` : ''}</div>
      <div class="stat"><span>Выручка сегодня</span><b>${rub(revenue)}</b></div>
      <div class="stat"><span>Средний чек</span><b>${paid.length ? rub(revenue / paid.length) : '—'}</b></div>
      <div class="stat ${oldest > 5 * 60000 ? 'stat--alert' : ''}"><span>Ждут ответа</span><b>${waiting.length}</b>${waiting.length ? `<em>дольше всех ${ago(Date.now() - oldest)}</em>` : ''}</div>`;
    const c = $('[data-new-count]');
    c.hidden = !waiting.length;
    c.textContent = waiting.length;
  }

  // ---------- Фильтр поиска ----------
  function matches(o) {
    const q = state.q.trim().toLowerCase();
    if (!q) return true;
    const qd = digits(q);
    return String(o.number).includes(q) || (o.name || '').toLowerCase().includes(q) ||
      (qd.length >= 3 && digits(o.phone).includes(qd)) || (o.address || '').toLowerCase().includes(q);
  }

  // ---------- Доска ----------
  function card(o) {
    const st = STATUS[o.status] || STATUS.new;
    const late = o.status === 'new' && Date.now() - o.createdAt > 5 * 60000;
    return `
      <article class="ocard ${state.fresh.has(o.id) ? 'is-fresh' : ''} ${late ? 'is-late' : ''}" data-open="${esc(o.id)}" tabindex="0">
        <div class="ocard__top">
          <b class="ocard__num">№ ${esc(o.number)}</b>
          <span class="ocard__time" title="${esc(dateShort(o.createdAt))}">${hhmm(o.createdAt)} · ${ago(o.createdAt)}</span>
        </div>
        <div class="ocard__who">${o.source === 'phone' ? '<span class="pill pill--phone">Телефон</span> ' : ''}${esc(o.name)} <span>${esc(o.phone)}</span></div>
        <div class="ocard__where">${o.method === 'pickup' ? '<span class="pill pill--pickup">Самовывоз</span>' : esc(o.address)}</div>
        ${o.time && o.time !== 'Как можно скорее' ? `<div class="ocard__when">${esc(o.time)}</div>` : ''}
        <div class="ocard__items">${esc(itemsLine(o))}</div>
        <div class="ocard__foot">
          <b>${rub(o.total)}</b>
          ${st.next ? `<button type="button" class="crm-btn crm-btn--small" data-advance="${esc(o.id)}">${st.next} →</button>` : ''}
        </div>
      </article>`;
  }

  function renderBoard() {
    const list = state.orders.filter(matches);
    const cols = BOARD.map((sid) => {
      let items = list.filter((o) => o.status === sid);
      if (sid === 'done') items = items.filter((o) => isToday(o.createdAt));
      if (sid !== 'done') items = items.slice().sort((a, b) => a.createdAt - b.createdAt);
      return `
        <section class="col col--${sid}">
          <h3 title="${sid === 'done' ? 'Выполнены сегодня' : ''}">${STATUS[sid].title} <span>${items.length}</span></h3>
          <div class="col__list">${items.map(card).join('') || '<p class="col__empty">Пусто</p>'}</div>
        </section>`;
    }).join('');
    const empty = !state.orders.length ? `
      <div class="crm-empty">
        <h2>Заказов пока нет</h2>
        <p>Заказы с сайта появятся здесь сразу после оформления — обновлять страницу не нужно. Включите звук, чтобы не пропустить новый.</p>
        <button type="button" class="crm-btn" data-demo>Создать тестовый заказ</button>
      </div>` : '';
    $('[data-main]').innerHTML = empty + `<div class="board">${cols}</div>`;
  }

  // ---------- Архив ----------
  function renderHistory() {
    const f = state.historyFilter;
    const list = state.orders.filter(matches).filter((o) => f === 'all' || o.status === f);
    const chips = [['all', 'Все'], ...STATUSES.map((s) => [s.id, s.title])]
      .map(([id, t]) => `<button type="button" class="chip ${f === id ? 'is-on' : ''}" data-hf="${id}">${t}</button>`).join('');
    const rows = list.map((o) => `
      <tr data-open="${esc(o.id)}" tabindex="0">
        <td class="num">№ ${esc(o.number)}</td>
        <td>${esc(dateShort(o.createdAt))}</td>
        <td>${esc(o.name)}<small>${esc(o.phone)}</small></td>
        <td>${o.method === 'pickup' ? 'Самовывоз' : esc(o.address)}</td>
        <td class="items">${esc(itemsLine(o))}</td>
        <td class="r">${rub(o.total)}</td>
        <td><span class="pill pill--${esc(o.status)}">${esc((STATUS[o.status] || STATUS.new).title)}</span></td>
      </tr>`).join('');
    $('[data-main]').innerHTML = `
      <div class="chips">${chips}</div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Заказ</th><th>Когда</th><th>Клиент</th><th>Адрес</th><th>Состав</th><th class="r">Сумма</th><th>Статус</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="tbl-empty">Нет заказов</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  // ---------- Клиенты ----------
  function clients() {
    const map = new Map();
    state.orders.slice().sort((a, b) => a.createdAt - b.createdAt).forEach((o) => {
      const key = digits(o.phone);
      if (!key) return;
      const c = map.get(key) || { key, phone: o.phone, name: o.name, orders: [], spent: 0, dishes: {}, addresses: new Set() };
      c.name = o.name || c.name;
      c.orders.push(o);
      if (o.status !== 'cancelled') {
        c.spent += o.total || 0;
        (o.items || []).forEach((i) => { c.dishes[i.name] = (c.dishes[i.name] || 0) + i.qty; });
      }
      if (o.address) c.addresses.add(o.address);
      map.set(key, c);
    });
    return [...map.values()].map((c) => {
      const done = c.orders.filter((o) => o.status !== 'cancelled');
      const fav = Object.entries(c.dishes).sort((a, b) => b[1] - a[1])[0];
      return { ...c, count: done.length, avg: done.length ? c.spent / done.length : 0, last: c.orders[c.orders.length - 1].createdAt, fav: fav ? fav[0] : '' };
    });
  }

  function renderClients() {
    const q = state.q.trim().toLowerCase(), qd = digits(q);
    const list = clients()
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (qd.length >= 3 && c.key.includes(qd)))
      .sort((a, b) => b.last - a.last);
    const rows = list.map((c) => `
      <tr data-client="${esc(c.key)}" tabindex="0">
        <td>${esc(c.name)}${c.count >= 3 ? ' <span class="pill pill--vip">Постоянный</span>' : c.count <= 1 ? ' <span class="pill pill--first">Новый</span>' : ''}</td>
        <td class="num">${esc(c.phone)}</td>
        <td class="r">${c.count}</td>
        <td class="r">${rub(c.spent)}</td>
        <td class="r">${c.count ? rub(c.avg) : '—'}</td>
        <td>${esc(c.fav)}</td>
        <td>${esc(dateShort(c.last))}</td>
      </tr>`).join('');
    $('[data-main]').innerHTML = `
      <p class="crm-note">Клиенты собираются из заказов по номеру телефона. ${plural(list.length, 'клиент', 'клиента', 'клиентов')}.</p>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Клиент</th><th>Телефон</th><th class="r">Заказов</th><th class="r">Всего</th><th class="r">Средний чек</th><th>Любимое блюдо</th><th>Последний заказ</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="tbl-empty">Клиентов пока нет</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  // ---------- Карточка заказа / клиента ----------
  function renderDrawer() {
    const d = $('[data-drawer]');
    const open = !!(state.openId || state.openClient);
    d.classList.toggle('is-open', open);
    d.setAttribute('aria-hidden', String(!open));
    $('[data-overlay]').hidden = !open && !draft;
    if (state.openClient) { d.innerHTML = clientHTML(state.openClient); return; }
    const o = state.openId && byId(state.openId);
    if (!o) { d.innerHTML = ''; return; }
    const st = STATUS[o.status] || STATUS.new;
    const items = (o.items || []).map((i) => `<tr><td>${esc(i.name)}</td><td class="r">${i.qty}</td><td class="r">${rub(i.price * i.qty)}</td></tr>`).join('');
    const hist = (o.history || []).map((h) => `<li><span>${hhmm(h.at)}</span>${esc((STATUS[h.status] || {}).title || h.status)}${h.by ? ` <em>· ${esc(h.by)}</em>` : ''}</li>`).join('');
    const options = STATUSES.map((s) => `<option value="${s.id}" ${s.id === o.status ? 'selected' : ''}>${s.title}</option>`).join('');
    d.innerHTML = `
      <div class="dr-head">
        <div><h2>Заказ № ${esc(o.number)}</h2><p>${esc(dateShort(o.createdAt))} · <span class="pill pill--${esc(o.status)}">${esc(st.title)}</span></p></div>
        <button type="button" class="crm-x" data-close aria-label="Закрыть">×</button>
      </div>
      <div class="dr-body">
        <div class="dr-block">
          <div class="kv"><span>Клиент</span><b>${esc(o.name)}</b></div>
          ${o.stockMissing && o.stockMissing.length && isManager() ? `<div class="kv kv--note"><span>Склад</span><b>Не списано — нет техкарты: ${esc(o.stockMissing.join(', '))}</b></div>` : ''}
          <div class="kv"><span>Откуда</span><b>${o.source === 'phone' ? 'Телефон' + (o.createdBy ? ' · принял ' + esc(o.createdBy) : '') : 'Сайт'}</b></div>
          <div class="kv"><span>Телефон</span><b class="sel">${esc(o.phone)}</b><button type="button" class="crm-btn crm-btn--small crm-btn--ghost" data-copy="${esc(o.phone)}">Копировать</button></div>
          <div class="kv"><span>${o.method === 'pickup' ? 'Получение' : 'Адрес'}</span><b>${o.method === 'pickup' ? 'Самовывоз' : esc(o.address)}</b></div>
          <div class="kv"><span>Время</span><b>${esc(o.time || 'Как можно скорее')}</b></div>
          <div class="kv"><span>Персон</span><b>${esc(o.persons || 1)}</b></div>
          <div class="kv"><span>Оплата</span><b>${esc(o.payment || '—')}</b></div>
          ${o.comment ? `<div class="kv kv--note"><span>Комментарий</span><b>${esc(o.comment)}</b></div>` : ''}
        </div>
        <table class="tbl tbl--items"><tbody>${items}</tbody></table>
        <dl class="dr-totals">
          <div><dt>Блюда</dt><dd>${rub(o.subtotal)}</dd></div>
          ${o.discount ? `<div><dt>Скидка${o.promo ? ' · ' + esc(o.promo) : o.method === 'pickup' ? ' · самовывоз' : ''}</dt><dd>−${rub(o.discount)}</dd></div>` : ''}
          <div><dt>Доставка</dt><dd>${o.method === 'pickup' ? '—' : o.delivery ? rub(o.delivery) : 'бесплатно'}</dd></div>
          <div class="sum"><dt>Итого</dt><dd>${rub(o.total)}</dd></div>
        </dl>
        <h4>История</h4>
        <ul class="dr-hist">${hist}</ul>
      </div>
      <div class="dr-foot">
        ${st.next ? `<button type="button" class="crm-btn crm-btn--block" data-advance="${esc(o.id)}">${st.next} →</button>` : ''}
        <button type="button" class="crm-btn crm-btn--ghost" data-repeat="${esc(o.id)}">Повторить заказ по телефону</button>
        <div class="dr-row">
          <label class="dr-select"><span>Статус</span><select id="crm-status-select" data-set-status="${esc(o.id)}">${options}</select></label>
          ${o.status !== 'cancelled' && o.status !== 'done'
            ? (state.confirmCancel
              ? `<button type="button" class="crm-btn crm-btn--danger" data-cancel-yes="${esc(o.id)}">Да, отменить</button><button type="button" class="crm-btn crm-btn--ghost" data-cancel-no>Нет</button>`
              : `<button type="button" class="crm-btn crm-btn--ghost crm-btn--danger-text" data-cancel="${esc(o.id)}">Отменить заказ</button>`)
            : ''}
        </div>
      </div>`;
  }

  function clientHTML(key) {
    const c = clients().find((x) => x.key === key);
    if (!c) return '';
    const rows = c.orders.slice().reverse().map((o) => `
      <tr data-open="${esc(o.id)}" tabindex="0"><td class="num">№ ${esc(o.number)}</td><td>${esc(dateShort(o.createdAt))}</td><td class="r">${rub(o.total)}</td><td><span class="pill pill--${esc(o.status)}">${esc((STATUS[o.status] || STATUS.new).title)}</span></td></tr>`).join('');
    return `
      <div class="dr-head">
        <div><h2>${esc(c.name)}</h2><p class="sel">${esc(c.phone)}</p></div>
        <button type="button" class="crm-x" data-close aria-label="Закрыть">×</button>
      </div>
      <div class="dr-body">
        <div class="dr-kpis">
          <div><span>Заказов</span><b>${c.count}</b></div>
          <div><span>Всего</span><b>${rub(c.spent)}</b></div>
          <div><span>Средний чек</span><b>${c.count ? rub(c.avg) : '—'}</b></div>
        </div>
        ${c.fav ? `<div class="kv"><span>Любимое</span><b>${esc(c.fav)}</b></div>` : ''}
        ${c.addresses.size ? `<div class="kv"><span>Адреса</span><b>${[...c.addresses].map(esc).join('<br>')}</b></div>` : ''}
        <button type="button" class="crm-btn" data-compose-for="${esc(c.key)}">+ Новый заказ для клиента</button>
        <h4>Заказы</h4>
        <table class="tbl"><tbody>${rows}</tbody></table>
      </div>`;
  }

  // ---------- Отрисовка ----------
  function renderLogin() {
    $('[data-stats]').innerHTML = '';
    delete $('[data-main]').dataset.ext;
    $('[data-main]').innerHTML = `
      <form class="crm-login" data-login novalidate>
        <span class="crm-mark crm-mark--big">Р</span>
        <h2>РОЛЛЕВИЧ</h2>
        <p>Вход для сотрудников</p>
        <div class="crm-login__fields">
          <label><span class="sr">Логин</span><input id="crm-login" name="login" placeholder="Логин" autocomplete="username" autocapitalize="none" required></label>
          <label><span class="sr">Пароль</span><input id="crm-password" name="password" type="password" placeholder="Пароль" autocomplete="current-password" required></label>
        </div>
        <p class="crm-login__err" data-login-err>${esc(state.loginError)}</p>
        <button type="submit" class="crm-btn crm-btn--block">Войти</button>
      </form>`;
    const first = $('#crm-login');
    if (first && !first.value) first.focus();
  }

  // повар входит в CRM только ради техкарт: без заказов, денег и клиентов
  const isCook = () => !!state.user && state.user.role === 'cook';

  const isManager = () => !!state.user && state.user.role === 'manager';
  // раздел виден: работает на этом сервере, повару — только кухня, управляющему — ещё и склад
  const allowed = (v) => v.available(state.kind) && (!isCook() || v.cook) && (!v.manager || isManager());

  function render() {
    const crm = root.querySelector('.crm');
    crm.classList.toggle('is-login', state.needLogin);
    const userEl = $('[data-user]');
    userEl.hidden = !state.user;
    if (state.user) {
      const initials = state.user.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      userEl.innerHTML = `
        <span class="crm-avatar">${esc(initials)}</span>
        <span class="crm-user__who"><b>${esc(state.user.name)}</b><small>${esc(ROLE_TEXT[state.user.role] || '')}</small></span>
        <a class="crm-icon-btn" data-to-site href="#" title="Открыть сайт" aria-label="Открыть сайт">${icon('site')}</a>
        <button type="button" class="crm-icon-btn" data-logout title="Выйти" aria-label="Выйти">${icon('logout')}</button>`;
    }
    if (state.needLogin) {
      $('[data-title]').textContent = '';
      $('[data-conn]').innerHTML = '';
      renderLogin();
      renderDrawer();
      document.title = 'Вход · CRM РОЛЛЕВИЧ';
      return;
    }
    const cook = isCook();
    if (cook && !(extraViews[state.view] && extraViews[state.view].cook)) state.view = Object.keys(extraViews).find((k) => extraViews[k].cook) || state.view;
    root.querySelectorAll('.crm-tabs [data-view]:not([data-ext-tab])').forEach((b) => { b.hidden = cook; });
    root.querySelectorAll('[data-ext-tab]').forEach((b) => { b.hidden = !allowed(extraViews[b.dataset.view]); });
    if (extraViews[state.view] && !allowed(extraViews[state.view])) state.view = 'board';
    // подписи групп прячем, если в группе не осталось видимых разделов
    root.querySelectorAll('.crm-nav__group').forEach((g) => { g.hidden = ![...g.querySelectorAll('[data-view]')].some((b) => !b.hidden); });
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === state.view)));
    const ext = extraViews[state.view];
    $('[data-sound]').hidden = cook;
    $('[data-sound]').setAttribute('aria-checked', String(state.sound));
    $('.crm-tools').hidden = cook || !!ext;
    $('[data-title]').textContent = ext ? ext.title : TITLES[state.view];
    $('[data-conn]').innerHTML = state.error
      ? `<span class="dot dot--err"></span>${esc(state.error)}`
      : ext ? esc(ext.subtitle ? ext.subtitle() : '')
      : state.kind === 'db' || state.kind === 'api'
        ? '<span class="dot dot--ok"></span>Онлайн — новые заказы появляются сами'
        : state.kind === 'local'
          ? '<span class="dot dot--warn"></span>Локальный режим: видны только заказы из этого браузера'
          : '<span class="dot"></span>Подключаемся…';
    $('[data-stats]').hidden = !!ext;
    if (!cook) Object.values(extraViews).forEach((v) => v.status && v.status(null, state.kind));
    if (ext) { ext.render($('[data-main]')); renderDrawer(); return; }
    delete $('[data-main]').dataset.ext;
    renderStats();
    if (state.view === 'board') renderBoard();
    else if (state.view === 'history') renderHistory();
    else renderClients();
    renderDrawer();
    const n = state.orders.filter((o) => o.status === 'new').length;
    if (isCrmRoute()) document.title = (n ? `(${n}) ` : '') + 'CRM · РОЛЛЕВИЧ';
  }

  function setSide(open) {
    root.querySelector('.crm').classList.toggle('is-side-open', open);
    $('[data-side-close]').hidden = !open;
  }

  // ---------- Действия ----------
  async function setStatus(id, status) {
    const o = byId(id);
    if (!o || o.status === status) return;
    try {
      await Store.setStatus(o, status, state.user ? state.user.name : undefined);
      state.confirmCancel = false;
      state.fresh.delete(id);
      toast(`№ ${o.number}: ${STATUS[status].title.toLowerCase()}`);
    } catch (e) {
      toast('Не удалось сохранить статус. Проверьте интернет и повторите.');
    }
  }

  function advance(id) {
    const o = byId(id);
    if (!o) return;
    const i = FLOW.indexOf(o.status);
    if (i >= 0 && i < FLOW.length - 1) setStatus(id, FLOW[i + 1]);
  }

  async function createDemo() {
    const all = MENU.flatMap((c) => c.items);
    const pick = (n) => all.filter((it) => (it.tags || []).includes('hit')).sort(() => Math.random() - 0.5).slice(0, n);
    const items = pick(3).map((it, i) => ({ id: it.id, name: it.name, qty: i === 0 ? 2 : 1, price: it.price }));
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const now = Date.now();
    try {
      await Store.create({
        id: Store.newId(), number: Store.newNumber(), createdAt: now, status: 'new', history: [{ status: 'new', at: now }],
        name: 'Тестовый клиент', phone: '+7 (900) 000-00-00', method: 'delivery', address: 'ул. Пушкинская, 1 (тест)',
        persons: 2, time: 'Как можно скорее', payment: 'Картой курьеру', comment: 'Тестовый заказ — можно отменить', promo: '',
        items, subtotal, discount: 0, delivery: subtotal >= 1500 ? 0 : 200, total: subtotal + (subtotal >= 1500 ? 0 : 200)
      });
    } catch (e) { toast('Не удалось создать заказ.'); }
  }

  let toastTimer;
  function toast(msg) {
    const t = $('[data-toast]');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  let audio;
  function beep() {
    if (!state.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((delay, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine';
        o.frequency.value = i ? 1046 : 784;
        g.gain.setValueAtTime(0.0001, audio.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + delay + 0.35);
        o.connect(g).connect(audio.destination);
        o.start(audio.currentTime + delay);
        o.stop(audio.currentTime + delay + 0.4);
      });
    } catch (e) { /* звук недоступен */ }
  }

  // ---------- Новый заказ по телефону ----------
  const CFG = window.ROLLEVICH_CONFIG || { deliveryPrice: 200, freeDeliveryFrom: 1500, minOrder: 900, pickupDiscount: 0.1, promoCodes: {}, openHour: 11, closeHour: 23 };
  const ITEMS = new Map(MENU.flatMap((c) => c.items).map((it) => [it.id, it]));
  const cz = $('[data-compose]');
  let draft = null;

  function formatPhone(v) {
    let d = digits(v);
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
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

  function timeOptions() {
    const opts = ['Как можно скорее'];
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60000);
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
    const end = new Date(now); end.setHours(CFG.closeHour, 0, 0, 0);
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 30 * 60000)) {
      if (d.getHours() >= CFG.openHour) opts.push(`Сегодня к ${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
    for (let h = CFG.openHour + 1; h < CFG.closeHour; h++) opts.push(`Завтра к ${h}:00`);
    return opts;
  }

  // Те же правила, что у сайта и сервера (menu.js → ROLLEVICH_CONFIG)
  function draftTotals() {
    const lines = Object.entries(draft.items).filter(([id]) => ITEMS.has(id))
      .map(([id, qty]) => ({ id, name: ITEMS.get(id).name, qty, price: ITEMS.get(id).price }));
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const promo = draft.promo.trim().toUpperCase();
    let rate = CFG.promoCodes[promo] || 0;
    if (draft.method === 'pickup') rate = Math.max(rate, CFG.pickupDiscount);
    const discount = Math.round(subtotal * rate);
    const delivery = draft.method === 'pickup' || subtotal === 0 || subtotal >= CFG.freeDeliveryFrom ? 0 : CFG.deliveryPrice;
    return { lines, subtotal, discount, delivery, total: subtotal - discount + delivery, promoOk: !!CFG.promoCodes[promo] };
  }

  function openCompose(prefill = {}) {
    draft = {
      phone: '', name: '', method: 'delivery', address: '', persons: 2, time: 'Как можно скорее',
      payment: 'Картой курьеру', comment: '', promo: '', items: {}, accepted: true, q: '', cat: 'all', error: '', sending: false,
      ...prefill
    };
    state.openId = null;
    state.openClient = null;
    renderDrawer();
    const cats = MENU.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
    cz.innerHTML = `
      <div class="cz-head">
        <h2>Новый заказ по телефону</h2>
        <button type="button" class="crm-x" data-compose-close aria-label="Закрыть">×</button>
      </div>
      <div class="cz-body">
        <section class="cz-menu">
          <div class="cz-menu__tools">
            <input id="cz-q" type="search" placeholder="Название блюда" data-cz="q" autocomplete="off">
            <select id="cz-cat" data-cz="cat"><option value="all">Все разделы</option><option value="hits">Хиты</option>${cats}</select>
          </div>
          <div class="cz-list" data-cz-list></div>
        </section>
        <section class="cz-form">
          <div class="cz-grid">
            <label class="cz-f"><span>Телефон</span><input id="cz-phone" type="tel" data-cz="phone" placeholder="+7 (___) ___-__-__" autocomplete="off"></label>
            <label class="cz-f"><span>Имя</span><input id="cz-name" data-cz="name" autocomplete="off"></label>
          </div>
          <div class="cz-client" data-cz-client hidden></div>
          <div class="cz-seg" role="radiogroup" aria-label="Получение">
            <label><input type="radio" name="cz-method" value="delivery" data-cz="method"><span>Доставка</span></label>
            <label><input type="radio" name="cz-method" value="pickup" data-cz="method"><span>Самовывоз −${Math.round(CFG.pickupDiscount * 100)}%</span></label>
          </div>
          <label class="cz-f" data-cz-address><span>Адрес</span><input id="cz-address" data-cz="address" placeholder="Улица, дом, квартира, подъезд" autocomplete="off"></label>
          <div class="cz-grid cz-grid--3">
            <label class="cz-f"><span>Время</span><select id="cz-time" data-cz="time">${timeOptions().map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
            <label class="cz-f"><span>Оплата</span><select id="cz-payment" data-cz="payment"><option>Картой курьеру</option><option>СБП</option><option>Наличными</option></select></label>
            <label class="cz-f"><span>Персон</span><input id="cz-persons" type="number" min="1" max="20" data-cz="persons"></label>
          </div>
          <div class="cz-grid">
            <label class="cz-f"><span>Комментарий</span><input id="cz-comment" data-cz="comment" placeholder="Домофон, этаж, пожелания" autocomplete="off"></label>
            <label class="cz-f"><span>Промокод</span><input id="cz-promo" data-cz="promo" autocomplete="off"></label>
          </div>
          <div class="cz-cart" data-cz-cart></div>
          <label class="cz-check"><input id="cz-accepted" type="checkbox" data-cz="accepted"> Клиент подтвердил заказ — сразу в «Приняты»</label>
          <p class="cz-err" data-cz-err></p>
          <button type="button" class="crm-btn crm-btn--block" data-cz-submit>Создать заказ</button>
        </section>
      </div>`;
    ['phone', 'name', 'address', 'time', 'payment', 'persons', 'comment', 'promo'].forEach((k) => {
      const el = cz.querySelector(`[data-cz="${k}"]`);
      if (k === 'time' && ![...el.options].some((o) => o.value === draft.time)) el.add(new Option(draft.time, draft.time, true, true));
      el.value = draft[k];
    });
    cz.querySelector(`[data-cz="method"][value="${draft.method}"]`).checked = true;
    cz.querySelector('[data-cz="accepted"]').checked = draft.accepted;
    cz.hidden = false;
    $('[data-overlay]').hidden = false;
    renderComposeList();
    renderComposeSide();
    cz.querySelector(draft.phone ? '#cz-q' : '#cz-phone').focus();
  }

  function closeCompose() {
    draft = null;
    cz.hidden = true;
    cz.innerHTML = '';
    $('[data-overlay]').hidden = !(state.openId || state.openClient);
  }

  function renderComposeList() {
    // ищем только по названию блюда, по началу слов: «фила авок» → «Филадельфия с авокадо»
    const norm = (t) => t.toLowerCase().replace(/ё/g, 'е');
    const tokens = norm(draft.q).split(/[^a-zа-я0-9]+/).filter(Boolean);
    const nameMatches = (name) => {
      const words = norm(name).split(/[^a-zа-я0-9]+/);
      return tokens.every((t) => words.some((w) => w.startsWith(t)));
    };
    const list = MENU.flatMap((c) => c.items.map((it) => ({ it, cat: c.id })))
      .filter(({ it, cat }) => (draft.cat === 'all' || (draft.cat === 'hits' ? (it.tags || []).includes('hit') : cat === draft.cat)) &&
        (!tokens.length || nameMatches(it.name)));
    cz.querySelector('[data-cz-list]').innerHTML = list.map(({ it }) => {
      const qty = draft.items[it.id] || 0;
      return `
        <div class="cz-row ${qty ? 'is-in' : ''}">
          <div class="cz-row__info"><b>${esc(it.name)}</b><span>${esc([it.meta, it.desc].filter(Boolean).join(' · '))}</span></div>
          <span class="cz-row__price">${rub(it.price)}</span>
          ${qty
            ? `<div class="cz-step"><button type="button" data-cz-dec="${esc(it.id)}" aria-label="Убрать одну">−</button><span>${qty}</span><button type="button" data-cz-inc="${esc(it.id)}" aria-label="Добавить ещё">+</button></div>`
            : `<button type="button" class="crm-btn crm-btn--small crm-btn--ghost" data-cz-inc="${esc(it.id)}">Добавить</button>`}
        </div>`;
    }).join('') || '<p class="col__empty">Ничего не нашлось</p>';
  }

  function findClient(phone) {
    const d = digits(phone);
    return d.length === 11 ? clients().find((c) => c.key === d) : null;
  }

  function renderComposeSide() {
    const t = draftTotals();
    cz.querySelector('[data-cz-address]').hidden = draft.method === 'pickup';
    const c = findClient(draft.phone);
    const box = cz.querySelector('[data-cz-client]');
    box.hidden = !c;
    if (c) {
      const last = c.orders[c.orders.length - 1];
      box.innerHTML = `
        <div><b>${esc(c.name)}</b> — ${c.count ? plural(c.count, 'заказ', 'заказа', 'заказов') + ' на ' + rub(c.spent) : 'новый клиент'}${c.fav ? `, любит «${esc(c.fav)}»` : ''}</div>
        <div class="cz-client__actions">
          ${!draft.name || (last.address && !draft.address) ? `<button type="button" class="crm-btn crm-btn--small crm-btn--ghost" data-cz-fill="${esc(c.key)}">Подставить имя и адрес</button>` : ''}
          <button type="button" class="crm-btn crm-btn--small crm-btn--ghost" data-repeat="${esc(last.id)}">Повторить последний № ${esc(last.number)} (${rub(last.total)})</button>
        </div>`;
    }
    const rows = t.lines.map((l) => `<tr><td>${esc(l.name)}</td><td class="r">${l.qty} × ${rub(l.price)}</td><td class="r">${rub(l.price * l.qty)}</td><td><button type="button" class="cz-del" data-cz-del="${esc(l.id)}" aria-label="Убрать ${esc(l.name)}">×</button></td></tr>`).join('');
    const below = draft.method === 'delivery' && t.subtotal > 0 && t.subtotal < CFG.minOrder;
    cz.querySelector('[data-cz-cart]').innerHTML = t.lines.length ? `
      <table class="tbl"><tbody>${rows}</tbody></table>
      <dl class="dr-totals">
        <div><dt>Блюда</dt><dd>${rub(t.subtotal)}</dd></div>
        ${t.discount ? `<div><dt>Скидка${t.promoOk ? ' · ' + esc(draft.promo.toUpperCase()) : ' · самовывоз'}</dt><dd>−${rub(t.discount)}</dd></div>` : ''}
        <div><dt>Доставка</dt><dd>${draft.method === 'pickup' ? '—' : t.delivery ? rub(t.delivery) : 'бесплатно'}</dd></div>
        <div class="sum"><dt>Итого</dt><dd>${rub(t.total)}</dd></div>
      </dl>
      ${below ? `<p class="cz-warn">Меньше минимальной суммы доставки (${rub(CFG.minOrder)}). Оформить можно, но проверьте с клиентом.</p>` : ''}
      ${draft.promo && !t.promoOk ? '<p class="cz-warn">Такого промокода нет — скидка не применена.</p>' : ''}`
      : '<p class="cz-empty">Добавьте блюда из меню слева</p>';
    const btn = cz.querySelector('[data-cz-submit]');
    btn.textContent = draft.sending ? 'Создаём…' : t.lines.length ? `Создать заказ на ${rub(t.total)}` : 'Создать заказ';
    btn.disabled = draft.sending;
    cz.querySelector('[data-cz-err]').textContent = draft.error;
  }

  function setQty(id, delta) {
    const q = (draft.items[id] || 0) + delta;
    if (q <= 0) delete draft.items[id]; else draft.items[id] = Math.min(q, 99);
    renderComposeList();
    renderComposeSide();
  }

  function prefillFrom(order) {
    const items = {};
    (order.items || []).forEach((i) => { if (ITEMS.has(i.id)) items[i.id] = i.qty; });
    return { phone: order.phone, name: order.name, method: order.method, address: order.address || '', persons: order.persons || 2, payment: order.payment || 'Картой курьеру', items };
  }

  async function submitCompose() {
    const t = draftTotals();
    const problems = [];
    if (digits(draft.phone).length !== 11) problems.push('телефон');
    if (!draft.name.trim()) problems.push('имя');
    if (draft.method === 'delivery' && !draft.address.trim()) problems.push('адрес');
    if (!t.lines.length) problems.push('блюда');
    if (problems.length) { draft.error = 'Заполните: ' + problems.join(', '); renderComposeSide(); return; }

    const now = Date.now();
    const by = state.user ? state.user.name : 'Администратор';
    const history = [{ status: 'new', at: now, by }];
    if (draft.accepted) history.push({ status: 'accepted', at: now, by });
    const order = {
      id: Store.newId(), number: Store.newNumber(), createdAt: now, status: draft.accepted ? 'accepted' : 'new', history,
      source: 'phone', createdBy: by, accepted: draft.accepted,
      name: draft.name.trim(), phone: formatPhone(draft.phone), method: draft.method,
      address: draft.method === 'delivery' ? draft.address.trim() : '', persons: Number(draft.persons) || 1,
      time: draft.time, payment: draft.payment, comment: draft.comment.trim(),
      promo: t.promoOk ? draft.promo.trim().toUpperCase() : '',
      items: t.lines, subtotal: t.subtotal, discount: t.discount, delivery: t.delivery, total: t.total
    };
    draft.sending = true;
    draft.error = '';
    renderComposeSide();
    try {
      const saved = await Store.createStaff(order);
      closeCompose();
      toast(`Заказ № ${saved.number} создан на ${rub(saved.total)}`);
    } catch (e) {
      draft.sending = false;
      draft.error = e && e.message ? e.message : 'Не удалось создать заказ. Проверьте интернет и повторите.';
      renderComposeSide();
    }
  }

  cz.addEventListener('input', (e) => {
    const k = e.target.dataset.cz;
    if (!k || !draft) return;
    if (k === 'phone') {
      e.target.value = formatPhone(e.target.value);
      draft.phone = e.target.value;
      const c = findClient(draft.phone);
      if (c && !draft.name) { draft.name = c.name; cz.querySelector('#cz-name').value = c.name; }
      renderComposeSide();
      return;
    }
    if (k === 'accepted') { draft.accepted = e.target.checked; return; }
    draft[k] = e.target.value;
    if (k === 'q' || k === 'cat') renderComposeList();
    else if (k === 'method' || k === 'promo') renderComposeSide();
  });
  cz.addEventListener('change', (e) => {
    const k = e.target.dataset.cz;
    if (!draft || !k) return;
    if (k === 'accepted') draft.accepted = e.target.checked;
    else if (k === 'method') { draft.method = e.target.value; renderComposeSide(); }
    else if (k === 'cat') { draft.cat = e.target.value; renderComposeList(); }
    else draft[k] = e.target.value;
  });
  cz.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || !draft) return;
    e.stopPropagation();
    if (t.hasAttribute('data-compose-close')) return closeCompose();
    if (t.dataset.czInc) return setQty(t.dataset.czInc, 1);
    if (t.dataset.czDec) return setQty(t.dataset.czDec, -1);
    if (t.dataset.czDel) { delete draft.items[t.dataset.czDel]; renderComposeList(); renderComposeSide(); return; }
    if (t.hasAttribute('data-cz-submit')) return submitCompose();
    if (t.dataset.czFill) {
      const c = clients().find((x) => x.key === t.dataset.czFill);
      const last = c && c.orders[c.orders.length - 1];
      if (!c) return;
      draft.name = c.name;
      cz.querySelector('#cz-name').value = c.name;
      if (last.address) { draft.address = last.address; cz.querySelector('#cz-address').value = last.address; }
      renderComposeSide();
      return;
    }
    if (t.dataset.repeat) {
      const o = byId(t.dataset.repeat);
      if (o) openCompose({ ...prefillFrom(o), accepted: draft.accepted });
    }
  });

  // ---------- События ----------
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, [data-open], [data-client], [data-overlay], [data-side-close]');
    if (!t) return;
    if (t.dataset.view) { state.view = t.dataset.view; setSide(false); render(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-side-open')) { setSide(true); return; }
    if (t.hasAttribute('data-side-close')) { setSide(false); return; }
    if (t.dataset.advance) { e.stopPropagation(); advance(t.dataset.advance); return; }
    if (t.dataset.cancel) { state.confirmCancel = true; renderDrawer(); return; }
    if (t.hasAttribute('data-cancel-no')) { state.confirmCancel = false; renderDrawer(); return; }
    if (t.dataset.cancelYes) { setStatus(t.dataset.cancelYes, 'cancelled'); return; }
    if (t.dataset.hf) { state.historyFilter = t.dataset.hf; render(); return; }
    if (t.dataset.copy) {
      const v = t.dataset.copy;
      Promise.resolve().then(() => navigator.clipboard.writeText(v)).then(() => toast('Номер скопирован'), () => {
        const el = t.parentElement.querySelector('.sel');
        const r = document.createRange(); r.selectNodeContents(el);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        toast('Номер выделен — скопируйте его');
      });
      return;
    }
    if (t.hasAttribute('data-sound')) {
      state.sound = !state.sound;
      try { localStorage.setItem('rollevich-crm-sound', state.sound ? '1' : '0'); } catch (err) { /* ignore */ }
      if (state.sound) beep();
      render();
      return;
    }
    if (t.hasAttribute('data-demo')) { createDemo(); return; }
    if (t.hasAttribute('data-logout')) { logout(); return; }
    if (t.hasAttribute('data-compose-open')) { openCompose(); return; }
    if (t.dataset.repeat) { const o = byId(t.dataset.repeat); if (o) openCompose(prefillFrom(o)); return; }
    if (t.dataset.composeFor) {
      const c = clients().find((x) => x.key === t.dataset.composeFor);
      const last = c && c.orders[c.orders.length - 1];
      if (c) openCompose({ phone: c.phone, name: c.name, address: (last && last.address) || '', method: last && last.address ? 'delivery' : 'pickup' });
      return;
    }
    if (t.hasAttribute('data-to-site')) { e.preventDefault(); leaveCrm(); return; }
    if (t.hasAttribute('data-overlay') && draft) { closeCompose(); return; }
    if (t.hasAttribute('data-close') || t.hasAttribute('data-overlay')) { state.openId = null; state.openClient = null; state.confirmCancel = false; renderDrawer(); return; }
    if (t.dataset.client) { state.openClient = t.dataset.client; state.openId = null; renderDrawer(); return; }
    if (t.dataset.open) { state.openId = t.dataset.open; state.openClient = null; state.confirmCancel = false; state.fresh.delete(t.dataset.open); render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (!isCrmRoute()) return;
    if (e.key === 'Escape') {
      if (draft) { closeCompose(); return; }
      setSide(false);
      state.openId = null; state.openClient = null; renderDrawer();
    }
    if (e.key === 'Enter' && e.target.matches('[data-open], [data-client]')) e.target.click();
  });
  root.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-login]')) return;
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      state.user = await Store.login(f.login.value.trim(), f.password.value);
      state.needLogin = false;
      state.loginError = '';
      if (!isCook()) subscribe();
      render();
    } catch (err) {
      state.loginError = err && err.message ? err.message : 'Не удалось войти. Проверьте интернет.';
      f.querySelector('[data-login-err]').textContent = state.loginError;
      f.password.value = '';
      f.password.focus();
    } finally {
      btn.disabled = false;
    }
  });

  root.addEventListener('change', (e) => {
    if (e.target.dataset.setStatus) setStatus(e.target.dataset.setStatus, e.target.value);
  });
  let qTimer;
  $('[data-q]').addEventListener('input', (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = e.target.value; render(); }, 150);
  });

  // ---------- Поле с подсказками: вписываешь начало названия — выбираешь из списка ----------
  // Разметка: combo.html(...). Выбранное значение лежит в скрытом поле с переданными атрибутами;
  // при выборе на нём срабатывают события input и change, как у обычного select.
  const comboSources = {};   // имя → () => [{ value, label, hint }]
  const normText = (t) => String(t || '').toLowerCase().replace(/ё/g, 'е');
  const combo = {
    source(name, fn) { comboSources[name] = fn; },
    html({ source, value = '', attrs = '', placeholder = 'Начните вписывать название', label = 'Выбор', empty = '' }) {
      const item = value !== '' && (comboSources[source] ? comboSources[source]() : []).find((x) => String(x.value) === String(value));
      return `<div class="combo" data-combo="${esc(source)}" data-empty="${esc(empty)}">` +
        `<input type="text" class="combo__input" value="${esc(item ? item.label : '')}" placeholder="${esc(placeholder)}" aria-label="${esc(label)}" autocomplete="off" autocapitalize="off" spellcheck="false" role="combobox" aria-expanded="false" enterkeyhint="done">` +
        `<input type="hidden" ${attrs} value="${esc(item ? item.value : '')}"></div>`;
    },
    // выставить значение из кода (например, «Списать» у партии)
    set(el, value) {
      const box = el.closest('[data-combo]') || el;
      const item = (comboSources[box.dataset.combo] || (() => []))().find((x) => String(x.value) === String(value));
      box.querySelector('.combo__input').value = item ? item.label : '';
      box.querySelector('input[type="hidden"]').value = item ? item.value : '';
    }
  };
  // совпадения — слова, которые начинаются с вписанного: «ло» → «Лосось…», потом «Икра лосося»
  function comboMatches(items, q) {
    const tokens = normText(q).split(/[^a-zа-я0-9]+/).filter(Boolean);
    if (!tokens.length) return items.slice();
    return items.map((it) => {
      const name = normText(it.label);
      const words = name.split(/[^a-zа-я0-9]+/);
      if (!tokens.every((t) => words.some((w) => w.startsWith(t)))) return null;
      const score = name.startsWith(tokens[0]) ? 0 : 1;
      return { it, score };
    }).filter(Boolean).sort((a, b) => a.score - b.score || a.it.label.localeCompare(b.it.label, 'ru')).map((x) => x.it);
  }
  let comboOpen = null; // { box, list, items, active }
  const comboList = document.createElement('div');
  comboList.className = 'combo__list';
  comboList.setAttribute('role', 'listbox');
  comboList.hidden = true;
  root.appendChild(comboList);
  function comboPlace() {
    if (!comboOpen) return;
    const r = comboOpen.box.querySelector('.combo__input').getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 180 && above > below;
    comboList.style.left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 240) - 8)) + 'px';
    comboList.style.width = Math.max(r.width, 240) + 'px';
    comboList.style.maxHeight = Math.max(140, Math.min(320, up ? above : below)) + 'px';
    comboList.style.top = up ? '' : (r.bottom + 6) + 'px';
    comboList.style.bottom = up ? (window.innerHeight - r.top + 6) + 'px' : '';
  }
  function comboRender() {
    const { box, items, active } = comboOpen;
    comboList.innerHTML = items.length
      ? items.slice(0, 60).map((it, i) => `<div class="combo__opt ${i === active ? 'is-active' : ''}" role="option" data-combo-i="${i}"><b>${esc(it.label)}</b>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</div>`).join('')
      : `<p class="combo__empty">Ничего не нашлось${box.dataset.empty ? '. ' + esc(box.dataset.empty) : ''}</p>`;
    const act = comboList.querySelector('.is-active');
    if (act) act.scrollIntoView({ block: 'nearest' });
  }
  function comboShow(box) {
    const input = box.querySelector('.combo__input');
    const all = (comboSources[box.dataset.combo] || (() => []))();
    const hidden = box.querySelector('input[type="hidden"]');
    // уже выбрано и текст не меняли — показываем весь список
    const chosen = all.find((x) => String(x.value) === hidden.value);
    const q = chosen && chosen.label === input.value ? '' : input.value;
    comboOpen = { box, items: comboMatches(all, q), active: q ? 0 : -1 };
    input.setAttribute('aria-expanded', 'true');
    comboList.hidden = false;
    comboRender();
    comboPlace();
  }
  function comboHide() {
    if (!comboOpen) return;
    comboOpen.box.querySelector('.combo__input').setAttribute('aria-expanded', 'false');
    comboOpen = null;
    comboList.hidden = true;
  }
  function comboPick(box, item) {
    const input = box.querySelector('.combo__input'), hidden = box.querySelector('input[type="hidden"]');
    input.value = item ? item.label : input.value;
    const was = hidden.value;
    hidden.value = item ? item.value : '';
    comboHide();
    if (was !== hidden.value) {
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  root.addEventListener('focusin', (e) => { if (e.target.matches('.combo__input')) { e.target.select(); comboShow(e.target.closest('[data-combo]')); } });
  root.addEventListener('input', (e) => {
    if (!e.target.matches('.combo__input')) return;
    const box = e.target.closest('[data-combo]');
    const hidden = box.querySelector('input[type="hidden"]');
    if (hidden.value) { hidden.value = ''; hidden.dispatchEvent(new Event('input', { bubbles: true })); hidden.dispatchEvent(new Event('change', { bubbles: true })); }
    comboShow(box);
  });
  root.addEventListener('keydown', (e) => {
    if (!e.target.matches('.combo__input')) return;
    if (!comboOpen) { if (e.key === 'Enter') e.preventDefault(); return; } // Enter в поле не отправляет форму
    const o = comboOpen;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = Math.min(o.items.length, 60);
      if (!n) return;
      o.active = e.key === 'ArrowDown' ? (o.active + 1) % n : (o.active - 1 + n) % n;
      comboRender();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = o.items[o.active >= 0 ? o.active : 0];
      if (it) comboPick(o.box, it);
    } else if (e.key === 'Escape') { e.stopPropagation(); comboHide(); }
  });
  root.addEventListener('focusout', (e) => {
    if (!e.target.matches('.combo__input')) return;
    const box = e.target.closest('[data-combo]');
    setTimeout(() => {
      if (box.contains(document.activeElement)) return;
      // ушли из поля, не выбрав: если вписанное однозначно — выбираем само
      const hidden = box.querySelector('input[type="hidden"]');
      if (!hidden.value && e.target.value.trim()) {
        const all = (comboSources[box.dataset.combo] || (() => []))();
        const exact = all.find((x) => normText(x.label) === normText(e.target.value.trim()));
        const m = exact ? [exact] : comboMatches(all, e.target.value);
        if (m.length === 1) comboPick(box, m[0]);
      }
      if (comboOpen && comboOpen.box === box) comboHide();
    }, 150);
  });
  // выбор пальцем или мышью: mousedown, чтобы поле не потеряло фокус раньше времени
  comboList.addEventListener('mousedown', (e) => e.preventDefault());
  comboList.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-combo-i]');
    if (opt && comboOpen) comboPick(comboOpen.box, comboOpen.items[Number(opt.dataset.comboI)]);
  });
  window.addEventListener('resize', comboPlace);
  window.addEventListener('scroll', (e) => { if (comboOpen && !comboList.contains(e.target)) comboPlace(); }, true);

  // ---------- Дополнительные вкладки (касса и смены — crm-shifts.js) ----------
  const extraViews = {};
  window.RollevichCRM = {
    // view.group — подпись группы в боковой панели, view.icon — значок, view.subtitle() — строка под заголовком
    addView(id, title, view) {
      extraViews[id] = { available: () => true, title, ...view };
      const groupName = view.group || 'Ещё';
      let group = root.querySelector(`.crm-nav__group[data-group="${groupName}"]`);
      if (!group) {
        group = document.createElement('div');
        group.className = 'crm-nav__group';
        group.dataset.group = groupName;
        group.innerHTML = `<p class="crm-nav__label">${esc(groupName)}</p>`;
        root.querySelector('.crm-tabs').appendChild(group);
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.view = id;
      b.dataset.extTab = '';
      b.setAttribute('role', 'tab');
      b.innerHTML = `${icon(view.icon)}<span>${esc(title)}</span><span class="crm-nav__badge" data-badge></span>`;
      group.appendChild(b);
      if (isCrmRoute()) render();
    },
    // короткая подпись справа от раздела в боковой панели: «открыта», «3»
    badge(id, text, tone) {
      const b = root.querySelector(`[data-view="${id}"] [data-badge]`);
      if (!b) return;
      b.textContent = text || '';
      b.className = 'crm-nav__badge' + (tone ? ' crm-nav__badge--' + tone : '');
    },
    // обновить заголовок и подпись активного раздела без перерисовки
    head() {
      const v = extraViews[state.view];
      if (v && !state.needLogin && !state.error) $('[data-conn]').textContent = v.subtitle ? v.subtitle() : '';
    },
    user: () => state.user,
    isManager,
    isActive: (id) => isCrmRoute() && state.view === id && !state.needLogin,
    render: () => { if (isCrmRoute()) render(); },
    toast,
    icon,
    combo,
    h: { esc, rub, hhmm, dateShort, plural, ago, pad }
  };

  // ---------- Маршрут: сайт ↔ CRM ----------
  const standalone = document.body.classList.contains('crm-page');
  function isCrmRoute() { return standalone || location.hash === '#crm'; }
  function applyRoute() {
    const on = isCrmRoute();
    document.body.classList.toggle('is-crm', on);
    root.hidden = !on;
    if (on) { render(); window.scrollTo(0, 0); }
  }
  function leaveCrm() {
    if (standalone) { location.href = 'index.html'; return; }
    history.replaceState(null, '', location.pathname + location.search);
    applyRoute();
    document.title = 'РОЛЛЕВИЧ';
  }
  window.addEventListener('hashchange', applyRoute);

  // ---------- Данные ----------
  function subscribe() {
    if (state.unsubscribe) state.unsubscribe();
    state.seen = null;
    Store.subscribe((orders) => {
      const ids = new Set(orders.map((o) => o.id));
      if (state.seen) {
        const added = orders.filter((o) => !state.seen.has(o.id) && o.status === 'new');
        added.forEach((o) => state.fresh.add(o.id));
        if (added.length && isCrmRoute()) {
          beep();
          toast(added.length === 1 ? `Новый заказ № ${added[0].number} на ${rub(added[0].total)}` : `Новых заказов: ${added.length}`);
        }
      }
      state.seen = ids;
      state.orders = orders;
      state.error = '';
      if (isCrmRoute()) render();
    }, (e) => {
      if (e && e.code === 'unauthorized') {
        state.user = null;
        state.needLogin = true;
        state.orders = [];
      } else {
        state.error = e && e.code === 'revoked' ? 'Доступ к заказам закрыт' : 'Нет связи с базой заказов. Обновите страницу.';
      }
      if (isCrmRoute()) render();
    }).then((unsub) => { state.unsubscribe = unsub; })
      .catch(() => { state.error = 'Нет связи с базой заказов. Обновите страницу.'; if (isCrmRoute()) render(); });
  }

  async function logout() {
    try { await Store.logout(); } catch (e) { /* всё равно выходим */ }
    if (state.unsubscribe) state.unsubscribe();
    state.unsubscribe = null;
    state.user = null;
    state.orders = [];
    state.openId = null;
    state.openClient = null;
    state.needLogin = true;
    render();
  }

  (async () => {
    const b = await Store.backend();
    state.kind = b.kind;
    if (b.kind === 'api') {
      try { state.user = await Store.me(); } catch (e) { state.error = 'Нет связи с сервером заказов. Обновите страницу.'; }
      if (!state.user && !state.error) { state.needLogin = true; if (isCrmRoute()) render(); return; }
    }
    if (!isCook()) subscribe();
    if (isCrmRoute()) render();
  })();

  // таймеры «сколько ждёт» обновляем раз в 30 секунд
  setInterval(() => { if (isCrmRoute() && !state.openId && state.view === 'board') { renderStats(); renderBoard(); } }, 30000);

  applyRoute();
})();
