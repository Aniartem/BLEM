/*
 * CRM РОЛЛЕВИЧ: вкладка «Склад» — остатки сырья, приход по накладным, списания, инвентаризация.
 * Работает только со своим сервером.
 */
(function () {
  const CRM = window.RollevichCRM;
  const Store = window.RollevichStore;
  if (!CRM || !Store) return;
  const { esc, rub, dateShort } = CRM.h;
  const api = (m, u, b) => Store.request(m, u, b);
  const errText = (e) => (e && e.message) || 'Не удалось выполнить. Проверьте интернет и повторите.';

  const S = {
    data: null,          // обзор: products, suppliers, units, categories, reasons, expiring, today
    section: 'stock',    // stock | receipt | writeoff | inventory
    q: '',
    cat: '',
    onlyLow: false,
    docs: {},            // kind → список документов
    openDoc: null,
    editing: null,       // id сырья или 'new'
    history: null        // { product, moves }
  };

  const num = (v) => {
    const n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };
  const qtyText = (n) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 3 });
  const dateText = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
  const byId = (id) => S.data.products.find((p) => p.id === Number(id));
  const STATUS = { ok: ['Норма', 'pill--done'], low: ['Заканчивается', 'pill--new'], out: ['Нет', 'pill--cancelled'], none: ['Не поступало', ''] };
  const needsOrder = (p) => p.active && p.min > 0 && (p.status === 'low' || p.status === 'out');

  async function load() {
    try { S.data = await api('GET', '/api/staff/stock'); } catch (e) { S.data = S.data || { products: [], suppliers: [], units: [], categories: [], reasons: [], expiring: [], error: errText(e) }; }
  }
  async function loadDocs(kind) {
    try { S.docs[kind] = (await api('GET', `/api/staff/stock/docs?kind=${kind}`)).docs; } catch (e) { S.docs[kind] = []; }
  }

  // ---------- Вкладка ----------
  const view = {
    available: (kind) => kind === 'api',
    render(main) {
      if (main.dataset.ext === 'stock') return; // данные склада не зависят от заказов — не перерисовываем
      main.dataset.ext = 'stock';
      main.innerHTML = '<div class="ext" data-stock-root><p class="crm-note">Загружаем склад…</p></div>';
      load().then(() => mount(main));
    }
  };

  const SECTIONS = [['stock', 'Остатки'], ['receipt', 'Приход'], ['writeoff', 'Списание'], ['inventory', 'Инвентаризация']];

  function mount(main) {
    const box = main.querySelector('[data-stock-root]');
    if (!box) return;
    box.innerHTML = `
      <section class="crm-stats ext-kpis ext-kpis--4" data-stock-kpis>${kpisHTML()}</section>
      <div data-stock-alerts>${alertsHTML()}</div>
      <div class="chips stock-tabs">${SECTIONS.map(([id, t]) => `<button type="button" class="chip ${S.section === id ? 'is-on' : ''}" data-section="${id}">${t}</button>`).join('')}</div>
      <div data-stock-section></div>`;
    if (!box.dataset.bound) { bind(box); box.dataset.bound = '1'; }
    renderSection(box);
  }

  async function refresh(box) {
    await load();
    box.querySelector('[data-stock-kpis]').innerHTML = kpisHTML();
    box.querySelector('[data-stock-alerts]').innerHTML = alertsHTML();
  }

  function kpisHTML() {
    const active = S.data.products.filter((p) => p.active);
    const value = active.reduce((s, p) => s + p.value, 0);
    const low = active.filter(needsOrder).length;
    const exp = S.data.expiring.length;
    return `
      <div class="stat"><span>Позиций сырья</span><b>${active.length}</b></div>
      <div class="stat"><span>Стоимость склада</span><b>${rub(value)}</b><em class="muted">по средней цене прихода</em></div>
      <div class="stat ${low ? 'stat--alert' : ''}"><span>Заканчивается</span><b>${low}</b><em class="muted">ниже минимального остатка</em></div>
      <div class="stat ${exp ? 'stat--alert' : ''}"><span>Истекает срок</span><b>${exp}</b><em class="muted">сегодня — послезавтра</em></div>`;
  }

  function alertsHTML() {
    const exp = S.data.expiring;
    const low = S.data.products.filter(needsOrder);
    if (!exp.length && !low.length) return '';
    return `
      <div class="stock-alerts">
        ${exp.length ? `<div class="ext-card stock-alert"><h3>Срок годности</h3><ul>${exp.map((e) => `
          <li class="${e.expired ? 'is-bad' : ''}"><b>${esc(e.name)}</b> — партия ${qtyText(e.qty)} ${esc(e.unit)} от ${dateText(e.received)}${e.supplier ? ', ' + esc(e.supplier) : ''}:
          ${e.expired ? 'срок истёк ' : 'годен до '}${dateText(e.expiry)}</li>`).join('')}</ul></div>` : ''}
        ${low.length ? `<div class="ext-card stock-alert"><h3>Пора заказать</h3><ul>${low.map((p) => `
          <li class="${p.status === 'out' ? 'is-bad' : ''}"><b>${esc(p.name)}</b> — осталось ${qtyText(p.qty)} ${esc(p.unit)}, минимум ${qtyText(p.min)} ${esc(p.unit)}</li>`).join('')}</ul></div>` : ''}
      </div>`;
  }

  function renderSection(box) {
    const el = box.querySelector('[data-stock-section]');
    box.querySelectorAll('[data-section]').forEach((b) => b.classList.toggle('is-on', b.dataset.section === S.section));
    if (S.section === 'stock') el.innerHTML = stockHTML();
    else el.innerHTML = docFormHTML(S.section) + `<h3 class="ext-h">${{ receipt: 'Накладные', writeoff: 'Списания', inventory: 'Инвентаризации' }[S.section]} за последний месяц</h3><div data-docs><p class="crm-note">Загружаем…</p></div>`;
    if (S.section !== 'stock') {
      initDocForm(box);
      loadDocs(S.section).then(() => { const d = box.querySelector('[data-docs]'); if (d) d.innerHTML = docsHTML(S.section); });
    }
  }

  // ---------- Остатки ----------
  function stockHTML() {
    const products = S.data.products;
    if (!products.length) {
      return `
        <div class="ext-card ext-open">
          <h2>Справочник сырья пуст</h2>
          <p>Добавьте сырьё, которое закупаете: рыбу, рис, нори, соусы, упаковку. Можно начать с типового списка для доставки роллов и поправить его под себя.</p>
          <div class="ext-row">
            <button type="button" class="crm-btn" data-starter>Добавить типовой список</button>
            <button type="button" class="crm-btn crm-btn--ghost" data-product-new>+ Сырьё вручную</button>
          </div>
          <div data-product-form></div>
        </div>`;
    }
    const qn = S.q.trim().toLowerCase().replace(/ё/g, 'е');
    const list = products.filter((p) =>
      (!qn || p.name.toLowerCase().replace(/ё/g, 'е').includes(qn)) &&
      (!S.cat || p.category === S.cat) &&
      (!S.onlyLow || needsOrder(p)));
    const groups = [...new Set(list.map((p) => p.category))];
    const rows = groups.map((g) => `
      <tr class="tbl-group"><td colspan="7">${esc(g)}</td></tr>
      ${list.filter((p) => p.category === g).map((p) => `
        <tr class="${p.active ? '' : 'is-off'}">
          <td>${esc(p.name)}${p.active ? '' : ' <small>не используется</small>'}</td>
          <td class="r"><b>${qtyText(p.qty)}</b> ${esc(p.unit)}</td>
          <td class="r">${p.min ? qtyText(p.min) + ' ' + esc(p.unit) : '—'}</td>
          <td class="r">${p.avgPrice ? rub(p.avgPrice) : '—'}</td>
          <td class="r">${p.value ? rub(p.value) : '—'}</td>
          <td>${p.active ? `<span class="pill ${STATUS[p.status][1]}">${STATUS[p.status][0]}</span>` : ''}</td>
          <td class="r nowrap">
            <button type="button" class="crm-btn crm-btn--small crm-btn--ghost" data-history="${p.id}">История</button>
            <button type="button" class="crm-btn crm-btn--small crm-btn--ghost" data-product-edit="${p.id}">Изменить</button>
          </td>
        </tr>`).join('')}`).join('');
    return `
      <div class="ext-row stock-tools">
        <input id="stock-q" type="search" placeholder="Найти сырьё" value="${esc(S.q)}" data-stock-q autocomplete="off">
        <select id="stock-cat" data-stock-cat><option value="">Все категории</option>${S.data.categories.map((c) => `<option ${S.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <label class="cz-check"><input id="stock-low" type="checkbox" data-stock-low ${S.onlyLow ? 'checked' : ''}> Только заканчивается</label>
        <button type="button" class="crm-btn" data-product-new>+ Сырьё</button>
      </div>
      <div data-product-form></div>
      <div data-history-box></div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Сырьё</th><th class="r">Остаток</th><th class="r">Минимум</th><th class="r">Ср. цена</th><th class="r">Сумма</th><th>Статус</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="tbl-empty">Ничего не нашлось</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function productFormHTML(p) {
    const isNew = !p;
    return `
      <form class="ext-card ext-emp" data-product-form-el novalidate>
        <h3>${isNew ? 'Новое сырьё' : 'Сырьё: ' + esc(p.name)}</h3>
        <div class="cz-grid cz-grid--4">
          <label class="cz-f"><span>Название</span><input id="pr-name" name="name" value="${esc(p ? p.name : '')}" autocomplete="off"></label>
          <label class="cz-f"><span>Категория</span><select id="pr-cat" name="category">${S.data.categories.map((c) => `<option ${p && p.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label class="cz-f"><span>Единица</span><select id="pr-unit" name="unit">${S.data.units.map((u) => `<option ${p && p.unit === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
          <label class="cz-f"><span>Минимальный остаток</span><input id="pr-min" name="min" inputmode="decimal" value="${p && p.min ? qtyText(p.min) : ''}" placeholder="0" autocomplete="off"></label>
        </div>
        ${isNew ? '' : `<label class="cz-check"><input id="pr-active" type="checkbox" name="active" ${p.active ? 'checked' : ''}> Используется (снимите, если больше не закупаете)</label>`}
        <p class="crm-note">Когда остаток станет меньше минимального, CRM покажет «Пора заказать», а в Telegram придёт сообщение.</p>
        <p class="cz-err" data-err></p>
        <div class="ext-row">
          <button type="submit" class="crm-btn">${isNew ? 'Добавить' : 'Сохранить'}</button>
          <button type="button" class="crm-btn crm-btn--ghost" data-product-cancel>Отмена</button>
        </div>
      </form>`;
  }

  const KIND_TEXT = { receipt: 'Приход', writeoff: 'Списание', inventory: 'Инвентаризация' };
  function historyHTML(h) {
    const rows = h.moves.map((m) => `
      <tr><td class="num">${dateText(m.date)}<small>${esc(dateShort(m.at))}</small></td>
      <td>${KIND_TEXT[m.kind]}${m.kind === 'receipt' && m.supplier ? `<small>${esc(m.supplier)}${m.number ? ', № ' + esc(m.number) : ''}</small>` : ''}${m.reason ? `<small>${esc(m.reason)}</small>` : ''}</td>
      <td class="r ${m.qty < 0 ? 'neg' : m.qty > 0 ? 'pos' : ''}">${m.qty > 0 ? '+' : ''}${qtyText(m.qty)} ${esc(h.product.unit)}</td>
      <td class="r">${m.price ? rub(m.price) : '—'}</td>
      <td>${m.expiry ? 'до ' + dateText(m.expiry) : ''}</td><td>${esc(m.by)}</td></tr>`).join('');
    return `
      <div class="ext-card">
        <div class="ext-report__head"><h3>История: ${esc(h.product.name)} · сейчас ${qtyText(h.product.qty)} ${esc(h.product.unit)}</h3>
        <button type="button" class="crm-x" data-history-close aria-label="Закрыть">×</button></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Дата</th><th>Операция</th><th class="r">Количество</th><th class="r">Цена</th><th>Срок</th><th>Кто</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="tbl-empty">Движений пока не было</td></tr>'}</tbody></table></div>
      </div>`;
  }

  // ---------- Документы: приход, списание, инвентаризация ----------
  function productOptions(selected) {
    return S.data.categories.map((c) => {
      const items = S.data.products.filter((p) => p.active && p.category === c);
      return items.length ? `<optgroup label="${esc(c)}">${items.map((p) => `<option value="${p.id}" ${Number(selected) === p.id ? 'selected' : ''}>${esc(p.name)}, ${esc(p.unit)}</option>`).join('')}</optgroup>` : '';
    }).join('');
  }

  function lineHTML(kind) {
    const opts = `<option value="">— выберите сырьё —</option>${productOptions()}`;
    if (kind === 'receipt') {
      return `<tr data-line>
        <td><select name="product" aria-label="Сырьё">${opts}</select></td>
        <td><input name="qty" inputmode="decimal" aria-label="Количество" autocomplete="off"><small data-unit></small></td>
        <td><input name="price" inputmode="decimal" aria-label="Цена за единицу" autocomplete="off"></td>
        <td><input name="expiry" type="date" aria-label="Годен до"></td>
        <td class="r" data-sum>—</td>
        <td><button type="button" class="cz-del" data-line-del aria-label="Убрать строку">×</button></td></tr>`;
    }
    return `<tr data-line>
      <td><select name="product" aria-label="Сырьё">${opts}</select></td>
      <td><input name="qty" inputmode="decimal" aria-label="Количество" autocomplete="off"><small data-unit></small></td>
      <td class="r" data-stock-now>—</td>
      <td class="r" data-sum>—</td>
      <td><button type="button" class="cz-del" data-line-del aria-label="Убрать строку">×</button></td></tr>`;
  }

  function docFormHTML(kind) {
    if (!S.data.products.length) return '<p class="crm-note">Сначала заполните справочник сырья во вкладке «Остатки».</p>';
    if (kind === 'inventory') return inventoryFormHTML();
    const receipt = kind === 'receipt';
    return `
      <form class="ext-card" data-doc-form novalidate>
        <h3>${receipt ? 'Новая накладная' : 'Новое списание'}</h3>
        <div class="cz-grid ${receipt ? 'cz-grid--4' : 'cz-grid--3'}">
          ${receipt
            ? `<label class="cz-f"><span>Поставщик</span><input id="doc-supplier" name="supplier" list="doc-suppliers" autocomplete="off" placeholder="Новый или из списка"><datalist id="doc-suppliers">${S.data.suppliers.map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist></label>
               <label class="cz-f"><span>№ накладной</span><input id="doc-number" name="number" autocomplete="off"></label>`
            : `<label class="cz-f"><span>Причина</span><select id="doc-reason" name="reason">${S.data.reasons.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>`}
          <label class="cz-f"><span>Дата</span><input id="doc-date" name="date" type="date" value="${esc(S.data.today)}"></label>
          <label class="cz-f"><span>Комментарий</span><input id="doc-note" name="note" autocomplete="off"></label>
        </div>
        <div class="table-wrap">
          <table class="tbl tbl--form">
            <thead><tr>${receipt
              ? '<th>Сырьё</th><th>Количество</th><th>Цена за ед., ₽</th><th>Годен до</th><th class="r">Сумма</th><th></th>'
              : '<th>Сырьё</th><th>Количество</th><th class="r">На складе</th><th class="r">Сумма по ср. цене</th><th></th>'}</tr></thead>
            <tbody data-lines>${lineHTML(kind)}</tbody>
          </table>
        </div>
        <div class="ext-row stock-total">
          <button type="button" class="crm-btn crm-btn--ghost crm-btn--small" data-line-add>+ Строка</button>
          <b data-doc-total>Итого: 0 ₽</b>
        </div>
        <p class="cz-err" data-err></p>
        <button type="submit" class="crm-btn crm-btn--block">${receipt ? 'Провести приход' : 'Провести списание'}</button>
      </form>`;
  }

  function inventoryFormHTML() {
    const cats = S.data.categories.filter((c) => S.data.products.some((p) => p.active && p.category === c));
    const rows = cats.map((c) => `
      <tr class="tbl-group"><td colspan="5">${esc(c)}</td></tr>
      ${S.data.products.filter((p) => p.active && p.category === c).map((p) => `
        <tr data-inv="${p.id}">
          <td>${esc(p.name)}</td>
          <td class="r">${qtyText(p.qty)} ${esc(p.unit)}</td>
          <td><input name="actual" inputmode="decimal" aria-label="Факт: ${esc(p.name)}" placeholder="—" autocomplete="off"></td>
          <td class="r" data-diff></td>
          <td class="r" data-diff-sum></td>
        </tr>`).join('')}`).join('');
    return `
      <form class="ext-card" data-inv-form novalidate>
        <h3>Инвентаризация</h3>
        <p class="crm-note">Пересчитайте сырьё и впишите фактический остаток. Пустые строки не меняются — можно считать по частям, например только рыбу.</p>
        <div class="cz-grid">
          <label class="cz-f"><span>Дата</span><input id="inv-date" name="date" type="date" value="${esc(S.data.today)}"></label>
          <label class="cz-f"><span>Комментарий</span><input id="inv-note" name="note" autocomplete="off"></label>
        </div>
        <div class="table-wrap"><table class="tbl tbl--form">
          <thead><tr><th>Сырьё</th><th class="r">По учёту</th><th>Факт</th><th class="r">Разница</th><th class="r">Сумма</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <div class="ext-row stock-total"><b data-inv-total>Пересчитано позиций: 0</b></div>
        <p class="cz-err" data-err></p>
        <button type="submit" class="crm-btn crm-btn--block">Провести инвентаризацию</button>
      </form>`;
  }

  function docsHTML(kind) {
    const docs = S.docs[kind] || [];
    if (!docs.length) return '<div class="table-wrap"><table class="tbl"><tbody><tr><td class="tbl-empty">Документов за месяц нет</td></tr></tbody></table></div>';
    const head = kind === 'receipt' ? '<th>Дата</th><th>Поставщик</th><th>№</th><th class="r">Позиций</th><th class="r">Сумма</th><th>Провёл(а)</th>'
      : kind === 'writeoff' ? '<th>Дата</th><th>Причина</th><th class="r">Позиций</th><th class="r">Сумма</th><th>Провёл(а)</th>'
        : '<th>Дата</th><th class="r">Пересчитано</th><th class="r">Итог</th><th>Провёл(а)</th>';
    const rows = docs.map((d) => {
      const open = S.openDoc === d.id;
      const main = kind === 'receipt'
        ? `<td class="num">${dateText(d.date)}</td><td>${esc(d.supplier)}</td><td>${esc(d.number) || '—'}</td><td class="r">${d.lines.length}</td><td class="r">${rub(d.total)}</td><td>${esc(d.by)}</td>`
        : kind === 'writeoff'
          ? `<td class="num">${dateText(d.date)}</td><td>${esc(d.reason)}${d.note ? `<small>${esc(d.note)}</small>` : ''}</td><td class="r">${d.lines.length}</td><td class="r">${rub(d.total)}</td><td>${esc(d.by)}</td>`
          : `<td class="num">${dateText(d.date)}</td><td class="r">${d.lines.length}</td><td class="r ${d.total < 0 ? 'neg' : d.total > 0 ? 'pos' : ''}">${d.total === 0 ? 'сошлось' : (d.total < 0 ? 'недостача ' : 'излишек ') + rub(Math.abs(d.total))}</td><td>${esc(d.by)}</td>`;
      const cols = kind === 'receipt' ? 6 : kind === 'writeoff' ? 5 : 4;
      const lines = !open ? '' : `<tr class="doc-lines"><td colspan="${cols}"><table class="tbl"><tbody>${d.lines.map((l) => kind === 'inventory'
        ? `<tr><td>${esc(l.name)}</td><td class="r">учёт ${qtyText(l.system)} → факт ${qtyText(l.system + l.qty)} ${esc(l.unit)}</td><td class="r ${l.qty < 0 ? 'neg' : l.qty > 0 ? 'pos' : ''}">${l.qty > 0 ? '+' : ''}${qtyText(l.qty)} ${esc(l.unit)}</td></tr>`
        : `<tr><td>${esc(l.name)}</td><td class="r">${qtyText(Math.abs(l.qty))} ${esc(l.unit)} × ${rub(l.price)}</td><td class="r">${rub(Math.abs(l.qty) * l.price)}</td>${kind === 'receipt' ? `<td>${l.expiry ? 'годен до ' + dateText(l.expiry) : ''}</td>` : ''}</tr>`).join('')}</tbody></table>
        ${d.note && kind !== 'writeoff' ? `<p class="crm-note">${esc(d.note)}</p>` : ''}</td></tr>`;
      return `<tr data-doc="${d.id}" tabindex="0" class="${open ? 'is-open' : ''}">${main}</tr>${lines}`;
    }).join('');
    return `<div class="table-wrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // пересчёт сумм в форме прихода или списания
  function updateDocForm(form) {
    const kind = S.section;
    let total = 0;
    form.querySelectorAll('[data-line]').forEach((tr) => {
      const p = byId(tr.querySelector('[name="product"]').value);
      const qty = num(tr.querySelector('[name="qty"]').value);
      tr.querySelector('[data-unit]').textContent = p ? p.unit : '';
      let sum = NaN;
      if (kind === 'receipt') sum = qty * num(tr.querySelector('[name="price"]').value);
      else {
        const now = tr.querySelector('[data-stock-now]');
        now.textContent = p ? `${qtyText(p.qty)} ${p.unit}` : '—';
        now.classList.toggle('neg', !!p && qty > p.qty);
        sum = p ? qty * p.avgPrice : NaN;
      }
      tr.querySelector('[data-sum]').textContent = Number.isFinite(sum) && sum > 0 ? rub(sum) : '—';
      if (Number.isFinite(sum) && sum > 0) total += sum;
    });
    form.querySelector('[data-doc-total]').textContent = `Итого: ${rub(total)}`;
  }

  function updateInvForm(form) {
    let count = 0, shortage = 0, surplus = 0;
    form.querySelectorAll('[data-inv]').forEach((tr) => {
      const p = byId(tr.dataset.inv);
      const raw = tr.querySelector('[name="actual"]').value.trim();
      const v = num(raw);
      const diffEl = tr.querySelector('[data-diff]'), sumEl = tr.querySelector('[data-diff-sum]');
      if (raw === '' || !Number.isFinite(v) || v < 0) { diffEl.textContent = ''; sumEl.textContent = ''; diffEl.className = 'r'; return; }
      count += 1;
      const diff = Math.round((v - p.qty) * 1000) / 1000;
      const money = diff * p.avgPrice;
      if (money < 0) shortage -= money; else surplus += money;
      diffEl.textContent = diff === 0 ? 'сходится' : `${diff > 0 ? '+' : ''}${qtyText(diff)} ${p.unit}`;
      diffEl.className = 'r ' + (diff < 0 ? 'neg' : diff > 0 ? 'pos' : '');
      sumEl.textContent = money ? (money < 0 ? '−' : '+') + rub(Math.abs(money)) : '';
    });
    form.querySelector('[data-inv-total]').textContent = `Пересчитано позиций: ${count}${shortage ? ` · недостача ${rub(shortage)}` : ''}${surplus ? ` · излишек ${rub(surplus)}` : ''}`;
  }

  function initDocForm(box) {
    const form = box.querySelector('[data-doc-form]');
    if (form) {
      form.addEventListener('input', () => updateDocForm(form));
      form.addEventListener('change', () => updateDocForm(form));
      form.addEventListener('submit', (e) => { e.preventDefault(); submitDoc(box, form); });
    }
    const inv = box.querySelector('[data-inv-form]');
    if (inv) {
      inv.addEventListener('input', () => updateInvForm(inv));
      inv.addEventListener('submit', (e) => { e.preventDefault(); submitInventory(box, inv); });
    }
  }

  async function submitDoc(box, form) {
    const kind = S.section;
    const err = form.querySelector('[data-err]');
    const lines = [];
    const problems = [];
    form.querySelectorAll('[data-line]').forEach((tr, i) => {
      const productId = tr.querySelector('[name="product"]').value;
      const qty = tr.querySelector('[name="qty"]').value.trim();
      if (!productId && !qty) return; // пустая строка
      if (!productId) return problems.push(`строка ${i + 1}: выберите сырьё`);
      if (!(num(qty) > 0)) return problems.push(`строка ${i + 1}: количество`);
      const line = { productId: Number(productId), qty };
      if (kind === 'receipt') {
        line.price = tr.querySelector('[name="price"]').value.trim() || '0';
        line.expiry = tr.querySelector('[name="expiry"]').value || null;
      }
      lines.push(line);
    });
    if (kind === 'receipt' && !form.supplier.value.trim()) problems.unshift('поставщик');
    if (!lines.length && !problems.length) problems.push('добавьте хотя бы одну позицию');
    if (problems.length) { err.textContent = 'Проверьте: ' + problems.join(', '); return; }
    const body = kind === 'receipt'
      ? { supplier: form.supplier.value.trim(), number: form.number.value.trim(), date: form.date.value, note: form.note.value.trim(), lines }
      : { reason: form.reason.value, date: form.date.value, note: form.note.value.trim(), lines };
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    err.textContent = '';
    try {
      const r = await api('POST', `/api/staff/stock/${kind === 'receipt' ? 'receipts' : 'writeoffs'}`, body);
      CRM.toast(`${kind === 'receipt' ? 'Приход проведён' : 'Списание проведено'} на ${rub(r.total)}`);
      await refresh(box);
      renderSection(box);
    } catch (e) {
      err.textContent = errText(e);
      btn.disabled = false;
    }
  }

  async function submitInventory(box, form) {
    const err = form.querySelector('[data-err]');
    const counts = [];
    let bad = '';
    form.querySelectorAll('[data-inv]').forEach((tr) => {
      const raw = tr.querySelector('[name="actual"]').value.trim();
      if (raw === '') return;
      if (!(num(raw) >= 0)) { bad = byId(tr.dataset.inv).name; return; }
      counts.push({ productId: Number(tr.dataset.inv), actual: raw });
    });
    if (bad) { err.textContent = `Неверный остаток: ${bad}`; return; }
    if (!counts.length) { err.textContent = 'Впишите фактический остаток хотя бы по одной позиции'; return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const r = await api('POST', '/api/staff/stock/inventory', { date: form.date.value, note: form.note.value.trim(), counts });
      CRM.toast(r.shortage || r.surplus ? `Инвентаризация проведена: недостача ${rub(r.shortage)}, излишек ${rub(r.surplus)}` : 'Инвентаризация проведена: всё сошлось');
      await refresh(box);
      renderSection(box);
    } catch (e) {
      err.textContent = errText(e);
      btn.disabled = false;
    }
  }

  // ---------- События ----------
  function bind(box) {
    box.addEventListener('click', async (e) => {
      const t = e.target.closest('button, [data-doc]');
      if (!t) return;
      if (t.dataset.section) { S.section = t.dataset.section; S.openDoc = null; S.editing = null; renderSection(box); return; }
      if (t.hasAttribute('data-starter')) {
        t.disabled = true;
        try { const r = await api('POST', '/api/staff/stock/starter'); CRM.toast(`Добавлено позиций: ${r.added}`); await refresh(box); renderSection(box); } catch (ex) { CRM.toast(errText(ex)); t.disabled = false; }
        return;
      }
      if (t.hasAttribute('data-product-new') || t.dataset.productEdit) {
        const p = t.dataset.productEdit ? byId(t.dataset.productEdit) : null;
        S.editing = p ? p.id : 'new';
        const holder = box.querySelector('[data-product-form]');
        holder.innerHTML = productFormHTML(p);
        holder.querySelector('form').addEventListener('submit', (ev) => { ev.preventDefault(); saveProduct(box, ev.target); });
        holder.querySelector('#pr-name').focus();
        holder.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (t.hasAttribute('data-product-cancel')) { S.editing = null; box.querySelector('[data-product-form]').innerHTML = ''; return; }
      if (t.dataset.history) {
        try {
          S.history = await api('GET', `/api/staff/stock/products/${t.dataset.history}/moves`);
          const h = box.querySelector('[data-history-box]');
          h.innerHTML = historyHTML(S.history);
          h.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (ex) { CRM.toast(errText(ex)); }
        return;
      }
      if (t.hasAttribute('data-history-close')) { box.querySelector('[data-history-box]').innerHTML = ''; return; }
      if (t.hasAttribute('data-line-add')) {
        const body = box.querySelector('[data-lines]');
        body.insertAdjacentHTML('beforeend', lineHTML(S.section));
        body.lastElementChild.querySelector('select').focus();
        return;
      }
      if (t.hasAttribute('data-line-del')) {
        const body = box.querySelector('[data-lines]');
        if (body.children.length > 1) t.closest('tr').remove();
        else body.innerHTML = lineHTML(S.section);
        updateDocForm(box.querySelector('[data-doc-form]'));
        return;
      }
      if (t.dataset.doc) {
        S.openDoc = S.openDoc === Number(t.dataset.doc) ? null : Number(t.dataset.doc);
        box.querySelector('[data-docs]').innerHTML = docsHTML(S.section);
      }
    });
    box.addEventListener('input', (e) => {
      if (e.target.matches('[data-stock-q]')) {
        S.q = e.target.value;
        const pos = e.target.selectionStart;
        box.querySelector('[data-stock-section]').innerHTML = stockHTML();
        const q = box.querySelector('[data-stock-q]');
        q.focus();
        q.setSelectionRange(pos, pos);
      }
    });
    box.addEventListener('change', (e) => {
      if (e.target.matches('[data-stock-cat]')) { S.cat = e.target.value; box.querySelector('[data-stock-section]').innerHTML = stockHTML(); }
      if (e.target.matches('[data-stock-low]')) { S.onlyLow = e.target.checked; box.querySelector('[data-stock-section]').innerHTML = stockHTML(); }
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-doc]')) e.target.click();
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
      await refresh(box);
      renderSection(box);
    } catch (e) {
      err.textContent = errText(e);
      btn.disabled = false;
    }
  }

  CRM.addView('stock', 'Склад', view);
})();
