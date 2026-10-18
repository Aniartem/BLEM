/* Терминал смен на планшете: сотрудник вводит ПИН — смена начинается или заканчивается,
   камера планшета делает фото сотрудника в момент отметки. */
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
  let camReady = false;

  // ---------- Камера ----------
  async function startCamera() {
    const note = $('[data-cam-note]');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      note.textContent = 'Камера недоступна в этом браузере — отметки без фото';
      note.classList.add('is-warn');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      const video = $('[data-video]');
      video.srcObject = stream;
      await video.play().catch(() => {});
      camReady = true;
      note.textContent = 'При отметке делается фото';
      note.classList.remove('is-warn');
      // если камеру отключили (например, перезагрузка драйвера) — пробуем снова
      stream.getVideoTracks()[0].addEventListener('ended', () => { camReady = false; setTimeout(startCamera, 3000); });
    } catch (e) {
      camReady = false;
      note.textContent = e && e.name === 'NotAllowedError'
        ? 'Нет доступа к камере — разрешите его в настройках браузера. Пока отметки без фото'
        : 'Камера не найдена — отметки без фото';
      note.classList.add('is-warn');
    }
  }

  // Снимок с камеры: JPEG до 640 px по большей стороне
  function snapshot() {
    const video = $('[data-video]');
    if (!camReady || video.readyState < 2 || !video.videoWidth) return null;
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = $('[data-canvas]');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    // в превью сотрудник видит себя зеркально, а фото сохраняем как есть — надписи на фоне читаются
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  }

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
      if (!camReady && $('[data-entry]').hidden) startCamera();
      $('[data-blocked]').hidden = true;
      $('[data-entry]').hidden = false;
      onShift = data.onShift || [];
      renderList();
    } catch (e) { /* нет связи — покажем при отметке */ }
  }

  function showResult(kind, title, text, photo) {
    clearTimeout(resultTimer);
    const img = $('[data-result-photo]');
    img.hidden = !photo;
    if (photo) img.src = photo;
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
    const photo = snapshot();
    try {
      const res = await fetch('/api/timeclock/punch', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: code, photo })
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
      const shot = data.photo ? photo : null;
      const noPhoto = data.photo ? '' : ' Фото не сохранилось — сообщите администратору.';
      if (data.action === 'start') showResult('start', `${first}, смена началась`, `Отметка в ${hhmm(data.startedAt)}. Хорошей работы!${noPhoto}`, shot);
      else showResult('end', `${first}, смена закончена`, `С ${hhmm(data.startedAt)} до ${hhmm(data.endedAt)} · отработано ${dur(data.minutes)}. Спасибо!${noPhoto}`, shot);
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
  loadState().then(() => { if (!$('[data-entry]').hidden) startCamera(); });
  setInterval(tick, 5000);
  setInterval(() => { loadState(); }, 30000);
})();
