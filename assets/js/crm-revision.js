/*
 * CRM РОЛЛЕВИЧ: вкладка «Ревизия» — пересчёт продуктов на кухне. Видят все, кто входит в CRM.
 * Сотрудники вписывают факт «вслепую», управляющий видит расхождения и проводит ревизию.
 */
(function () {
  const CRM = window.RollevichCRM;
  const Store = window.RollevichStore;
  if (!CRM || !Store) return;
  const { esc, rub, hhmm, dateShort, plural } = CRM.h;
  const api = (m, u, b) => Store.request(m, u, b);
  const errText = (e) => (e && e.message) || 'Не удалось выполнить. Проверьте интернет и повторите.';

  const R = { data: null, q: '', filter: 'all', confirm: null };
  const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const qtyText = (n) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 3 });
  const norm = (t) => String(t).toLowerCase().replace(/ё/g, 'е');

  async function load() {
    try { R.data = await api('GET', '/api/staff/revision'); } catch (e) { R.data = R.data || { current: null, history: [], products: [], categories: [], error: errText(e) }; }
  }

  let timer;
  const view = {
    cook: true,
    group: 'Кухня',
    icon: 'clipboard',
    available: (kind) => kind === 'api',
    subtitle() {
      const c = R.data && R.data.current;
      return c ? `Идёт с ${hhmm(c.startedAt)} · начал(а) ${c.startedBy}` : 'Пересчёт продуктов на кухне';
    },
    render(main) {
      if (main.dataset.ext === 'revision') return;
      main.dataset.ext = 'revision';
      R.confirm = null;
      main.innerHTML = '<div class="ext" data-rev-root><p class="crm-note">Загружаем…</p></div>';
      load().then(() => mount(main));
      // пока вкладка открыта, подтягиваем то, что насчитали коллеги с других телефонов
      clearInterval(timer);
      timer = setInterval(async () => {
        if (!CRM.isActive('revision')) { clearInterval(timer); return; }
        const box = document.querySelector('[data-rev-root]');
        if (!box || box.contains(document.activeElement) && document.activeElement.matches('input')) return;
        await load();
        paint(box);
      }, 10000);
    }
  };

  function mount(main) {
    const box = main.querySelector('[data-rev-root]');
    if (!box) return;
    bind(box);
    paint(box);
  }

  function paint(box) {
    CRM.head();
    const c = R.data.current;
    box.innerHTML = (c ? openHTML(c) : startHTML()) + historyHTML();
  }

  // ---------- Ревизия не идёт ----------
  function startHTML() {
    return `
      <div class="ext-card ext-open">
        <h2>Ревизия</h2>
        <p>Пересчитайте продукты на кухне и впишите, сколько есть на самом деле. Можно считать вдвоём-втроём с разных телефонов — каждая цифра сохраняется сразу.</p>
        ${R.data.products.length ? '' : '<p>Справочник сырья пока пуст — его заполняет управляющий во вкладке «Склад».</p>'}
        <div class="ext-row"><button type="button" class="crm-btn" data-rev-start ${R.data.products.length ? '' : 'disabled'}>Начать ревизию</button></div>
      </div>`;
  }

  // ---------- Ревизия идёт ----------
  // сколько посчитано; управляющему — во что выходит
  function headHTML(c) {
    const total = R.data.products.length;
    const left = total - c.counted;
    return `
      <div class="ext-card rev-head">
        <div class="rev-progress"><b>Посчитано ${c.counted} из ${total}</b><span>${left ? 'осталось ' + left : 'всё посчитано'}</span></div>
        <div class="tc-progress"><span style="width:${total ? (c.counted / total) * 100 : 0}%"></span></div>
        ${CRM.isManager() && c.counted ? `<p class="rev-money">Пока выходит: ${c.shortage || c.surplus ? [c.shortage ? `<span class="neg">недостача ${rub(c.shortage)}</span>` : '', c.surplus ? `<span class="pos">излишек ${rub(c.surplus)}</span>` : ''].filter(Boolean).join(' · ') : 'всё сходится'}</p>` : ''}
      </div>`;
  }

  function openHTML(c) {
    const manager = CRM.isManager();
    return `
      ${headHTML(c)}
      <div class="ext-row stock-tools">
        <input id="rev-q" type="search" placeholder="Найти продукт" value="${esc(R.q)}" data-rev-q autocomplete="off" aria-label="Найти продукт">
        <div class="chips" role="tablist">${[['all', 'Все'], ['left', 'Не посчитано']].map(([id, t]) => `<button type="button" class="chip ${R.filter === id ? 'is-on' : ''}" data-rev-filter="${id}">${t}</button>`).join('')}</div>
      </div>
      <div data-rev-list>${listHTML()}</div>
      <div class="ext-card">
        ${manager ? closeHTML(c) : '<p>Когда всё посчитаете, управляющий проверит расхождения и проведёт ревизию. Ошиблись — просто впишите правильную цифру.</p>'}
      </div>`;
  }

  function listHTML() {
    const c = R.data.current;
    const qn = norm(R.q.trim());
    const list = R.data.products.filter((p) => (!qn || norm(p.name).includes(qn)) && (R.filter === 'all' || !c.counts[p.id]));
    if (!list.length) return `<div class="list"><p class="list-empty">${R.filter === 'left' && !qn ? 'Всё посчитано 🎉' : 'Ничего не нашлось'}</p></div>`;
    return `<div class="list">${R.data.categories.filter((g) => list.some((p) => p.category === g)).map((g) => `
      <div class="list-group">${esc(g)}</div>
      ${list.filter((p) => p.category === g).map(rowHTML).join('')}`).join('')}</div>`;
  }

  function rowHTML(p) {
    const c = R.data.current.counts[p.id];
    const manager = CRM.isManager();
    let aside = '';
    if (manager && c) {
      const diff = Math.round((c.qty - p.qty) * 1000) / 1000;
      const money = diff * p.avgPrice;
      aside = `<b class="${diff < 0 ? 'neg' : diff > 0 ? 'pos' : ''}">${diff === 0 ? 'сходится' : (diff > 0 ? '+' : '') + qtyText(diff) + ' ' + esc(p.unit)}</b><small>${money ? (money < 0 ? '−' : '+') + rub(Math.abs(money)) : ''}</small>`;
    }
    const who = c ? `${esc(c.by)} · ${hhmm(c.at)}` : 'не посчитано';
    return `
      <div class="list-row inv-row rev-row ${c ? 'is-counted' : ''}" data-rev-row="${p.id}">
        <span class="list-row__main"><b>${esc(p.name)}</b><small>${c ? '✓ ' : ''}${who}${manager ? ` · по учёту ${qtyText(p.qty)} ${esc(p.unit)}` : ''}</small></span>
        <span class="list-row__aside">${aside}</span>
        <label class="line__qty inv-input"><input data-rev-input="${p.id}" value="${c ? qtyText(c.qty) : ''}" inputmode="decimal" placeholder="Сколько" aria-label="Сколько есть: ${esc(p.name)}" autocomplete="off" enterkeyhint="next"><span data-unit>${esc(p.unit)}</span></label>
      </div>`;
  }

  function closeHTML(c) {
    if (R.confirm === 'close') {
      return `
        <h3>Провести ревизию?</h3>
        <p>Остатки склада по ${plural(c.counted, 'посчитанной позиции', 'посчитанным позициям', 'посчитанным позициям')} станут такими, как вписали. Отменить это нельзя.</p>
        <div class="ext-row"><button type="button" class="crm-btn" data-rev-close-yes>Да, провести</button><button type="button" class="crm-btn crm-btn--ghost" data-rev-confirm="">Нет</button></div>`;
    }
    if (R.confirm === 'cancel') {
      return `
        <h3>Отменить ревизию?</h3>
        <p>Всё, что насчитали, не попадёт на склад.</p>
        <div class="ext-row"><button type="button" class="crm-btn crm-btn--danger" data-rev-cancel-yes>Да, отменить</button><button type="button" class="crm-btn crm-btn--ghost" data-rev-confirm="">Нет</button></div>`;
    }
    return `
      <p>Остатки склада станут такими, как посчитано. Непосчитанные позиции не меняются. Проводите сразу после пересчёта, пока не ушли новые заказы.</p>
      <button type="button" class="crm-btn crm-btn--block" data-rev-confirm="close" ${c.counted ? '' : 'disabled'}>Провести ревизию</button>
      <div><button type="button" class="crm-btn crm-btn--link crm-btn--danger-text" data-rev-confirm="cancel">Отменить ревизию</button></div>`;
  }

  // ---------- Прошлые ревизии ----------
  function historyHTML() {
    const h = R.data.history;
    if (!h.length) return '';
    return `
      <h3 class="ext-h">Прошлые ревизии</h3>
      <div class="list">${h.map((r) => {
        const result = r.status === 'cancelled' ? '<b class="muted-b">отменена</b>'
          : r.shortage != null ? `<b class="${r.shortage ? 'neg' : r.surplus ? 'pos' : ''}">${r.shortage ? '−' + rub(r.shortage) : r.surplus ? '+' + rub(r.surplus) : 'сошлось'}</b>`
            : '<b>проведена</b>';
        return `
          <div class="list-row">
            <span class="sdot ${r.status === 'done' ? (r.shortage ? 'sdot--out' : 'sdot--ok') : 'sdot--none'}"></span>
            <span class="list-row__main"><b>Ревизия № ${r.id}</b><small>${esc(dateShort(r.startedAt))}${r.counters.length ? ' · считали: ' + r.counters.map(esc).join(', ') : ''}${r.closedBy ? ` · ${r.status === 'done' ? 'провёл(а)' : 'отменил(а)'} ${esc(r.closedBy)}` : ''}</small></span>
            <span class="list-row__aside">${result}<small>${plural(r.positions, 'позиция', 'позиции', 'позиций')}</small></span>
          </div>`;
      }).join('')}</div>`;
  }

  // ---------- Действия ----------
  async function save(box, input) {
    const id = Number(input.dataset.revInput);
    const c = R.data.current;
    const raw = input.value.trim();
    const was = c.counts[id];
    if (raw === '' ? !was : was && num(raw) === was.qty) return; // ничего не поменялось
    if (raw !== '' && !(num(raw) >= 0)) { CRM.toast('Неверное количество — впишите число, например 2,5'); input.focus(); return; }
    try {
      const r = await api('PUT', `/api/staff/revisions/${c.id}/counts/${id}`, { qty: raw });
      const me = CRM.user();
      if (r.qty === null) delete c.counts[id];
      else c.counts[id] = { qty: r.qty, by: me ? me.name : '', at: Date.now() };
      c.counted = Object.keys(c.counts).length;
      // обновляем строку и шапку, не трогая поле, в котором человек сейчас печатает
      const row = box.querySelector(`[data-rev-row="${id}"]`);
      const p = R.data.products.find((x) => x.id === id);
      if (row && p) {
        const focused = document.activeElement;
        row.outerHTML = rowHTML(p);
        if (focused && focused.dataset && focused.dataset.revInput && focused.dataset.revInput !== String(id)) focused.focus();
      }
      if (CRM.isManager()) await load(); // пересчитать «пока выходит» по ценам склада
      const head = box.querySelector('.rev-head');
      if (head && R.data.current) head.outerHTML = headHTML(R.data.current);
    } catch (e) {
      CRM.toast(errText(e));
      if (e && /завершена/.test(e.message)) { await load(); paint(box); }
    }
  }

  function bind(box) {
    box.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.hasAttribute('data-rev-start')) {
        t.disabled = true;
        try { R.data = await api('POST', '/api/staff/revisions'); CRM.toast('Ревизия начата — вписывайте, сколько есть'); } catch (ex) { CRM.toast(errText(ex)); await load(); }
        paint(box);
        const first = box.querySelector('[data-rev-input]');
        if (first) first.focus();
        return;
      }
      if (t.dataset.revFilter) { R.filter = t.dataset.revFilter; paint(box); return; }
      if (t.hasAttribute('data-rev-confirm')) { R.confirm = t.dataset.revConfirm || null; paint(box); return; }
      if (t.hasAttribute('data-rev-close-yes') || t.hasAttribute('data-rev-cancel-yes')) {
        const closing = t.hasAttribute('data-rev-close-yes');
        t.disabled = true;
        try {
          const r = await api('POST', `/api/staff/revisions/${R.data.current.id}/${closing ? 'close' : 'cancel'}`);
          CRM.toast(!closing ? 'Ревизия отменена'
            : r.shortage || r.surplus ? `Ревизия проведена: недостача ${rub(r.shortage)}, излишек ${rub(r.surplus)}` : 'Ревизия проведена: всё сошлось');
        } catch (ex) { CRM.toast(errText(ex)); }
        R.confirm = null;
        await load();
        paint(box);
      }
    });
    box.addEventListener('input', (e) => {
      if (!e.target.matches('[data-rev-q]')) return;
      R.q = e.target.value;
      box.querySelector('[data-rev-list]').innerHTML = listHTML();
    });
    box.addEventListener('change', (e) => { if (e.target.matches('[data-rev-input]')) save(box, e.target); });
    // Enter — к следующей позиции: считать быстро, не отрываясь от списка
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target.matches('[data-rev-input]')) return;
      e.preventDefault();
      const all = [...box.querySelectorAll('[data-rev-input]')];
      const next = all[all.indexOf(e.target) + 1];
      e.target.blur();
      if (next) next.focus();
    });
  }

  CRM.addView('revision', 'Ревизия', view);
})();
