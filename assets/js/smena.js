/* Терминал смен на планшете: сотрудник вводит ПИН — смена начинается или заканчивается. */
(function () {
  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (t) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dur = (min) => `${Math.floor(min / 60)} ч ${pad(min % 60)} мин`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MAX = 6;
  let pin = '';
  let busy = false;
  let onShift = [];
  let resultTimer;

  function tick() {
    const d = new Date();
    $('[data-clock]').textContent = hhmm(d);
    const date = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    $('[data-date]').textContent = date.charAt(0).toUpperCase() + date.slice(1);
  }

  function renderDots(state) {
    const n = Math.max(4, pin.length);
    $('[data-dots]').innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i < pin.length ? 'is-on' : ''}"></span>`).join('');
    $('[data-dots]').className = 'tc-dots' + (state ? ' is-' + state : '');
  }

  function renderList() {
    $('[data-count]').textContent = onShift.length ? `· ${onShift.length}` : '';
    $('[data-list]').innerHTML = onShift.length
      ? onShift.map((p) => `<li><b>${esc(p.name)}</b><span>${esc(p.role)}</span><em>с ${hhmm(p.startedAt)} · ${dur(Math.round((Date.now() - p.startedAt) / 60000))}</em></li>`).join('')
      : '<li class="tc-empty">Пока никого</li>';
  }

  async function loadState() {
    try {
      const res = await fetch('/api/timeclock/state', { credentials: 'same-origin', cache: 'no-store' });
      if (res.status === 401) { $('[data-blocked]').hidden = false; $('[data-entry]').hidden = true; return; }
      const data = await res.json();
      $('[data-blocked]').hidden = true;
      $('[data-entry]').hidden = false;
      onShift = data.onShift || [];
      renderList();
    } catch (e) { /* нет связи — покажем при отметке */ }
  }

  function showResult(kind, title, text) {
    clearTimeout(resultTimer);
    const el = $('[data-result]');
    el.className = 'tc-result tc-result--' + kind;
    $('[data-result-icon]').textContent = kind === 'start' ? '✓' : kind === 'end' ? '☾' : '!';
    $('[data-result-title]').textContent = title;
    $('[data-result-text]').textContent = text;
    el.hidden = false;
    resultTimer = setTimeout(() => { el.hidden = true; }, kind === 'error' ? 2500 : 4000);
  }

  async function submit() {
    if (busy || pin.length < 4) { if (pin.length < 4) { renderDots('error'); setTimeout(() => renderDots(), 500); } return; }
    busy = true;
    const code = pin;
    pin = '';
    renderDots('wait');
    try {
      const res = await fetch('/api/timeclock/punch', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: code })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) { loadState(); return; }
        renderDots('error');
        $('[data-hint]').textContent = data.error || 'Не получилось. Попробуйте ещё раз';
        setTimeout(() => { renderDots(); $('[data-hint]').textContent = 'Введите ваш ПИН-код, чтобы начать или закончить смену'; }, 1800);
        return;
      }
      const first = data.name.split(' ')[0];
      if (data.action === 'start') showResult('start', `${first}, смена началась`, `Отметка в ${hhmm(data.startedAt)}. Хорошей работы!`);
      else showResult('end', `${first}, смена закончена`, `С ${hhmm(data.startedAt)} до ${hhmm(data.endedAt)} · отработано ${dur(data.minutes)}. Спасибо!`);
      renderDots();
      loadState();
    } catch (e) {
      showResult('error', 'Нет связи с сервером', 'Проверьте интернет на планшете и попробуйте ещё раз');
      renderDots();
    } finally {
      busy = false;
    }
  }

  function press(key) {
    if (!$('[data-result]').hidden) { $('[data-result]').hidden = true; }
    if (key === 'ok') return submit();
    if (key === 'del') pin = pin.slice(0, -1);
    else if (/^\d$/.test(key) && pin.length < MAX) pin += key;
    renderDots();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (b) press(b.dataset.key);
    else if (e.target.closest('[data-result]')) $('[data-result]').hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') press('ok');
  });

  tick();
  renderDots();
  loadState();
  setInterval(tick, 5000);
  setInterval(() => { loadState(); }, 30000);
})();
