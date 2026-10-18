/*
 * CRM РОЛЛЕВИЧ: вкладки «Касса» (кассовая смена) и «Смены» (табель сотрудников).
 * Работают только со своим сервером: деньги и ПИН-коды не хранятся в браузере.
 */
(function () {
  const CRM = window.RollevichCRM;
  const Store = window.RollevichStore;
  if (!CRM || !Store) return;
  const { esc, rub, hhmm, dateShort, plural, pad } = CRM.h;

  const S = {
    cash: null,        // { current, history }
    closedReport: null,
    timeclock: null,   // { onShift, employees, shifts, from, to }
    employees: null,   // { employees, roles }
    period: 'today',
    editing: null,     // id сотрудника или 'new'
    loaded: false
  };
  const hours = (min) => `${Math.floor(min / 60)} ч ${pad(min % 60)} мин`;
  const sinceText = (t) => hours(Math.max(0, Math.round((Date.now() - t) / 60000)));
  const money = (v) => {
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  };
  const errText = (e) => (e && e.message) || 'Не удалось выполнить. Проверьте интернет и повторите.';
  const api = (m, u, b) => Store.request(m, u, b);

  // ---------- Загрузка данных ----------
  async function loadCash() {
    try { S.cash = await api('GET', '/api/staff/cash'); } catch (e) { S.cash = S.cash || { current: null, history: [], error: errText(e) }; }
  }

  function periodRange(p) {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const day = 864e5, t0 = d.getTime();
    if (p === 'yesterday') return [t0 - day, t0];
    if (p === 'week') { const wd = (d.getDay() + 6) % 7; return [t0 - wd * day, Date.now() + 1000]; }
    if (p === 'month') return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), Date.now() + 1000];
    if (p === 'prev') return [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), new Date(d.getFullYear(), d.getMonth(), 1).getTime()];
    return [t0, Date.now() + 1000];
  }

  async function loadTimeclock() {
    const [from, to] = periodRange(S.period);
    try { S.timeclock = await api('GET', `/api/staff/timeclock?from=${from}&to=${to}`); } catch (e) { S.timeclock = S.timeclock || { onShift: [], employees: [], shifts: [], error: errText(e) }; }
  }
  async function loadEmployees() {
    try { S.employees = await api('GET', '/api/staff/employees'); } catch (e) { S.employees = S.employees || { employees: [], roles: [] }; }
  }

  async function ensureLoaded() {
    if (S.loaded || !CRM.user()) return;
    S.loaded = true;
    await Promise.all([loadCash(), loadTimeclock()]);
    CRM.render();
  }

  // ---------- Состояние в боковой панели: «Касса · открыта», «Смены · 3» ----------
  function status(el, kind) {
    if (kind !== 'api' || !CRM.user()) { CRM.badge('cash', ''); CRM.badge('shifts', ''); S.loaded = false; return; }
    ensureLoaded();
    if (!S.cash) return;
    const cur = S.cash.current;
    const n = S.timeclock ? S.timeclock.onShift.length : 0;
    CRM.badge('cash', cur ? 'открыта' : 'закрыта', cur ? 'ok' : 'off');
    CRM.badge('shifts', n ? String(n) : '', 'ok');
  }

  // =====================================================================
  // Касса
  // =====================================================================
  let cashTimer;
  const cashView = {
    available: (kind) => kind === 'api',
    status,
    render(main) {
      if (main.dataset.ext === 'cash') {
        // заказы изменились — пересчитаем выручку, не трогая поля ввода
        clearTimeout(cashTimer);
        cashTimer = setTimeout(async () => { await loadCash(); if (CRM.isActive('cash')) updateCash(main); }, 800);
        return;
      }
      main.dataset.ext = 'cash';
      main.innerHTML = '<div class="ext" data-cash-root><p class="crm-note">Загружаем кассу…</p></div>';
      loadCash().then(() => mountCash(main));
    }
  };

  function mountCash(main) {
    const box = main.querySelector('[data-cash-root]');
    if (!box) return;
    const cur = S.cash.current;
    box.innerHTML = `
      ${S.closedReport ? reportHTML(S.closedReport) : ''}
      ${cur ? openHTML(cur) : closedHTML()}
      <p class="crm-note ext-fiscal">Здесь учёт денег за смену. Фискальная смена (чеки, Z-отчёт по 54-ФЗ) открывается на онлайн-кассе — подключим её к CRM после выбора кассы.</p>
      <h3 class="ext-h">Прошлые смены</h3>
      <div class="table-wrap" data-cash-history>${historyHTML()}</div>`;
    bindCash(box);
  }

  function updateCash(main) {
    const box = main.querySelector('[data-cash-root]');
    if (!box) return;
    const cur = S.cash.current;
    // если смену открыли или закрыли в другом окне — перестраиваем целиком
    if (!!cur !== !!box.querySelector('[data-cash-open]')) return mountCash(main);
    if (cur) {
      box.querySelector('[data-cash-kpis]').innerHTML = kpisHTML(cur);
      box.querySelector('[data-cash-moves]').innerHTML = movesHTML(cur);
      box.querySelector('[data-cash-since]').textContent = sinceText(cur.openedAt);
      updateDiff(box);
    }
    box.querySelector('[data-cash-history]').innerHTML = historyHTML();
  }

  function closedHTML() {
    return `
      <form class="ext-card ext-open" data-cash-open-form novalidate>
        <h2>Кассовая смена закрыта</h2>
        <p>Пересчитайте наличные в кассе и откройте смену. Выручка будет считаться по заказам, выполненным за смену.</p>
        <label class="cz-f"><span>Наличные в кассе на начало смены, ₽</span><input id="cash-opening" inputmode="decimal" name="openingCash" placeholder="например, 5000" autocomplete="off"></label>
        <p class="cz-err" data-err></p>
        <button type="submit" class="crm-btn crm-btn--block">Открыть смену</button>
      </form>`;
  }

  function kpisHTML(cur) {
    return `
      <div class="stat"><span>Выручка</span><b>${rub(cur.revenue)}</b><em class="muted">${plural(cur.ordersDone, 'заказ выполнен', 'заказа выполнено', 'заказов выполнено')}</em></div>
      <div class="stat"><span>Наличные</span><b>${rub(cur.totals.cash)}</b><em class="muted">${cur.counts.cash} шт</em></div>
      <div class="stat"><span>Карта курьеру</span><b>${rub(cur.totals.card)}</b><em class="muted">${cur.counts.card} шт</em></div>
      <div class="stat"><span>СБП</span><b>${rub(cur.totals.sbp)}</b><em class="muted">${cur.counts.sbp} шт</em></div>
      <div class="stat stat--accent"><span>Должно быть в кассе</span><b>${rub(cur.expectedCash)}</b><em class="muted">${rub(cur.openingCash)} + нал. ${rub(cur.totals.cash)} + внес. ${rub(cur.cashIn)} − изъят. ${rub(cur.cashOut)}</em></div>`;
  }

  function movesHTML(cur) {
    if (!cur.moves.length) return '<p class="crm-note">Внесений и изъятий пока не было</p>';
    return `<table class="tbl"><tbody>${cur.moves.slice().reverse().map((m) => `
      <tr><td class="num">${hhmm(m.at)}</td><td>${m.kind === 'in' ? '<span class="pill pill--done">Внесение</span>' : '<span class="pill pill--cancelled">Изъятие</span>'}</td>
      <td>${esc(m.reason)}<small>${esc(m.by)}</small></td><td class="r">${m.kind === 'in' ? '+' : '−'}${rub(m.amount)}</td></tr>`).join('')}</tbody></table>`;
  }

  function openHTML(cur) {
    return `
      <div data-cash-open>
        <div class="ext-headline">
          <h2>Смена открыта в ${hhmm(cur.openedAt)}</h2>
          <span>Кассир: <b>${esc(cur.openedBy)}</b> · идёт <span data-cash-since>${sinceText(cur.openedAt)}</span> · на начало ${rub(cur.openingCash)}</span>
        </div>
        <section class="crm-stats ext-kpis" data-cash-kpis>${kpisHTML(cur)}</section>
        <div class="ext-grid">
          <form class="ext-card" data-cash-move-form novalidate>
            <h3>Внесение или изъятие</h3>
            <div class="cz-seg" role="radiogroup" aria-label="Операция">
              <label><input type="radio" name="kind" value="in" checked><span>Внесение</span></label>
              <label><input type="radio" name="kind" value="out"><span>Изъятие</span></label>
            </div>
            <div class="cz-grid">
              <label class="cz-f"><span>Сумма, ₽</span><input id="cash-move-amount" name="amount" inputmode="decimal" autocomplete="off"></label>
              <label class="cz-f"><span>Причина</span><input id="cash-move-reason" name="reason" placeholder="Размен, такси, закупка…" autocomplete="off"></label>
            </div>
            <p class="cz-err" data-err></p>
            <button type="submit" class="crm-btn crm-btn--ghost">Провести</button>
            <div data-cash-moves>${movesHTML(cur)}</div>
          </form>
          <form class="ext-card" data-cash-close-form novalidate>
            <h3>Закрыть смену</h3>
            <p class="crm-note">Пересчитайте наличные в кассе. CRM сравнит их с ожидаемой суммой.</p>
            <label class="cz-f"><span>Пересчитано наличных, ₽</span><input id="cash-counted" name="countedCash" inputmode="decimal" autocomplete="off"></label>
            <p class="ext-diff" data-cash-diff></p>
            <label class="cz-f"><span>Комментарий</span><input id="cash-note" name="note" placeholder="Если есть расхождение — почему" autocomplete="off"></label>
            <p class="cz-err" data-err></p>
            <button type="submit" class="crm-btn crm-btn--block" data-cash-close-btn>Закрыть смену</button>
          </form>
        </div>
      </div>`;
  }

  function diffLabel(diff) {
    if (diff === 0) return { text: 'Расхождений нет', cls: 'ok' };
    return diff < 0 ? { text: `Недостача ${rub(-diff)}`, cls: 'bad' } : { text: `Излишек ${rub(diff)}`, cls: 'warn' };
  }

  function updateDiff(box) {
    const input = box.querySelector('#cash-counted');
    const out = box.querySelector('[data-cash-diff]');
    const btn = box.querySelector('[data-cash-close-btn]');
    if (!input || !out) return;
    const v = money(input.value);
    if (input.value.trim() === '' || v === null) { out.textContent = ''; out.className = 'ext-diff'; btn.textContent = 'Закрыть смену'; return; }
    const d = diffLabel(Math.round((v - S.cash.current.expectedCash) * 100) / 100);
    out.textContent = d.text;
    out.className = 'ext-diff ext-diff--' + d.cls;
    btn.textContent = `Закрыть смену · ${d.text.toLowerCase()}`;
  }

  function reportHTML(r) {
    const d = diffLabel(r.difference);
    return `
      <div class="ext-card ext-report">
        <div class="ext-report__head">
          <h2>Смена закрыта · отчёт</h2>
          <button type="button" class="crm-x" data-report-close aria-label="Скрыть отчёт">×</button>
        </div>
        <dl class="ext-dl">
          <div><dt>Смена</dt><dd>${esc(dateShort(r.openedAt))} — ${hhmm(r.closedAt)}</dd></div>
          <div><dt>Открыл / закрыл</dt><dd>${esc(r.openedBy)} / ${esc(r.closedBy)}</dd></div>
          <div><dt>Выполнено заказов</dt><dd>${r.ordersDone}</dd></div>
          <div><dt>Выручка</dt><dd>${rub(r.revenue)}</dd></div>
          <div><dt>Наличные / карта / СБП</dt><dd>${rub(r.totals.cash)} / ${rub(r.totals.card)} / ${rub(r.totals.sbp)}</dd></div>
          <div><dt>Внесения / изъятия</dt><dd>+${rub(r.cashIn)} / −${rub(r.cashOut)}</dd></div>
          <div><dt>Должно быть в кассе</dt><dd>${rub(r.expectedCash)}</dd></div>
          <div><dt>Пересчитано</dt><dd>${rub(r.countedCash)}</dd></div>
          <div><dt>Итог</dt><dd class="ext-diff--${d.cls}">${d.text}</dd></div>
          ${r.note ? `<div><dt>Комментарий</dt><dd>${esc(r.note)}</dd></div>` : ''}
        </dl>
      </div>`;
  }

  function historyHTML() {
    const list = (S.cash && S.cash.history) || [];
    if (!list.length) return '<table class="tbl"><tbody><tr><td class="tbl-empty">Закрытых смен пока нет</td></tr></tbody></table>';
    return `<table class="tbl">
      <thead><tr><th>Смена</th><th>Кассир</th><th class="r">Заказов</th><th class="r">Выручка</th><th class="r">Наличные</th><th class="r">Карта</th><th class="r">СБП</th><th class="r">Ожидалось</th><th class="r">Пересчитано</th><th>Итог</th></tr></thead>
      <tbody>${list.map((r) => {
        const d = diffLabel(r.difference);
        return `<tr data-cash-report="${r.id}" tabindex="0"><td class="num">${esc(dateShort(r.openedAt))}–${hhmm(r.closedAt)}</td><td>${esc(r.openedBy)}${r.closedBy !== r.openedBy ? `<small>закрыл(а) ${esc(r.closedBy)}</small>` : ''}</td>
          <td class="r">${r.ordersDone}</td><td class="r">${rub(r.revenue)}</td><td class="r">${rub(r.totals.cash)}</td><td class="r">${rub(r.totals.card)}</td><td class="r">${rub(r.totals.sbp)}</td>
          <td class="r">${rub(r.expectedCash)}</td><td class="r">${rub(r.countedCash)}</td><td><span class="pill ${d.cls === 'ok' ? 'pill--done' : d.cls === 'bad' ? 'pill--cancelled' : 'pill--new'}">${d.text}</span></td></tr>`;
      }).join('')}</tbody></table>`;
  }

  function bindCash(box) {
    const submit = async (form, fn) => {
      const btn = form.querySelector('button[type="submit"]');
      const err = form.querySelector('[data-err]');
      btn.disabled = true;
      err.textContent = '';
      try { await fn(); } catch (e) { err.textContent = errText(e); } finally { btn.disabled = false; }
    };
    const openForm = box.querySelector('[data-cash-open-form]');
    if (openForm) {
      openForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submit(openForm, async () => {
          const v = money(openForm.openingCash.value);
          if (openForm.openingCash.value.trim() === '' || v === null) throw { message: 'Укажите сумму наличных — можно 0' };
          await api('POST', '/api/staff/cash/open', { openingCash: v });
          S.closedReport = null;
          await loadCash();
          mountCash(box.parentElement);
          CRM.toast('Кассовая смена открыта');
          CRM.render();
        });
      });
      openForm.openingCash.focus();
    }
    const moveForm = box.querySelector('[data-cash-move-form]');
    if (moveForm) {
      moveForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submit(moveForm, async () => {
          const amount = money(moveForm.amount.value);
          if (!amount) throw { message: 'Укажите сумму' };
          if (!moveForm.reason.value.trim()) throw { message: 'Укажите причину' };
          const kind = moveForm.kind.value;
          await api('POST', '/api/staff/cash/move', { kind, amount, reason: moveForm.reason.value.trim() });
          moveForm.amount.value = '';
          moveForm.reason.value = '';
          await loadCash();
          updateCash(box.parentElement);
          CRM.toast(`${kind === 'in' ? 'Внесение' : 'Изъятие'} ${rub(amount)} проведено`);
        });
      });
    }
    const closeForm = box.querySelector('[data-cash-close-form]');
    if (closeForm) {
      closeForm.countedCash.addEventListener('input', () => updateDiff(box));
      closeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submit(closeForm, async () => {
          const v = money(closeForm.countedCash.value);
          if (closeForm.countedCash.value.trim() === '' || v === null) throw { message: 'Пересчитайте наличные и укажите сумму' };
          const r = await api('POST', '/api/staff/cash/close', { countedCash: v, note: closeForm.note.value.trim() });
          S.closedReport = r.closed;
          await loadCash();
          mountCash(box.parentElement);
          CRM.toast('Кассовая смена закрыта');
          CRM.render();
        });
      });
    }
    if (box.dataset.bound) return;
    box.dataset.bound = '1';
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-report-close]')) { S.closedReport = null; mountCash(box.parentElement); return; }
      const row = e.target.closest('[data-cash-report]');
      if (row) {
        S.closedReport = S.cash.history.find((h) => String(h.id) === row.dataset.cashReport) || null;
        mountCash(box.parentElement);
        box.parentElement.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // =====================================================================
  // Смены сотрудников
  // =====================================================================
  const shiftsView = {
    available: (kind) => kind === 'api',
    render(main) {
      if (main.dataset.ext === 'shifts') { updateOnShift(main); return; }
      main.dataset.ext = 'shifts';
      main.innerHTML = '<div class="ext" data-shifts-root><p class="crm-note">Загружаем смены…</p></div>';
      Promise.all([loadTimeclock(), loadEmployees()]).then(() => mountShifts(main));
    }
  };

  const PERIODS = [['today', 'Сегодня'], ['yesterday', 'Вчера'], ['week', 'Эта неделя'], ['month', 'Этот месяц'], ['prev', 'Прошлый месяц']];

  // Фото с планшета: миниатюра, по нажатию — крупно
  function photoHTML(shiftId, kind, has, name, at) {
    const label = `${name}, ${kind === 'start' ? 'приход' : 'уход'} ${dateShort(at)}`;
    if (!has) return `<span class="ph ph--none" title="Фото нет: камера планшета не сработала">нет фото</span>`;
    const src = `/api/staff/photos/${shiftId}/${kind}`;
    return `<button type="button" class="ph" data-photo="${src}" data-caption="${esc(label)}" aria-label="Фото: ${esc(label)}"><img src="${src}" alt="" loading="lazy"></button>`;
  }

  function openPhoto(src, caption) {
    let lb = document.querySelector('[data-lightbox]');
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'crm-lightbox';
      lb.dataset.lightbox = '';
      lb.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure>';
      lb.addEventListener('click', () => { lb.hidden = true; });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.hidden = true; });
      document.getElementById('crm').appendChild(lb);
    }
    lb.querySelector('img').src = src;
    lb.querySelector('figcaption').textContent = caption;
    lb.hidden = false;
  }

  function mountShifts(main) {
    const box = main.querySelector('[data-shifts-root]');
    if (!box) return;
    box.innerHTML = `
      <div class="ext-headline">
        <h2>Сейчас на смене</h2>
        <span>Сотрудники отмечаются ПИН-кодом на планшете — страница <b>/smena</b>, планшет делает фото при отметке</span>
      </div>
      <div class="onshift" data-onshift>${onShiftHTML()}</div>
      <h3 class="ext-h">Табель</h3>
      <div class="chips">${PERIODS.map(([id, t]) => `<button type="button" class="chip ${S.period === id ? 'is-on' : ''}" data-period="${id}">${t}</button>`).join('')}</div>
      <div data-sheet>${sheetHTML()}</div>
      <h3 class="ext-h">Сотрудники</h3>
      <div class="ext-row">
        <button type="button" class="crm-btn" data-emp-new>+ Добавить сотрудника</button>
        <button type="button" class="crm-btn crm-btn--ghost" data-pair>Подключить этот планшет для отметок</button>
      </div>
      <div data-emp-form></div>
      <div class="table-wrap" data-emp-list>${employeesHTML()}</div>`;
    bindShifts(box);
  }

  function onShiftHTML() {
    const list = (S.timeclock && S.timeclock.onShift) || [];
    if (!list.length) return '<p class="crm-note">Никто не отметился</p>';
    return list.map((p) => `
      <div class="onshift__card">
        ${photoHTML(p.shiftId, 'start', p.startPhoto, p.name, p.startedAt)}
        <div class="onshift__info">
          <b>${esc(p.name)}</b><span>${esc(p.role)}</span>
          <span class="onshift__time">с ${hhmm(p.startedAt)} · ${sinceText(p.startedAt)}</span>
          <button type="button" class="crm-btn crm-btn--small crm-btn--ghost" data-close-shift="${p.shiftId}" data-name="${esc(p.name)}">Закрыть смену</button>
        </div>
      </div>`).join('');
  }

  function sheetHTML() {
    const t = S.timeclock;
    if (!t) return '';
    const total = t.employees.reduce((a, e) => ({ min: a.min + e.minutes, pay: a.pay + (e.pay || 0) }), { min: 0, pay: 0 });
    const rows = t.employees.map((e) => `
      <tr><td>${esc(e.name)}</td><td>${esc(e.role)}</td><td class="r">${e.shifts}</td><td class="r">${hours(e.minutes)}</td><td class="r">${rub(e.pay)}</td></tr>`).join('');
    const details = t.shifts.map((s) => `
      <tr><td class="num">${esc(dateShort(s.startedAt))}</td><td>${esc(s.name)}<small>${esc(s.role)}</small></td>
      <td>${s.endedAt ? hhmm(s.endedAt) + (s.closedBy && s.closedBy !== s.name ? `<small>закрыл(а) ${esc(s.closedBy)}</small>` : '') : '<span class="pill pill--done">на смене</span>'}</td>
      <td class="ph-cell">${photoHTML(s.id, 'start', s.startPhoto, s.name, s.startedAt)}${s.endedAt ? photoHTML(s.id, 'end', s.endPhoto, s.name, s.endedAt) : ''}</td>
      <td class="r">${hours(s.minutes)}</td><td class="r">${rub(s.pay)}</td></tr>`).join('');
    return `
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Сотрудник</th><th>Должность</th><th class="r">Смен</th><th class="r">Отработано</th><th class="r">К выплате</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="tbl-empty">За этот период смен нет</td></tr>'}</tbody>
          ${rows ? `<tfoot><tr><td colspan="3"><b>Итого</b></td><td class="r"><b>${hours(total.min)}</b></td><td class="r"><b>${rub(total.pay)}</b></td></tr></tfoot>` : ''}
        </table>
      </div>
      ${details ? `<details class="ext-details" open><summary>Все отметки за период (${t.shifts.length}) — с фото прихода и ухода</summary>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Начало</th><th>Сотрудник</th><th>Конец</th><th>Фото: приход · уход</th><th class="r">Часы</th><th class="r">Сумма</th></tr></thead><tbody>${details}</tbody></table></div></details>` : ''}`;
  }

  function employeesHTML() {
    const list = (S.employees && S.employees.employees) || [];
    if (!list.length) return '<table class="tbl"><tbody><tr><td class="tbl-empty">Добавьте сотрудников: поваров, кухонных работников, технический персонал, водителей-курьеров, администраторов</td></tr></tbody></table>';
    return `<table class="tbl"><thead><tr><th>Сотрудник</th><th>Должность</th><th class="r">Ставка</th><th>Статус</th><th></th></tr></thead><tbody>${list.map((e) => `
      <tr class="${e.active ? '' : 'is-off'}"><td>${esc(e.name)}</td><td>${esc(e.role)}</td><td class="r">${e.rate ? rub(e.rate) + '/ч' : '—'}</td>
      <td>${e.active ? '<span class="pill pill--done">Работает</span>' : '<span class="pill">Уволен</span>'}</td>
      <td class="r"><button type="button" class="crm-btn crm-btn--small crm-btn--ghost" data-emp-edit="${e.id}">Изменить</button></td></tr>`).join('')}</tbody></table>`;
  }

  function empFormHTML(emp) {
    const roles = (S.employees && S.employees.roles) || [];
    const isNew = !emp;
    return `
      <form class="ext-card ext-emp" data-emp-form-el novalidate>
        <h3>${isNew ? 'Новый сотрудник' : 'Сотрудник: ' + esc(emp.name)}</h3>
        <div class="cz-grid cz-grid--4">
          <label class="cz-f"><span>Имя и фамилия</span><input id="emp-name" name="name" value="${esc(emp ? emp.name : '')}" autocomplete="off"></label>
          <label class="cz-f"><span>Должность</span><select id="emp-role" name="role">${roles.map((r) => `<option ${emp && emp.role === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
          <label class="cz-f"><span>${isNew ? 'ПИН-код (4–6 цифр)' : 'Новый ПИН-код'}</span><input id="emp-pin" name="pin" inputmode="numeric" maxlength="6" placeholder="${isNew ? '' : 'не менять'}" autocomplete="off"></label>
          <label class="cz-f"><span>Ставка, ₽ в час</span><input id="emp-rate" name="rate" inputmode="decimal" value="${emp && emp.rate ? emp.rate : ''}" placeholder="0" autocomplete="off"></label>
        </div>
        ${isNew ? '' : `<label class="cz-check"><input id="emp-active" type="checkbox" name="active" ${emp.active ? 'checked' : ''}> Работает (снимите галочку при увольнении — ПИН перестанет работать)</label>`}
        <p class="crm-note">ПИН-код сотрудник вводит на планшете, когда приходит и уходит. Сообщите его лично — в CRM он не отображается.</p>
        <p class="cz-err" data-err></p>
        <div class="ext-row">
          <button type="submit" class="crm-btn">${isNew ? 'Добавить' : 'Сохранить'}</button>
          <button type="button" class="crm-btn crm-btn--ghost" data-emp-cancel>Отмена</button>
        </div>
      </form>`;
  }

  function updateOnShift(main) {
    const box = main.querySelector('[data-shifts-root]');
    const el = box && box.querySelector('[data-onshift]');
    if (el) el.innerHTML = onShiftHTML();
  }

  function bindShifts(box) {
    box.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.photo) { openPhoto(t.dataset.photo, t.dataset.caption); return; }
      if (t.dataset.period) {
        S.period = t.dataset.period;
        box.querySelectorAll('[data-period]').forEach((b) => b.classList.toggle('is-on', b === t));
        await loadTimeclock();
        box.querySelector('[data-sheet]').innerHTML = sheetHTML();
        return;
      }
      if (t.dataset.closeShift) {
        if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = `Точно закрыть смену ${t.dataset.name}?`; t.classList.add('crm-btn--danger-text'); return; }
        try {
          await api('POST', `/api/staff/work-shifts/${t.dataset.closeShift}/close`);
          CRM.toast(`Смена ${t.dataset.name} закрыта`);
          await loadTimeclock();
          box.querySelector('[data-onshift]').innerHTML = onShiftHTML();
          box.querySelector('[data-sheet]').innerHTML = sheetHTML();
          CRM.render();
        } catch (err) { CRM.toast(errText(err)); }
        return;
      }
      if (t.hasAttribute('data-emp-new') || t.dataset.empEdit) {
        const emp = t.dataset.empEdit ? S.employees.employees.find((x) => String(x.id) === t.dataset.empEdit) : null;
        S.editing = emp ? emp.id : 'new';
        box.querySelector('[data-emp-form]').innerHTML = empFormHTML(emp);
        bindEmpForm(box);
        box.querySelector('#emp-name').focus();
        return;
      }
      if (t.hasAttribute('data-emp-cancel')) { S.editing = null; box.querySelector('[data-emp-form]').innerHTML = ''; return; }
      if (t.hasAttribute('data-pair')) {
        if (t.dataset.confirm !== '1') {
          t.dataset.confirm = '1';
          t.textContent = 'Подключить? Этот браузер станет терминалом отметок';
          return;
        }
        try {
          await api('POST', '/api/staff/devices', { name: 'Планшет' });
          location.href = '/smena';
        } catch (err) { CRM.toast(errText(err)); }
      }
    });
  }

  function bindEmpForm(box) {
    const form = box.querySelector('[data-emp-form-el]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('[data-err]');
      const btn = form.querySelector('button[type="submit"]');
      const body = { name: form.name.value.trim(), role: form.role.value, rate: money(form.rate.value || 0) };
      if (form.pin.value.trim()) body.pin = form.pin.value.trim();
      if (form.active) body.active = form.active.checked;
      if (!body.name) { err.textContent = 'Укажите имя'; return; }
      if (S.editing === 'new' && !/^\d{4,6}$/.test(body.pin || '')) { err.textContent = 'ПИН-код — от 4 до 6 цифр'; return; }
      if (body.rate === null) { err.textContent = 'Неверная ставка'; return; }
      btn.disabled = true;
      try {
        if (S.editing === 'new') await api('POST', '/api/staff/employees', body);
        else await api('PATCH', `/api/staff/employees/${S.editing}`, body);
        CRM.toast(S.editing === 'new' ? `${body.name} добавлен(а)` : 'Сохранено');
        S.editing = null;
        await Promise.all([loadEmployees(), loadTimeclock()]);
        box.querySelector('[data-emp-form]').innerHTML = '';
        box.querySelector('[data-emp-list]').innerHTML = employeesHTML();
        box.querySelector('[data-onshift]').innerHTML = onShiftHTML();
      } catch (ex) {
        err.textContent = errText(ex);
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------- Живые обновления ----------
  Store.on('cash', async () => {
    await loadCash();
    if (CRM.isActive('cash')) updateCash(document.querySelector('[data-main]'));
    CRM.render();
  });
  Store.on('timeclock', (data) => {
    if (S.timeclock) S.timeclock.onShift = data.onShift;
    if (CRM.isActive('shifts')) {
      loadTimeclock().then(() => {
        const root = document.querySelector('[data-shifts-root]');
        if (root) { root.querySelector('[data-onshift]').innerHTML = onShiftHTML(); root.querySelector('[data-sheet]').innerHTML = sheetHTML(); }
      });
    }
    CRM.render();
  });
  // «идёт 3 ч 12 мин» обновляем раз в минуту
  setInterval(() => {
    if (CRM.isActive('shifts')) updateOnShift(document.querySelector('[data-main]'));
    if (CRM.isActive('cash')) { const el = document.querySelector('[data-cash-since]'); if (el && S.cash.current) el.textContent = sinceText(S.cash.current.openedAt); }
  }, 60000);

  CRM.addView('cash', 'Касса', { group: 'Деньги и люди', icon: 'cash', ...cashView });
  CRM.addView('shifts', 'Смены', { group: 'Деньги и люди', icon: 'badge', ...shiftsView });
})();
