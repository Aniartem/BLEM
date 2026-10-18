/*
 * CRM РОЛЛЕВИЧ: вкладка «Техкарты». Повар заполняет состав блюд в граммах, выход и технологию;
 * администратор дополнительно видит себестоимость и фудкост. Работает со своим сервером.
 */
(function () {
  const CRM = window.RollevichCRM;
  const Store = window.RollevichStore;
  if (!CRM || !Store) return;
  const { esc, rub, dateShort } = CRM.h;
  const api = (m, u, b) => Store.request(m, u, b);
  const errText = (e) => (e && e.message) || 'Не удалось выполнить. Проверьте интернет и повторите.';

  const S = { data: null, q: '', cat: '', filter: 'all', open: null, draft: null, dirty: false };
  const isAdmin = () => CRM.isManager(); // себестоимость и цены сырья видит только управляющий
  const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const fmt = (n, d = 3) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: d });
  const norm = (t) => String(t).toLowerCase().replace(/ё/g, 'е');
  const words = (t) => norm(t).split(/[^a-zа-я0-9]+/).filter(Boolean);

  // в техкарте граммы и миллилитры, на складе — килограммы и литры
  const SHOW = { 'кг': ['г', 1000], 'л': ['мл', 1000], 'шт': ['шт', 1], 'уп': ['уп', 1] };
  const show = (unit) => SHOW[unit] || [unit, 1];
  const product = (id) => S.data.products.find((p) => p.id === Number(id));
  const dish = (id) => S.data.dishes.find((d) => d.id === id);

  async function load() {
    try { S.data = await api('GET', '/api/staff/techcards'); } catch (e) { S.data = S.data || { dishes: [], products: [], filled: 0, total: 0, error: errText(e) }; }
  }

  const view = {
    cook: true,
    available: (kind) => kind === 'api',
    render(main) {
      if (main.dataset.ext === 'techcards') return;
      main.dataset.ext = 'techcards';
      main.innerHTML = '<div class="ext" data-tc-root><p class="crm-note">Загружаем техкарты…</p></div>';
      load().then(() => { CRM.head(); return S.open ? openEditor(main, S.open) : mountList(main); });
    },
    subtitle: () => (S.data ? `Заполнено ${S.data.filled} из ${S.data.total} блюд` : '')
  };

  // ---------- Список ----------
  const status = (d) => (!d.card || !d.card.lines.length ? ['Пусто', 'pill'] : d.incomplete ? ['Неполная', 'pill--new'] : ['Заполнена', 'pill--done']);
  const fcClass = (fc) => (fc == null ? '' : fc <= 30 ? 'pos' : fc <= 40 ? 'warn' : 'neg');

  function mountList(main) {
    const box = main.querySelector('[data-tc-root]');
    if (!box) return;
    const admin = isAdmin();
    const filled = S.data.dishes.filter((d) => d.card && d.card.lines.length);
    const fcs = filled.map((d) => d.foodCost).filter((x) => x != null);
    const avgFc = fcs.length ? Math.round((fcs.reduce((a, b) => a + b, 0) / fcs.length) * 10) / 10 : null;
    const cats = [...new Set(S.data.dishes.map((d) => d.category))];
    box.innerHTML = `
      <div class="tc-progress"><span style="width:${S.data.total ? (S.data.filled / S.data.total) * 100 : 0}%"></span></div>
      ${admin ? `<p class="crm-note">Средний фудкост заполненных блюд: <b>${avgFc == null ? '—' : fmt(avgFc, 1) + '%'}</b>. Себестоимость считается по средней цене прихода на склад. Когда заказ уходит на кухню, сырьё по техкарте списывается со склада.</p>`
        : '<p class="crm-note">Укажите для каждого блюда сырьё и граммовку на одну порцию, выход и технологию. По этим данным склад будет списывать сырьё, а на сайте появится вес порции.</p>'}
      <div class="ext-row stock-tools">
        <input id="tc-q" type="search" placeholder="Найти блюдо" value="${esc(S.q)}" data-tc-q autocomplete="off">
        <select id="tc-cat" data-tc-cat><option value="">Все разделы меню</option>${cats.map((c) => `<option ${S.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <div class="chips">${[['all', 'Все'], ['empty', 'Не заполнены'], ['done', 'Заполнены']].map(([id, t]) => `<button type="button" class="chip ${S.filter === id ? 'is-on' : ''}" data-tc-filter="${id}">${t}</button>`).join('')}</div>
      </div>
      <div class="table-wrap" data-tc-table>${tableHTML()}</div>`;
    if (!box.dataset.bound) { bindList(box); box.dataset.bound = '1'; }
  }

  function tableHTML() {
    const admin = isAdmin();
    const toks = words(S.q);
    const list = S.data.dishes.filter((d) => {
      const filled = d.card && d.card.lines.length;
      const w = words(d.name);
      return (!S.cat || d.category === S.cat) &&
        (S.filter === 'all' || (S.filter === 'done' ? filled : !filled)) &&
        toks.every((t) => w.some((x) => x.startsWith(t)));
    });
    if (!list.length) return '<table class="tbl"><tbody><tr><td class="tbl-empty">Ничего не нашлось</td></tr></tbody></table>';
    let cat = '';
    const cols = admin ? 7 : 4;
    const rows = list.map((d) => {
      const head = d.category !== cat ? `<tr class="tbl-group"><td colspan="${cols}">${esc(d.category)}</td></tr>` : '';
      cat = d.category;
      const [st, cls] = status(d);
      return head + `
        <tr data-tc-open="${esc(d.id)}" tabindex="0">
          <td>${esc(d.name)}<small>${esc(d.meta || '')}</small></td>
          <td class="r">${d.card && d.card.yield ? fmt(d.card.yield, 0) + ' г' : '—'}</td>
          ${admin ? `<td class="r">${d.cost != null ? rub(d.cost) : '—'}</td><td class="r">${rub(d.price)}</td>
            <td class="r ${fcClass(d.foodCost)}">${d.foodCost != null ? fmt(d.foodCost, 1) + '%' : '—'}</td>` : ''}
          <td><span class="pill ${cls}">${st}</span></td>
          <td class="r"><button type="button" class="crm-btn crm-btn--small crm-btn--ghost" data-tc-open="${esc(d.id)}">${d.card && d.card.lines.length ? 'Открыть' : 'Заполнить'}</button></td>
        </tr>`;
    }).join('');
    return `<table class="tbl"><thead><tr><th>Блюдо</th><th class="r">Выход</th>${admin ? '<th class="r">Себестоимость</th><th class="r">Цена</th><th class="r">Фудкост</th>' : ''}<th>Статус</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function bindList(box) {
    box.addEventListener('input', (e) => {
      if (!e.target.matches('[data-tc-q]')) return;
      S.q = e.target.value;
      box.querySelector('[data-tc-table]').innerHTML = tableHTML();
    });
    box.addEventListener('change', (e) => {
      if (e.target.matches('[data-tc-cat]')) { S.cat = e.target.value; box.querySelector('[data-tc-table]').innerHTML = tableHTML(); }
    });
    box.addEventListener('click', (e) => {
      const f = e.target.closest('[data-tc-filter]');
      if (f) {
        S.filter = f.dataset.tcFilter;
        box.querySelectorAll('[data-tc-filter]').forEach((b) => b.classList.toggle('is-on', b === f));
        box.querySelector('[data-tc-table]').innerHTML = tableHTML();
        return;
      }
      const o = e.target.closest('[data-tc-open]');
      if (o && box.querySelector('[data-tc-table]')) openEditor(box.parentElement, o.dataset.tcOpen);
    });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-tc-open]')) e.target.click(); });
  }

  // ---------- Редактор ----------
  function openEditor(main, dishId) {
    const d = dish(dishId);
    if (!d) return mountList(main);
    S.open = dishId;
    S.dirty = false;
    S.draft = {
      yield: d.card && d.card.yield ? String(d.card.yield) : '',
      method: d.card ? d.card.method : '',
      lines: d.card ? d.card.lines.map((l) => ({ kind: l.kind, ref: l.ref, shown: l.kind === 'product' ? fmt(l.qty * show((product(l.ref) || l).unit)[1]) : fmt(l.qty) })) : []
    };
    const box = main.querySelector('[data-tc-root]');
    box.dataset.bound = '';
    const fresh = box.cloneNode(false); // снимаем обработчики списка
    box.replaceWith(fresh);
    renderEditor(fresh);
    fresh.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // списки для полей с подсказками: вписываешь начало названия — выбираешь
  CRM.combo.source('tc-products', () => (S.data ? S.data.products.map((p) => ({ value: String(p.id), label: p.name, hint: p.category })) : []));
  CRM.combo.source('tc-dishes', () => (S.data ? S.data.dishes.filter((d) => d.id !== S.open).map((d) => ({ value: d.id, label: d.name, hint: d.category })) : []));

  function lineHTML(l, i) {
    const admin = isAdmin();
    const isDish = l.kind === 'dish';
    const p = !isDish && product(l.ref);
    const unit = isDish ? 'порц.' : p ? show(p.unit)[0] : '';
    return `
      <tr data-tc-line="${i}">
        <td><span class="tc-kind">${isDish ? 'Блюдо' : 'Сырьё'}</span></td>
        <td>${CRM.combo.html({
          source: isDish ? 'tc-dishes' : 'tc-products', value: l.ref, attrs: 'data-f="ref"', label: isDish ? 'Блюдо' : 'Сырьё',
          placeholder: isDish ? 'Начните вписывать блюдо' : 'Начните вписывать сырьё',
          empty: isDish ? '' : 'Нет нужного — попросите управляющего добавить его во вкладке «Склад»'
        })}</td>
        <td class="tc-qty"><input data-f="shown" inputmode="decimal" value="${esc(l.shown)}" aria-label="Количество" autocomplete="off"><span>${esc(unit)}</span></td>
        ${admin ? `<td class="r" data-line-cost>${lineCost(l)}</td>` : ''}
        <td><button type="button" class="cz-del" data-tc-del="${i}" aria-label="Убрать строку">×</button></td>
      </tr>`;
  }

  // количество в единицах склада (кг, л, шт, уп) или порциях блюда
  function baseQty(l) {
    const v = num(l.shown);
    if (!(v > 0)) return NaN;
    if (l.kind === 'dish') return v;
    const p = product(l.ref);
    return p ? v / show(p.unit)[1] : NaN;
  }
  function lineCostValue(l) {
    const q = baseQty(l);
    if (!Number.isFinite(q)) return NaN;
    if (l.kind === 'dish') { const d = dish(l.ref); return d && d.cost != null ? q * d.cost : NaN; }
    const p = product(l.ref);
    return p ? q * (p.avgPrice || 0) : NaN;
  }
  const lineCost = (l) => { const c = lineCostValue(l); return Number.isFinite(c) ? rub(c) : '—'; };

  function totalsHTML() {
    const d = dish(S.open);
    const lines = S.draft.lines;
    let grams = 0;
    lines.forEach((l) => { const p = l.kind === 'product' && product(l.ref); if (p && (p.unit === 'кг' || p.unit === 'л')) { const v = num(l.shown); if (v > 0) grams += v; } });
    const parts = [`Сырьё по весу: <b>${fmt(grams, 0)} г</b>${S.draft.yield ? ` при выходе ${esc(S.draft.yield)} г` : ''}`];
    if (isAdmin()) {
      const cost = lines.reduce((s, l) => { const c = lineCostValue(l); return Number.isFinite(c) ? s + c : s; }, 0);
      const fc = d.price ? (cost / d.price) * 100 : null;
      parts.push(`Себестоимость: <b>${rub(cost)}</b>`, `Цена в меню: <b>${rub(d.price)}</b>`,
        `Фудкост: <b class="${fcClass(fc)}">${fc == null ? '—' : fmt(fc, 1) + '%'}</b>`);
      if (lines.some((l) => l.kind === 'dish' && (dish(l.ref) || {}).cost == null)) parts.push('<span class="warn">В составе есть блюдо без техкарты — себестоимость неполная</span>');
    }
    return parts.join(' · ');
  }

  function renderEditor(box) {
    const d = dish(S.open);
    const admin = isAdmin();
    const card = d.card;
    box.innerHTML = `
      <div class="ext-row"><button type="button" class="crm-btn crm-btn--ghost crm-btn--small" data-tc-back>← Все техкарты</button></div>
      <form class="ext-card tc-editor" data-tc-form novalidate>
        <div class="ext-headline">
          <h2>${esc(d.name)}</h2>
          <span>${esc(d.category)}${d.meta ? ' · ' + esc(d.meta) : ''}${admin ? ' · ' + rub(d.price) : ''}</span>
        </div>
        <p class="crm-note">Состав в меню: ${esc(d.desc || '—')}</p>
        ${card ? `<p class="crm-note">Последнее изменение: ${esc(card.updatedBy)}, ${esc(dateShort(card.updatedAt))}</p>` : ''}
        <label class="cz-f tc-yield"><span>Выход порции, г</span><input id="tc-yield" data-f="yield" inputmode="decimal" value="${esc(S.draft.yield)}" placeholder="например, 260" autocomplete="off"></label>
        <h3>Состав на одну порцию</h3>
        <div class="table-wrap"><table class="tbl tbl--form">
          <thead><tr><th></th><th>Сырьё или блюдо</th><th>Количество</th>${admin ? '<th class="r">Стоимость</th>' : ''}<th></th></tr></thead>
          <tbody data-tc-lines>${S.draft.lines.map(lineHTML).join('') || `<tr><td colspan="${admin ? 5 : 4}" class="tbl-empty">Строк пока нет</td></tr>`}</tbody>
        </table></div>
        <div class="ext-row">
          <button type="button" class="crm-btn crm-btn--ghost crm-btn--small" data-tc-add="product">+ Сырьё</button>
          <button type="button" class="crm-btn crm-btn--ghost crm-btn--small" data-tc-add="dish">+ Блюдо (для сетов)</button>
          <button type="button" class="crm-btn crm-btn--ghost crm-btn--small" data-tc-suggest>Подставить сырьё из состава</button>
        </div>
        <p class="crm-note" data-tc-suggest-note></p>
        <p class="tc-totals" data-tc-totals>${totalsHTML()}</p>
        <label class="cz-f"><span>Технология приготовления</span><textarea id="tc-method" data-f="method" rows="5" placeholder="Порядок сборки, нарезка, подача">${esc(S.draft.method)}</textarea></label>
        <p class="cz-err" data-err></p>
        <div class="ext-row">
          <button type="submit" class="crm-btn">Сохранить техкарту</button>
          <button type="button" class="crm-btn crm-btn--ghost" data-tc-back>Отмена</button>
        </div>
      </form>`;
    bindEditor(box);
  }

  function redrawLines(box) {
    const admin = isAdmin();
    box.querySelector('[data-tc-lines]').innerHTML = S.draft.lines.map(lineHTML).join('') || `<tr><td colspan="${admin ? 5 : 4}" class="tbl-empty">Строк пока нет</td></tr>`;
    box.querySelector('[data-tc-totals]').innerHTML = totalsHTML();
  }

  // как в составах меню называют сырьё со склада
  const ALIASES = { 'сыр': 'Сливочный сыр', 'сливочный сыр': 'Сливочный сыр', 'лосось': 'Лосось охлаждённый', 'краб': 'Снежный краб',
    'крабовые палочки': 'Снежный краб', 'мясо краба': 'Снежный краб', 'крабные палочки': 'Снежный краб', 'креветка': 'Креветка тигровая',
    'креветки': 'Креветка тигровая', 'угорь': 'Угорь копчёный', 'курица': 'Куриное филе', 'тобико': 'Икра тобико', 'икра летучей рыбы': 'Икра тобико',
    'соевая бумага': 'Соевая бумага', 'соус унаги': 'Соус унаги', 'унаги': 'Соус унаги', 'спайси соус': 'Соус спайси', 'острый соус': 'Соус спайси' };

  // «Нори, рис, лосось, сыр, огурец» → позиции склада: сначала словарь, затем совпадение начала слов
  // (совпадение с первым словом названия весит больше: «лосось» → «Лосось охлаждённый», а не «Икра лосося»)
  function suggest() {
    const d = dish(S.open);
    const stem = (w) => w.slice(0, Math.min(w.length, 4));
    const found = [], missed = [];
    String(d.desc || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean).forEach((part) => {
      const ws = words(part).filter((w) => w.length >= 3);
      const alias = ALIASES[norm(part).replace(/\s+/g, ' ')];
      let best = alias ? S.data.products.find((p) => norm(p.name) === norm(alias)) : null, score = 0;
      if (!best) S.data.products.forEach((p) => {
        const pw = words(p.name).map(stem);
        const hits = ws.filter((w) => pw.includes(stem(w))).length;
        const sc = hits ? hits * 2 + (ws.some((w) => stem(w) === pw[0]) ? 1 : 0) - pw.length * 0.1 : 0;
        if (sc > score) { score = sc; best = p; }
      });
      if (best && !found.includes(best.id) && !S.draft.lines.some((l) => l.kind === 'product' && Number(l.ref) === best.id)) found.push(best.id);
      else if (!best) missed.push(part);
    });
    found.forEach((id) => S.draft.lines.push({ kind: 'product', ref: id, shown: '' }));
    return { added: found.length, missed };
  }

  function bindEditor(box) {
    const form = box.querySelector('[data-tc-form]');
    const leave = () => {
      if (S.dirty && !box.dataset.confirmLeave) {
        box.dataset.confirmLeave = '1';
        box.querySelector('[data-err]').textContent = 'Есть несохранённые изменения. Нажмите «Все техкарты» ещё раз, чтобы выйти без сохранения.';
        return;
      }
      S.open = null;
      S.draft = null;
      const main = box.parentElement;
      main.innerHTML = '<div class="ext" data-tc-root></div>';
      mountList(main);
    };
    box.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.hasAttribute('data-tc-back')) return leave();
      if (t.dataset.tcAdd) {
        S.draft.lines.push({ kind: t.dataset.tcAdd, ref: '', shown: t.dataset.tcAdd === 'dish' ? '1' : '' });
        S.dirty = true;
        redrawLines(box);
        const rows = box.querySelectorAll('[data-tc-line]');
        rows[rows.length - 1].querySelector('.combo__input').focus();
        return;
      }
      if (t.dataset.tcDel !== undefined) { S.draft.lines.splice(Number(t.dataset.tcDel), 1); S.dirty = true; redrawLines(box); return; }
      if (t.hasAttribute('data-tc-suggest')) {
        const r = suggest();
        S.dirty = S.dirty || r.added > 0;
        redrawLines(box);
        box.querySelector('[data-tc-suggest-note]').textContent = (r.added ? `Добавлено строк: ${r.added} — впишите граммовку.` : 'Новых совпадений со складом нет.') +
          (r.missed.length ? ` Нет на складе: ${r.missed.join(', ')} — попросите администратора добавить это сырьё во вкладке «Склад».` : '');
      }
    });
    form.addEventListener('input', (e) => {
      const f = e.target.dataset.f;
      if (!f) return;
      S.dirty = true;
      delete box.dataset.confirmLeave;
      const row = e.target.closest('[data-tc-line]');
      if (row) {
        const l = S.draft.lines[Number(row.dataset.tcLine)];
        if (f === 'ref') {
          l.ref = e.target.value;
          if (!l.ref) return; // начали вписывать заново — ждём выбора
          const i = row.dataset.tcLine;
          redrawLines(box);
          const qty = box.querySelector(`[data-tc-line="${i}"] [data-f="shown"]`);
          if (qty) qty.focus(); // выбрали — сразу вписываем граммовку
          return;
        }
        l.shown = e.target.value;
        const c = row.querySelector('[data-line-cost]');
        if (c) c.textContent = lineCost(l);
      } else S.draft[f] = e.target.value;
      box.querySelector('[data-tc-totals]').innerHTML = totalsHTML();
    });
    form.addEventListener('change', (e) => {
      const row = e.target.closest('[data-tc-line]');
      if (row && e.target.dataset.f === 'ref') { S.draft.lines[Number(row.dataset.tcLine)].ref = e.target.value; S.dirty = true; }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('[data-err]');
      const lines = [];
      const problems = [];
      S.draft.lines.forEach((l, i) => {
        if (!l.ref && !String(l.shown).trim()) return; // пустая строка
        if (!l.ref) return problems.push(`строка ${i + 1}: выберите ${l.kind === 'dish' ? 'блюдо' : 'сырьё'}`);
        const q = baseQty(l);
        if (!(q > 0)) return problems.push(`строка ${i + 1}: количество`);
        lines.push({ kind: l.kind, ref: l.ref, qty: Math.round(q * 10000) / 10000 });
      });
      const y = S.draft.yield.trim() === '' ? 0 : num(S.draft.yield);
      if (!(y >= 0)) problems.push('выход порции');
      if (problems.length) { err.textContent = 'Проверьте: ' + problems.join(', '); return; }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api('PUT', `/api/staff/techcards/${encodeURIComponent(S.open)}`, { yield: y, method: S.draft.method, lines });
        S.dirty = false;
        CRM.toast(`Техкарта «${dish(S.open).name}» сохранена`);
        await load();
        CRM.head();
        openEditor(box.parentElement, S.open);
      } catch (ex) {
        err.textContent = errText(ex);
        btn.disabled = false;
      }
    });
  }

  CRM.addView('techcards', 'Техкарты', { group: 'Кухня', icon: 'book', ...view });
})();
