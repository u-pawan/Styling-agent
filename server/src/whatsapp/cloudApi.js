// Thin client for Meta's WhatsApp Cloud API. Only called when a token + phone number id are set.
import { config } from '../config.js';

async function send(body) {
  const { token, phoneNumberId, graphVersion } = config.whatsapp;
  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${data.error?.message ?? 'unknown error'}`);
  return data;
}

export const sendTemplate = (payload) => send(payload);

// Free-form text is only allowed inside the 24h window after the customer's last message.
export const sendText = (to, text) => send({
  messaging_product: 'whatsapp',
  to,
  type: 'text',
  text: { preview_url: true, body: text },
});
