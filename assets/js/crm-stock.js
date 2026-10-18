/*
 * CRM РОЛЛЕВИЧ: вкладки «Склад» (остатки и приход) и «Списание».
 * Видит только управляющий. Работает только со своим сервером.
 */
(function () {
  const CRM = window.RollevichCRM;
  const Store = window.RollevichStore;
  if (!CRM || !Store) return;
  const { esc, rub, plural } = CRM.h;
  const api = (m, u, b) => Store.request(m, u, b);
  const errText = (e) => (e && e.message) || 'Не удалось выполнить. Проверьте интернет и повторите.';

  const S = {
    data: null,          // обзор: products, suppliers, units, categories, reasons, expiring, today
    section: 'stock',    // раздел «Склада»: stock | receipt
    q: '',
    cat: '',
    docs: {},            // kind → документы за месяц
    openDoc: null,
    editing: null        // id сырья, открытого в списке, или 'new'
  };

  const num = (v) => {
    const n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };
  const qtyText = (n) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 3 });
  const dateText = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
  const dayText = (iso) => { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}.${m}`; };
  const byId = (id) => S.data.products.find((p) => p.id === Number(id));
  const needsOrder = (p) => p.active && p.min > 0 && (p.status === 'low' || p.status === 'out');
  // какой документ показывает вкладка: у «Списания» он один, у «Склада» — выбранный раздел
  const kindOf = (el) => el.closest('[data-stock-root]').dataset.fixed || S.section;
  const REASON_COLOR = { 'Порча': '#ff3b30', 'Истёк срок': '#ff9f0a', 'Брак поставщика': '#af52de', 'Питание персонала': '#0a84ff', 'Проработка блюд': '#34c759', 'Другое': '#8e8e93' };
  const reasonColor = (r) => REASON_COLOR[r] || '#8e8e93';
  const KIND_TEXT = { receipt: 'Приход', writeoff: 'Списание', inventory: 'Ревизия', sale: 'Заказ' };

  async function load() {
    try { S.data = await api('GET', '/api/staff/stock'); } catch (e) { S.data = S.data || { products: [], suppliers: [], units: [], categories: [], reasons: [], expiring: [], error: errText(e) }; }
  }
  async function loadDocs(kind) {
    try { S.docs[kind] = (await api('GET', `/api/staff/stock/docs?kind=${kind}`)).docs; } catch (e) { S.docs[kind] = []; }
  }

  // ---------- Вкладки ----------
  const stockView = {
    group: 'Кухня',
    icon: 'box',
    manager: true,
    available: (kind) => kind === 'api',
    subtitle() {
      if (!S.data) return '';
      const active = S.data.products.filter((p) => p.active);
      if (!active.length) return 'Сырьё, остатки и поставки';
      return `${plural(active.length, 'позиция', 'позиции', 'позиций')} на ${rub(active.reduce((s, p) => s + p.value, 0))}`;
    },
    render(main) {
      if (main.dataset.ext === 'stock') return; // данные склада не зависят от заказов — не перерисовываем
      main.dataset.ext = 'stock';
      main.innerHTML = '<div class="ext" data-stock-root><p class="crm-note">Загружаем склад…</p></div>';
      load().then(() => mount(main));
    }
  };

  const writeoffView = {
    group: 'Кухня',
    icon: 'trash',
    manager: true,
    available: (kind) => kind === 'api',
    subtitle: () => 'Сырьё, которое ушло не в заказы',
    render(main) {
      if (main.dataset.ext === 'writeoff') return;
      main.dataset.ext = 'writeoff';
      S.openDoc = null;
      main.innerHTML = '<div class="ext" data-stock-root data-fixed="writeoff"><p class="crm-note">Загружаем…</p></div>';
      load().then(() => mount(main));
    }
  };

  const SECTIONS = [['stock', 'Остатки'], ['receipt', 'Приход']]; // пересчёт остатков — во вкладке «Ревизия»

  function mount(main) {
    const box = main.querySelector('[data-stock-root]');
    if (!box) return;
    CRM.head();
    box.innerHTML = (box.dataset.fixed ? '' : `
      <div class="chips" role="tablist" aria-label="Раздел склада">${SECTIONS.map(([id, t]) => `<button type="button" class="chip" role="tab" data-section="${id}">${t}</button>`).join('')}</div>`) +
      '<div class="ext" data-stock-section></div>';
    bind(box);
    renderSection(box);
  }

  async function refresh() {
    await load();
    CRM.head();
  }

  function renderSection(box) {
    const el = box.querySelector('[data-stock-section]');
    const kind = kindOf(box);
    box.querySelectorAll('[data-section]').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.section === kind);
      b.setAttribute('aria-selected', String(b.dataset.section === kind));
    });
    if (kind === 'stock') {
      el.innerHTML = stockHTML();
      if (typeof S.editing === 'number') loadHistory(box, S.editing);
      return;
    }
    if (kind === 'writeoff') {
      el.innerHTML = expiringHTML() + docFormHTML('writeoff') +
        '<h3 class="ext-h">За месяц</h3><div data-wo-sum></div><div data-docs><p class="crm-note">Загружаем…</p></div>';
    } else {
      el.innerHTML = docFormHTML(kind) + '<h3 class="ext-h">Накладные за месяц</h3><div data-docs><p class="crm-note">Загружаем…</p></div>';
    }
    const form = el.querySelector('[data-doc-form]');
    if (form) updateDocForm(form);
    loadDocs(kind).then(() => {
      const d = box.querySelector('[data-docs]');
      if (d) d.innerHTML = docsHTML(kind);
      const sum = box.querySelector('[data-wo-sum]');
      if (sum) sum.innerHTML = writeoffSumHTML();
    });
  }

  // ---------- Остатки ----------
  function attentionHTML() {
    const low = S.data.products.filter(needsOrder);
    const exp = S.data.expiring;
    if (!low.length && !exp.length) return '';
    return `
      <div>
        <p class="list__title">Требует внимания</p>
        <div class="list attn">
          ${low.map((p) => `
            <div class="list-row">
              <span class="sdot sdot--${p.status}"></span>
              <span class="list-row__main"><b>${esc(p.name)}</b><small>Осталось ${qtyText(p.qty)} ${esc(p.unit)}, минимум ${qtyText(p.min)} ${esc(p.unit)}</small></span>
              <span class="list-row__aside"><small class="${p.status === 'out' ? 'neg' : 'warn'}">${p.status === 'out' ? 'Закончилось' : 'Пора заказать'}</small></span>
            </div>`).join('')}
          ${exp.map((e) => `
            <div class="list-row">
              <span class="sdot sdot--${e.expired ? 'out' : 'low'}"></span>
              <span class="list-row__main"><b>${esc(e.name)}</b><small>Партия ${qtyText(e.qty)} ${esc(e.unit)} от ${dayText(e.received)}${e.supplier ? ', ' + esc(e.supplier) : ''}</small></span>
              <span class="list-row__aside"><small class="${e.expired ? 'neg' : 'warn'}">${e.expired ? 'Срок истёк ' : 'Годен до '}${dayText(e.expiry)}</small></span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function stockHTML() {
    if (!S.data.products.length) {
      return `
        <div class="ext-card ext-open">
          <h2>Справочник сырья пуст</h2>
          <p>Добавьте сырьё, которое закупаете: рыбу, рис, нори, соусы, упаковку. Проще всего начать с типового списка для доставки роллов и поправить его под себя.</p>
          <div class="ext-row">
            <button type="button" class="crm-btn" data-starter>Добавить типовой список</button>
            <button type="button" class="crm-btn crm-btn--ghost" data-product-new>Добавить вручную</button>
          </div>
        </div>
        ${S.editing === 'new' ? productFormHTML(null) : ''}`;
    }
    return `
      ${attentionHTML()}
      <div class="ext-row stock-tools">
        <input id="stock-q" type="search" placeholder="Найти сырьё" value="${esc(S.q)}" data-stock-q autocomplete="off" aria-label="Найти сырьё">
        <select id="stock-cat" data-stock-cat aria-label="Категория"><option value="">Все категории</option>${S.data.categories.map((c) => `<option ${S.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <button type="button" class="crm-btn crm-btn--ghost" data-product-new>${CRM.icon('plus')}Сырьё</button>
      </div>
      ${S.editing === 'new' ? productFormHTML(null) : ''}
      <div data-stock-list>${listHTML()}</div>`;
  }

  function listHTML() {
    const qn = S.q.trim().toLowerCase().replace(/ё/g, 'е');
    const list = S.data.products.filter((p) =>
      (!qn || p.name.toLowerCase().replace(/ё/g, 'е').includes(qn)) && (!S.cat || p.category === S.cat));
    if (!list.length) return '<div class="list"><p class="list-empty">Ничего не нашлось</p></div>';
    const groups = [...new Set(list.map((p) => p.category))];
    return `<div class="list">${groups.map((g) => `
      <div class="list-group">${esc(g)}</div>
      ${list.filter((p) => p.category === g).map((p) => {
        const tone = !p.active ? '' : p.status === 'out' ? 'neg' : p.status === 'low' ? 'warn' : '';
        const open = S.editing === p.id;
        return `
          <div class="list-row ${p.active ? '' : 'is-off'} ${open ? 'is-open' : ''}" data-product="${p.id}" tabindex="0" aria-expanded="${open}">
            <span class="sdot sdot--${p.active ? p.status : 'none'}"></span>
            <span class="list-row__main"><b>${esc(p.name)}</b><small>${p.active ? (p.avgPrice ? `${rub(p.avgPrice)} за ${esc(p.unit)}` : 'Ещё не поступало') : 'Не используется'}</small></span>
            <span class="list-row__aside"><b class="${tone}">${qtyText(p.qty)} ${esc(p.unit)}</b><small>${p.value ? rub(p.value) : p.min ? 'минимум ' + qtyText(p.min) : ''}</small></span>
          </div>
          ${open ? `<div class="list-detail">${productFormHTML(p)}<div><p class="list__title">История</p><div class="ext-card" data-history-box><p class="crm-note">Загружаем…</p></div></div></div>` : ''}`;
      }).join('')}`).join('')}</div>`;
  }

  function productFormHTML(p) {
    const isNew = !p;
    return `
      <form class="ext-card" data-product-form-el novalidate>
        <h3>${isNew ? 'Новое сырьё' : 'Настройки'}</h3>
        <div class="cz-grid cz-grid--4">
          <label class="cz-f"><span>Название</span><input id="pr-name" name="name" value="${esc(p ? p.name : '')}" autocomplete="off"></label>
          <label class="cz-f"><span>Категория</span><select id="pr-cat" name="category">${S.data.categories.map((c) => `<option ${p && p.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label class="cz-f"><span>Единица</span><select id="pr-unit" name="unit">${S.data.units.map((u) => `<option ${p && p.unit === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
          <label class="cz-f"><span>Минимальный остаток</span><input id="pr-min" name="min" inputmode="decimal" value="${p && p.min ? qtyText(p.min) : ''}" placeholder="0" autocomplete="off"></label>
        </div>
        ${isNew ? '' : `<label class="cz-check"><input id="pr-active" type="checkbox" name="active" ${p.active ? 'checked' : ''}> Используется — снимите, если больше не закупаете</label>`}
        <p class="crm-note">Когда остаток опустится ниже минимума, CRM напомнит заказать, а в Telegram придёт сообщение.</p>
        <p class="cz-err" data-err></p>
        <div class="ext-row">
          <button type="submit" class="crm-btn">${isNew ? 'Добавить' : 'Сохранить'}</button>
          <button type="button" class="crm-btn crm-btn--ghost" data-product-cancel>${isNew ? 'Отмена' : 'Свернуть'}</button>
        </div>
      </form>`;
  }

  async function loadHistory(box, id) {
    try {
      const h = await api('GET', `/api/staff/stock/products/${id}/moves`);
      const el = box.querySelector('[data-history-box]');
      if (el && S.editing === id) el.innerHTML = historyHTML(h);
    } catch (e) { /* история не обязательна */ }
  }

  function historyHTML(h) {
    if (!h.moves.length) return '<p class="crm-note">Движений пока не было</p>';
    return `<div class="list-sub">${h.moves.map((m) => {
      const what = m.kind === 'receipt' ? (m.supplier ? ' · ' + esc(m.supplier) : '') : m.kind === 'sale' ? (m.number ? ' № ' + esc(m.number) : '') : m.reason ? ' · ' + esc(m.reason) : '';
      return `
        <div>
          <span><b>${KIND_TEXT[m.kind] || esc(m.kind)}${what}</b><br><small>${dateText(m.date)}${m.price ? ' · ' + rub(m.price) + ' за ' + esc(h.product.unit) : ''}${m.expiry ? ' · годен до ' + dayText(m.expiry) : ''}${m.by ? ' · ' + esc(m.by) : ''}</small></span>
          <b class="${m.qty < 0 ? 'neg' : m.qty > 0 ? 'pos' : ''}">${m.qty > 0 ? '+' : ''}${qtyText(m.qty)} ${esc(h.product.unit)}</b>
        </div>`;
    }).join('')}</div>`;
  }

  // ---------- Формы: приход и списание ----------
  function productOptions() {
    return S.data.categories.map((c) => {
      const items = S.data.products.filter((p) => p.active && p.category === c);
      return items.length ? `<optgroup label="${esc(c)}">${items.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>` : '';
    }).join('');
  }

  function lineHTML(kind) {
    const select = `<label><small>Сырьё</small><select name="product" aria-label="Сырьё"><option value="">Выберите сырьё</option>${productOptions()}</select><span class="line__hint" data-stock-now></span></label>`;
    const qty = '<label class="line__qty"><small>Количество</small><input name="qty" inputmode="decimal" placeholder="Сколько" aria-label="Количество" autocomplete="off"><span data-unit></span></label>';
    const del = '<button type="button" class="cz-del" data-line-del aria-label="Убрать строку">×</button>';
    if (kind === 'receipt') {
      return `
        <div class="line line--receipt" data-line>
          ${select}${qty}
          <label class="line__qty line__qty--wide"><small>Цена</small><input name="price" inputmode="decimal" placeholder="Цена" aria-label="Цена за единицу" autocomplete="off"><span data-unit-price>₽</span></label>
          <label><small>Годен до</small><input name="expiry" type="date" aria-label="Годен до"><span class="line__hint">годен до</span></label>
          <span class="line__sum" data-sum></span>
          ${del}
        </div>`;
    }
    return `<div class="line" data-line>${select}${qty}<span class="line__sum" data-sum></span>${del}</div>`;
  }

  function docFormHTML(kind) {
    if (!S.data.products.length) return '<div class="ext-card"><p>Сначала заполните справочник сырья: «Склад» → «Остатки».</p></div>';
    const date = `<label class="doc-date">Дата <input id="doc-date" name="date" type="date" value="${esc(S.data.today)}"></label>`;
    if (kind === 'receipt') {
      return `
        <form class="ext-card doc-form" data-doc-form novalidate>
          <h3>Новая накладная</h3>
          <div class="doc-fields">
            <label class="cz-f"><span>Поставщик</span><input id="doc-supplier" name="supplier" list="doc-suppliers" autocomplete="off" placeholder="Название"><datalist id="doc-suppliers">${S.data.suppliers.map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist></label>
            <label class="cz-f"><span>Номер накладной</span><input id="doc-number" name="number" autocomplete="off" placeholder="Необязательно"></label>
            <label class="cz-f"><span>Комментарий</span><input id="doc-note" name="note" autocomplete="off" placeholder="Необязательно"></label>
          </div>
          <div class="doc-step">
            <b>Что пришло</b>
            <div class="lines" data-lines>${lineHTML('receipt')}</div>
            <div class="doc-foot"><button type="button" class="crm-btn crm-btn--link" data-line-add>+ Добавить позицию</button>${date}</div>
          </div>
          <p class="cz-err" data-err></p>
          <button type="submit" class="crm-btn crm-btn--block" data-doc-submit>Провести приход</button>
        </form>`;
    }
    return `
      <form class="ext-card doc-form" data-doc-form novalidate>
        <h3>Новое списание</h3>
        <div class="doc-step">
          <b>Причина</b>
          <div class="reasons" role="radiogroup" aria-label="Причина списания">${S.data.reasons.map((r) => `<label><input type="radio" name="reason" value="${esc(r)}"><span>${esc(r)}</span></label>`).join('')}</div>
        </div>
        <div class="doc-step">
          <b>Что списываем</b>
          <div class="lines" data-lines>${lineHTML('writeoff')}</div>
          <div class="doc-foot"><button type="button" class="crm-btn crm-btn--link" data-line-add>+ Ещё позиция</button>${date}</div>
        </div>
        <label class="cz-f"><span>Комментарий</span><input id="doc-note" name="note" autocomplete="off" placeholder="Что случилось — необязательно"></label>
        <p class="cz-err" data-err></p>
        <button type="submit" class="crm-btn crm-btn--block" data-doc-submit>Списать</button>
      </form>`;
  }

  // пересчёт подсказок и суммы; итог — прямо на кнопке
  function updateDocForm(form) {
    const kind = kindOf(form);
    let total = 0;
    form.querySelectorAll('[data-line]').forEach((line) => {
      const p = byId(line.querySelector('[name="product"]').value);
      const qty = num(line.querySelector('[name="qty"]').value);
      line.querySelector('[data-unit]').textContent = p ? p.unit : '';
      const hint = line.querySelector('[data-stock-now]');
      let sum = NaN;
      if (kind === 'receipt') {
        line.querySelector('[data-unit-price]').textContent = p ? `₽/${p.unit}` : '₽';
        hint.textContent = p ? `Сейчас ${qtyText(p.qty)} ${p.unit}` : '';
        hint.classList.remove('neg');
        sum = qty * num(line.querySelector('[name="price"]').value);
      } else {
        const over = !!p && qty > p.qty;
        hint.textContent = !p ? '' : over ? `На складе только ${qtyText(p.qty)} ${p.unit}` : `На складе ${qtyText(p.qty)} ${p.unit}`;
        hint.classList.toggle('neg', over);
        sum = p ? qty * p.avgPrice : NaN;
      }
      const ok = Number.isFinite(sum) && sum > 0;
      line.querySelector('[data-sum]').textContent = ok ? rub(sum) : '';
      if (ok) total += sum;
    });
    const btn = form.querySelector('[data-doc-submit]');
    if (kind === 'receipt') btn.textContent = total ? `Провести приход на ${rub(total)}` : 'Провести приход';
    else {
      btn.textContent = total ? `Списать на ${rub(total)}` : 'Списать';
      form.note.placeholder = form.reason.value === 'Другое' ? 'Обязательно: что случилось?' : 'Что случилось — необязательно';
    }
  }

  async function submitDoc(box, form) {
    const kind = kindOf(box);
    const err = form.querySelector('[data-err]');
    const lines = [];
    const problems = [];
    form.querySelectorAll('[data-line]').forEach((line, i) => {
      const productId = line.querySelector('[name="product"]').value;
      const qty = line.querySelector('[name="qty"]').value.trim();
      if (!productId && !qty) return; // пустая строка
      if (!productId) return problems.push(`строка ${i + 1}: выберите сырьё`);
      if (!(num(qty) > 0)) return problems.push(`строка ${i + 1}: количество`);
      const item = { productId: Number(productId), qty };
      if (kind === 'receipt') {
        item.price = line.querySelector('[name="price"]').value.trim() || '0';
        item.expiry = line.querySelector('[name="expiry"]').value || null;
      }
      lines.push(item);
    });
    if (kind === 'receipt' && !form.supplier.value.trim()) problems.unshift('поставщик');
    if (kind === 'writeoff' && !form.reason.value) problems.unshift('причина списания');
    if (kind === 'writeoff' && form.reason.value === 'Другое' && !form.note.value.trim()) problems.push('комментарий — для причины «Другое» напишите, что случилось');
    if (!lines.length && !problems.length) problems.push('добавьте хотя бы одну позицию');
    if (problems.length) { err.textContent = 'Проверьте: ' + problems.join(', '); return; }
    const body = kind === 'receipt'
      ? { supplier: form.supplier.value.trim(), number: form.number.value.trim(), date: form.date.value, note: form.note.value.trim(), lines }
      : { reason: form.reason.value, date: form.date.value, note: form.note.value.trim(), lines };
    const btn = form.querySelector('[data-doc-submit]');
    btn.disabled = true;
    err.textContent = '';
    try {
      const r = await api('POST', `/api/staff/stock/${kind === 'receipt' ? 'receipts' : 'writeoffs'}`, body);
      CRM.toast(`${kind === 'receipt' ? 'Приход проведён' : 'Списано'} на ${rub(r.total)}`);
      S.openDoc = null;
      await refresh();
      renderSection(box);
    } catch (e) {
      err.textContent = errText(e);
      btn.disabled = false;
    }
  }

  // ---------- Списание: сроки и сводка ----------
  function expiringHTML() {
    const exp = S.data.expiring.filter((e) => (byId(e.productId) || {}).qty > 0);
    if (!exp.length) return '';
    return `
      <div>
        <p class="list__title">Истекает срок</p>
        <div class="list attn">${exp.map((e) => {
          const left = Math.min(e.qty, byId(e.productId).qty);
          return `
            <div class="list-row">
              <span class="sdot sdot--${e.expired ? 'out' : 'low'}"></span>
              <span class="list-row__main"><b>${esc(e.name)}</b><small>Партия ${qtyText(e.qty)} ${esc(e.unit)} от ${dayText(e.received)} · <span class="${e.expired ? 'neg' : 'warn'}">${e.expired ? 'срок истёк ' : 'годен до '}${dayText(e.expiry)}</span></small></span>
              <span class="list-row__aside"><button type="button" class="crm-btn crm-btn--small crm-btn--ghost" data-quick="${e.productId}" data-quick-qty="${left}">Списать</button></span>
            </div>`;
        }).join('')}</div>
      </div>`;
  }

  // «Списать» у партии: причина «Истёк срок», сырьё и количество — в форму, остаётся проверить и нажать
  function quickWriteoff(box, productId, qty) {
    const form = box.querySelector('[data-doc-form]');
    if (!form) return;
    const reason = form.querySelector('[name="reason"][value="Истёк срок"]');
    if (reason) reason.checked = true;
    const lines = form.querySelector('[data-lines]');
    let line = [...lines.querySelectorAll('[data-line]')].find((l) => !l.querySelector('[name="product"]').value);
    if (!line) { lines.insertAdjacentHTML('beforeend', lineHTML('writeoff')); line = lines.lastElementChild; }
    line.querySelector('[name="product"]').value = String(productId);
    line.querySelector('[name="qty"]').value = qtyText(qty);
    updateDocForm(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    line.querySelector('[name="qty"]').focus({ preventScroll: true });
  }

  function writeoffSumHTML() {
    const docs = S.docs.writeoff;
    if (!docs) return '';
    const total = docs.reduce((s, d) => s + d.total, 0);
    if (!total) return '';
    const by = {};
    docs.forEach((d) => { by[d.reason] = (by[d.reason] || 0) + d.total; });
    const parts = Object.entries(by).sort((a, b) => b[1] - a[1]);
    return `
      <div class="ext-card wo-sum">
        <div class="wo-sum__total"><b>${rub(total)}</b><span>списано за месяц, ${plural(docs.length, 'документ', 'документа', 'документов')}</span></div>
        <div class="wo-bar" role="img" aria-label="Доли причин списания">${parts.map(([r, v]) => `<i style="width:${(v / total) * 100}%;background:${reasonColor(r)}" title="${esc(r)}: ${rub(v)}"></i>`).join('')}</div>
        <ul class="wo-legend">${parts.map(([r, v]) => `<li><i style="background:${reasonColor(r)}"></i>${esc(r)} <span>${rub(v)}</span></li>`).join('')}</ul>
      </div>`;
  }

  // ---------- Журнал документов ----------
  function docsHTML(kind) {
    const docs = S.docs[kind] || [];
    if (!docs.length) return `<div class="list"><p class="list-empty">${kind === 'writeoff' ? 'За месяц ничего не списывали' : 'За месяц документов нет'}</p></div>`;
    return `<div class="list">${docs.map((d) => {
      const open = S.openDoc === d.id;
      const title = kind === 'receipt' ? esc(d.supplier) : esc(d.reason);
      const sub = [dateText(d.date), kind === 'receipt' && d.number ? '№ ' + esc(d.number) : '', d.note ? esc(d.note) : '', esc(d.by)].filter(Boolean).join(' · ');
      const dot = kind === 'writeoff' ? `style="background:${reasonColor(d.reason)}"` : '';
      const dotClass = kind === 'receipt' ? 'sdot--ok' : '';
      const amount = `<b>${rub(d.total)}</b>`;
      const lines = !open ? '' : `
        <div class="list-detail"><div class="list-sub">${d.lines.map((l) => `<div><span>${esc(l.name)}<br><small>${qtyText(Math.abs(l.qty))} ${esc(l.unit)} × ${rub(l.price)}${l.expiry ? ' · годен до ' + dayText(l.expiry) : ''}</small></span><b>${rub(Math.abs(l.qty) * l.price)}</b></div>`).join('')}</div></div>`;
      return `
        <div class="list-row ${open ? 'is-open' : ''}" data-doc="${d.id}" tabindex="0" aria-expanded="${open}">
          <span class="sdot ${dotClass}" ${dot}></span>
          <span class="list-row__main"><b>${title}</b><small>${sub}</small></span>
          <span class="list-row__aside">${amount}<small>${plural(d.lines.length, 'позиция', 'позиции', 'позиций')}</small></span>
        </div>${lines}`;
    }).join('')}</div>`;
  }

  // ---------- События ----------
  function bind(box) {
    box.addEventListener('click', async (e) => {
      const t = e.target.closest('button, [data-doc], [data-product]');
      if (!t || !box.contains(t)) return;
      if (t.dataset.section) { S.section = t.dataset.section; S.openDoc = null; S.editing = null; renderSection(box); return; }
      if (t.hasAttribute('data-starter')) {
        t.disabled = true;
        try { const r = await api('POST', '/api/staff/stock/starter'); CRM.toast(`Добавлено позиций: ${r.added}`); await refresh(); renderSection(box); } catch (ex) { CRM.toast(errText(ex)); t.disabled = false; }
        return;
      }
      if (t.hasAttribute('data-product-new')) {
        S.editing = 'new';
        renderSection(box);
        const f = box.querySelector('#pr-name');
        f.focus();
        f.closest('form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (t.hasAttribute('data-product-cancel')) { S.editing = null; renderSection(box); return; }
      if (t.dataset.product) {
        const id = Number(t.dataset.product);
        S.editing = S.editing === id ? null : id;
        box.querySelector('[data-stock-list]').innerHTML = listHTML();
        if (S.editing) loadHistory(box, id);
        return;
      }
      if (t.dataset.quick) { quickWriteoff(box, t.dataset.quick, Number(t.dataset.quickQty)); return; }
      if (t.hasAttribute('data-line-add')) {
        const lines = t.closest('form').querySelector('[data-lines]');
        lines.insertAdjacentHTML('beforeend', lineHTML(kindOf(box)));
        lines.lastElementChild.querySelector('select').focus();
        return;
      }
      if (t.hasAttribute('data-line-del')) {
        const form = t.closest('form');
        const lines = form.querySelector('[data-lines]');
        if (lines.children.length > 1) t.closest('[data-line]').remove();
        else lines.innerHTML = lineHTML(kindOf(box));
        updateDocForm(form);
        return;
      }
      if (t.dataset.doc) {
        S.openDoc = S.openDoc === Number(t.dataset.doc) ? null : Number(t.dataset.doc);
        box.querySelector('[data-docs]').innerHTML = docsHTML(kindOf(box));
      }
    });
    const onEdit = (e) => {
      if (e.target.matches('[data-stock-q]')) { S.q = e.target.value; box.querySelector('[data-stock-list]').innerHTML = listHTML(); return; }
      if (e.target.matches('[data-stock-cat]')) { S.cat = e.target.value; box.querySelector('[data-stock-list]').innerHTML = listHTML(); return; }
      const form = e.target.closest('form');
      const err = form && form.querySelector('[data-err]');
      if (err) err.textContent = ''; // исправляют — убираем старую подсказку
      const doc = e.target.closest('[data-doc-form]');
      if (doc) updateDocForm(doc);
    };
    box.addEventListener('input', onEdit);
    box.addEventListener('change', onEdit);
    box.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.matches('[data-doc-form]')) submitDoc(box, f);
      else if (f.matches('[data-product-form-el]')) saveProduct(box, f);
    });
    box.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-doc], [data-product]')) { e.preventDefault(); e.target.click(); }
    });
  }

  async function saveProduct(box, form) {
    const err = form.querySelector('[data-err]');
    const body = { name: form.name.value.trim(), category: form.category.value, unit: form.unit.value, min: form.min.value.trim() || '0' };
    if (form.active) body.active = form.active.checked;
    if (!body.name) { err.textContent = 'Укажите название'; return; }
    if (!(num(body.min) >= 0)) { err.textContent = 'Неверный минимальный остаток'; return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      if (S.editing === 'new') await api('POST', '/api/staff/stock/products', body);
      else await api('PATCH', `/api/staff/stock/products/${S.editing}`, body);
      CRM.toast(S.editing === 'new' ? `«${body.name}» добавлено` : 'Сохранено');
      S.editing = null;
      await refresh();
      renderSection(box);
    } catch (e) {
      err.textContent = errText(e);
      btn.disabled = false;
    }
  }

  CRM.addView('stock', 'Склад', stockView);
  CRM.addView('writeoff', 'Списание', writeoffView);
})();
