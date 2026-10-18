'use strict';
// Уведомления о заказах в Telegram и кнопки смены статуса прямо из чата.
// Работает через long polling: серверу не нужен входящий вебхук, только исходящий доступ к api.telegram.org.

const STATUS = {
  new: 'Новый', accepted: 'Принят', cooking: 'Готовится', delivering: 'В пути', done: 'Выполнен', cancelled: 'Отменён'
};
const NEXT = { new: ['accepted', 'Принять'], accepted: ['cooking', 'На кухню'], cooking: ['delivering', 'Передать курьеру'], delivering: ['done', 'Выполнен'] };

const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const rub = (n) => Math.round(n || 0).toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';

function createTelegram({ token, chatIds, apiBase = 'https://api.telegram.org', crmUrl = '', timeZone = 'Europe/Samara', db, log = console }) {
  const enabled = Boolean(token && chatIds.length);
  const allowed = new Set(chatIds.map(String));
  let onStatus = null;
  let stopped = false;
  let pending = null;

  const time = (ms) => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone });

  async function call(method, body, signal) {
    const res = await fetch(`${apiBase}/bot${token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      const err = new Error(`Telegram ${method}: ${data.description || res.status}`);
      err.code = data.error_code;
      throw err;
    }
    return data.result;
  }

  // загрузка файлов (фото) — multipart/form-data вместо JSON
  async function callForm(method, form) {
    const res = await fetch(`${apiBase}/bot${token}/${method}`, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || res.status}`);
    return data.result;
  }

  function text(o) {
    const head = o.source === 'phone'
      ? `☎️ <b>Заказ по телефону № ${o.number}</b>`
      : o.status === 'new' ? `🔔 <b>Новый заказ № ${o.number}</b>` : `<b>Заказ № ${o.number}</b>`;
    const last = (o.history || [])[o.history.length - 1];
    const who = last && last.by ? ` · ${esc(last.by)}` : '';
    const lines = [
      `${head} · ${time(o.createdAt)}`,
      `Статус: <b>${STATUS[o.status] || o.status}</b>${o.status !== 'new' ? who : ''}`,
      '',
      `<b>${esc(o.name)}</b>, ${esc(o.phone)}`,
      o.method === 'pickup' ? '🏃 Самовывоз' : `📍 ${esc(o.address)}`,
      `🕐 ${esc(o.time)} · персон: ${o.persons}`,
      `💳 ${esc(o.payment)}`
    ];
    if (o.comment) lines.push(`💬 ${esc(o.comment)}`);
    lines.push('');
    o.items.forEach((i) => lines.push(`${esc(i.name)} × ${i.qty} — ${rub(i.price * i.qty)}`));
    if (o.discount) lines.push(`Скидка${o.promo ? ' (' + esc(o.promo) + ')' : ''}: −${rub(o.discount)}`);
    lines.push(`Доставка: ${o.method === 'pickup' ? '—' : o.delivery ? rub(o.delivery) : 'бесплатно'}`);
    lines.push(`<b>Итого: ${rub(o.total)}</b>`);
    return lines.join('\n');
  }

  function keyboard(o) {
    const row = [];
    if (NEXT[o.status]) row.push({ text: `${NEXT[o.status][1]} →`, callback_data: `s:${o.id}:${NEXT[o.status][0]}` });
    if (o.status !== 'done' && o.status !== 'cancelled') row.push({ text: 'Отменить', callback_data: `c:${o.id}` });
    const rows = row.length ? [row] : [];
    if (/^https:\/\//.test(crmUrl)) rows.push([{ text: 'Открыть CRM', url: crmUrl }]);
    return { inline_keyboard: rows };
  }

  async function notifyNew(order) {
    if (!enabled) return;
    await Promise.all([...allowed].map(async (chatId) => {
      try {
        const msg = await call('sendMessage', { chat_id: chatId, text: text(order), parse_mode: 'HTML', reply_markup: keyboard(order), link_preview_options: { is_disabled: true } });
        db.saveTgMessage(order.id, chatId, msg.message_id);
      } catch (e) {
        log.error(`[telegram] не удалось отправить заказ № ${order.number} в чат ${chatId}: ${e.message}`);
      }
    }));
  }

  // Служебные сообщения (открытие и закрытие кассы) во все подключённые чаты
  async function broadcastText(html) {
    if (!enabled) return;
    await Promise.all([...allowed].map((chatId) => call('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML' })
      .catch((e) => log.error(`[telegram] не удалось отправить сообщение в чат ${chatId}: ${e.message}`))));
  }

  // Фото готового заказа — ответом на сообщение о заказе: «Заказ № … передан курьеру».
  // photos: [{ buf, by, at }]; несколько фото уходят одним альбомом
  async function sendOrderPhotos(order, photos) {
    if (!enabled || !photos.length) return;
    const last = photos[photos.length - 1];
    const caption = [
      `📸 <b>Заказ № ${order.number} ${order.method === 'pickup' ? 'готов к выдаче' : 'передан курьеру'}</b>`,
      `${esc(order.name)} · ${order.method === 'pickup' ? 'самовывоз' : esc(order.address)}`,
      `Снял(а): ${esc(last.by)} · ${time(last.at)}`
    ].join('\n');
    const replyTo = new Map(db.tgMessages(order.id).map((m) => [String(m.chat_id), m.message_id]));
    await Promise.all([...allowed].map(async (chatId) => {
      const form = new FormData();
      form.append('chat_id', chatId);
      if (replyTo.has(chatId)) form.append('reply_parameters', JSON.stringify({ message_id: replyTo.get(chatId), allow_sending_without_reply: true }));
      const blob = (p) => new Blob([p.buf], { type: 'image/jpeg' });
      try {
        if (photos.length === 1) {
          form.append('photo', blob(photos[0]), `order-${order.number}.jpg`);
          form.append('caption', caption);
          form.append('parse_mode', 'HTML');
          await callForm('sendPhoto', form);
        } else {
          const media = photos.slice(0, 10).map((p, i) => ({ type: 'photo', media: `attach://p${i}`, ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}) }));
          form.append('media', JSON.stringify(media));
          photos.slice(0, 10).forEach((p, i) => form.append(`p${i}`, blob(p), `order-${order.number}-${i + 1}.jpg`));
          await callForm('sendMediaGroup', form);
        }
      } catch (e) {
        log.error(`[telegram] не удалось отправить фото заказа № ${order.number} в чат ${chatId}: ${e.message}`);
      }
    }));
  }

  async function syncStatus(order) {
    if (!enabled) return;
    await Promise.all(db.tgMessages(order.id).map(async (m) => {
      try {
        await call('editMessageText', { chat_id: m.chat_id, message_id: m.message_id, text: text(order), parse_mode: 'HTML', reply_markup: keyboard(order), link_preview_options: { is_disabled: true } });
      } catch (e) {
        if (!/message is not modified/.test(e.message)) log.error(`[telegram] не удалось обновить сообщение заказа № ${order.number}: ${e.message}`);
      }
    }));
  }

  async function handleUpdate(u) {
    if (u.message && /^\/(start|id)\b/.test(u.message.text || '')) {
      const chatId = String(u.message.chat.id);
      const known = allowed.has(chatId);
      await call('sendMessage', {
        chat_id: chatId,
        text: known
          ? 'Этот чат подключён: сюда приходят новые заказы РОЛЛЕВИЧ.'
          : `ID этого чата: <code>${esc(chatId)}</code>\nДобавьте его в TELEGRAM_CHAT_IDS в файле .env на сервере и перезапустите сервер.`,
        parse_mode: 'HTML'
      }).catch((e) => log.error(`[telegram] ${e.message}`));
      return;
    }
    const cb = u.callback_query;
    if (!cb || !cb.message) return;
    const chatId = String(cb.message.chat.id);
    const answer = (t) => call('answerCallbackQuery', { callback_query_id: cb.id, text: t }).catch(() => {});
    if (!allowed.has(chatId)) return answer('Этот чат не подключён к CRM');

    const [kind, orderId, status] = String(cb.data || '').split(':');
    const actor = [cb.from.first_name, cb.from.last_name].filter(Boolean).join(' ') || cb.from.username || 'Telegram';
    const next = kind === 'c' ? 'cancelled' : status;
    if (!onStatus || !STATUS[next]) return answer('Неизвестная команда');
    try {
      const order = await onStatus(orderId, next, `${actor} (Telegram)`);
      await answer(order ? `№ ${order.number}: ${STATUS[next].toLowerCase()}` : 'Заказ не найден');
    } catch (e) {
      await answer(e.message || 'Не удалось изменить статус');
    }
  }

  async function poll() {
    let offset = Number(db.kvGet('tg_offset') || 0);
    let delay = 1000;
    while (!stopped) {
      try {
        pending = new AbortController();
        const updates = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] }, pending.signal);
        for (const u of updates) {
          offset = u.update_id + 1;
          db.kvSet('tg_offset', offset);
          await handleUpdate(u).catch((e) => log.error(`[telegram] ${e.message}`));
        }
        delay = 1000;
      } catch (e) {
        if (stopped) break;
        log.error(`[telegram] getUpdates: ${e.message}. Повтор через ${Math.round(delay / 1000)} с`);
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 60000);
      }
    }
  }

  return {
    enabled,
    notifyNew,
    syncStatus,
    broadcastText,
    sendOrderPhotos,
    text,
    start(statusHandler) {
      onStatus = statusHandler;
      if (enabled) poll();
    },
    stop() { stopped = true; if (pending) pending.abort(); }
  };
}

module.exports = { createTelegram, STATUS };
