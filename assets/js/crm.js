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
    error: ''
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

  // ---------- Каркас ----------
  root.innerHTML = `
    <div class="crm">
      <header class="crm-top">
        <div class="crm-brand"><span class="crm-mark">Р</span><b>РОЛЛЕВИЧ</b><span class="crm-sub">CRM</span></div>
        <nav class="crm-tabs" role="tablist">
          <button type="button" data-view="board" role="tab">Заказы <span class="crm-count" data-new-count hidden></span></button>
          <button type="button" data-view="history" role="tab">Архив</button>
          <button type="button" data-view="clients" role="tab">Клиенты</button>
        </nav>
        <div class="crm-tools">
          <label class="crm-search"><input id="crm-search" type="search" placeholder="№, имя или телефон" data-q></label>
          <button type="button" class="crm-btn crm-btn--ghost" data-sound aria-pressed="false">Звук</button>
          <a class="crm-btn crm-btn--ghost" data-to-site href="#">На сайт</a>
        </div>
      </header>
      <div class="crm-status" data-conn></div>
      <section class="crm-stats" data-stats></section>
      <main class="crm-main" data-main></main>
      <div class="crm-overlay" data-overlay hidden></div>
      <aside class="crm-drawer" data-drawer aria-hidden="true"></aside>
      <div class="crm-toast" data-toast></div>
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
      <div class="stat"><span>Заказов сегодня</span><b>${today.length}</b></div>
      <div class="stat"><span>Выручка сегодня</span><b>${rub(revenue)}</b></div>
      <div class="stat"><span>Средний чек</span><b>${paid.length ? rub(revenue / paid.length) : '—'}</b></div>
      <div class="stat"><span>В работе</span><b>${active.length}</b></div>
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
        <div class="ocard__who">${esc(o.name)} <span>${esc(o.phone)}</span></div>
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
          <h3>${STATUS[sid].title}${sid === 'done' ? ' сегодня' : ''} <span>${items.length}</span></h3>
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
    $('[data-overlay]').hidden = !open;
    if (state.openClient) { d.innerHTML = clientHTML(state.openClient); return; }
    const o = state.openId && byId(state.openId);
    if (!o) { d.innerHTML = ''; return; }
    const st = STATUS[o.status] || STATUS.new;
    const items = (o.items || []).map((i) => `<tr><td>${esc(i.name)}</td><td class="r">${i.qty}</td><td class="r">${rub(i.price * i.qty)}</td></tr>`).join('');
    const hist = (o.history || []).map((h) => `<li><span>${hhmm(h.at)}</span>${esc((STATUS[h.status] || {}).title || h.status)}</li>`).join('');
    const options = STATUSES.map((s) => `<option value="${s.id}" ${s.id === o.status ? 'selected' : ''}>${s.title}</option>`).join('');
    d.innerHTML = `
      <div class="dr-head">
        <div><h2>Заказ № ${esc(o.number)}</h2><p>${esc(dateShort(o.createdAt))} · <span class="pill pill--${esc(o.status)}">${esc(st.title)}</span></p></div>
        <button type="button" class="crm-x" data-close aria-label="Закрыть">×</button>
      </div>
      <div class="dr-body">
        <div class="dr-block">
          <div class="kv"><span>Клиент</span><b>${esc(o.name)}</b></div>
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
        <h4>Заказы</h4>
        <table class="tbl"><tbody>${rows}</tbody></table>
      </div>`;
  }

  // ---------- Отрисовка ----------
  function render() {
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === state.view)));
    const btn = $('[data-sound]');
    btn.setAttribute('aria-pressed', String(state.sound));
    btn.textContent = state.sound ? 'Звук включён' : 'Звук выключен';
    $('[data-conn]').innerHTML = state.error
      ? `<span class="dot dot--err"></span>${esc(state.error)}`
      : state.kind === 'db'
        ? '<span class="dot dot--ok"></span>Онлайн: заказы с сайта приходят сюда в реальном времени'
        : state.kind === 'local'
          ? '<span class="dot dot--warn"></span>Локальный режим: видны только заказы, оформленные в этом браузере'
          : '<span class="dot"></span>Подключаемся…';
    renderStats();
    if (state.view === 'board') renderBoard();
    else if (state.view === 'history') renderHistory();
    else renderClients();
    renderDrawer();
    const n = state.orders.filter((o) => o.status === 'new').length;
    if (isCrmRoute()) document.title = (n ? `(${n}) ` : '') + 'CRM · РОЛЛЕВИЧ';
  }

  // ---------- Действия ----------
  async function setStatus(id, status) {
    const o = byId(id);
    if (!o || o.status === status) return;
    const history = [...(o.history || []), { status, at: Date.now() }];
    try {
      await Store.update(id, { status, history });
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

  // ---------- События ----------
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, [data-open], [data-client], [data-overlay]');
    if (!t) return;
    if (t.dataset.view) { state.view = t.dataset.view; render(); return; }
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
    if (t.hasAttribute('data-to-site')) { e.preventDefault(); leaveCrm(); return; }
    if (t.hasAttribute('data-close') || t.hasAttribute('data-overlay')) { state.openId = null; state.openClient = null; state.confirmCancel = false; renderDrawer(); return; }
    if (t.dataset.client) { state.openClient = t.dataset.client; state.openId = null; renderDrawer(); return; }
    if (t.dataset.open) { state.openId = t.dataset.open; state.openClient = null; state.confirmCancel = false; state.fresh.delete(t.dataset.open); render(); }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { state.openId = null; state.openClient = null; renderDrawer(); }
    if (e.key === 'Enter' && e.target.matches('[data-open], [data-client]')) e.target.click();
  });
  root.addEventListener('change', (e) => {
    if (e.target.dataset.setStatus) setStatus(e.target.dataset.setStatus, e.target.value);
  });
  let qTimer;
  $('[data-q]').addEventListener('input', (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = e.target.value; render(); }, 150);
  });

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
  Store.backend().then((b) => { state.kind = b.kind; if (isCrmRoute()) render(); });
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
    state.error = e && e.code === 'revoked' ? 'Доступ к заказам закрыт' : 'Нет связи с базой заказов. Обновите страницу.';
    if (isCrmRoute()) render();
  }).catch(() => { state.error = 'Нет связи с базой заказов. Обновите страницу.'; });

  // таймеры «сколько ждёт» обновляем раз в 30 секунд
  setInterval(() => { if (isCrmRoute() && !state.openId && state.view === 'board') { renderStats(); renderBoard(); } }, 30000);

  applyRoute();
})();
