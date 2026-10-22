// Customer replies on WhatsApp. A reply opens Meta's 24h window, so the stylist can answer free-form.
import { whatsappLive } from '../config.js';
import { query } from '../db.js';
import { stylistChat } from '../engine/stylist.js';
import { lookLine, lookUrl } from './message.js';
import { sendText } from './cloudApi.js';

async function reply(phone, text) {
  let status = 'preview';
  if (whatsappLive()) {
    try {
      await sendText(phone, text);
      status = 'sent';
    } catch (err) {
      console.error(`[whatsapp] reply failed: ${err.message}`);
      status = 'failed';
    }
  }
  await query(`INSERT INTO messages (phone, direction, kind, payload, status) VALUES ($1, 'out', 'chat', $2, $3)`,
    [phone, { text }, status]);
  return { text, status };
}

export async function handleInbound(phone, text) {
  await query(`INSERT INTO messages (phone, direction, kind, payload, status) VALUES ($1, 'in', 'inbound', $2, 'received')`,
    [phone, { text }]);
  const { rows } = await query(
    'UPDATE subscribers SET last_inbound = now() WHERE phone = $1 RETURNING *', [phone]);
  const sub = rows[0];

  if (/^\s*stop\s*$/i.test(text)) {
    await query('UPDATE subscribers SET opted_out_at = now() WHERE phone = $1', [phone]);
    return reply(phone, 'Done, you will not get styling messages from us anymore.');
  }
  if (!sub?.last_product) {
    return reply(phone, 'Hi! Tell me which piece you bought and where you are wearing it, and I will style it for you.');
  }

  const result = await stylistChat(sub.last_product, text);
  const looks = result.looks.slice(0, 2);
  const lines = looks.map((l, i) => `${i + 1}. ${l.name ?? 'Look'}: ${lookLine(l)}`);
  return reply(phone, [
    result.intro,
    '',
    ...lines,
    '',
    `Shop it: ${lookUrl(sub.last_product, result.occasion)}`,
  ].join('\n'));
}

// Pull text out of Meta's webhook body (plain text, template quick-reply buttons, interactive replies).
export function extractMessages(body) {
  const out = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title;
        if (text) out.push({ phone: m.from, text });
      }
    }
  }
  return out;
}
