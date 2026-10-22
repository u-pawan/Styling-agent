// Post-purchase styling message: two looks for the item just bought, as a Meta-approved marketing template.
import { config, whatsappLive } from '../config.js';
import { query } from '../db.js';
import { getProduct, getLooks } from '../engine/outfits.js';
import { defaultOccasion, PROFILES } from '../engine/occasions.js';
import { makeCollage } from './collage.js';
import { sendTemplate } from './cloudApi.js';

const SHORT = {
  tshirt: 'tee', polo: 'polo', formal_shoes: 'formal shoes', sneakers: 'sneakers', loafers: 'loafers',
  trousers: 'trousers', chinos: 'chinos', jeans: 'jeans', cargo: 'cargos', joggers: 'joggers',
};
const shortName = (i) => `${(i.color ?? '').toLowerCase()} ${SHORT[i.category] ?? i.category}`.trim();

export const lookLine = (look) => [
  ...look.items.filter((i) => i.slot !== 'accessory').map(shortName),
  ...look.advice.map((a) => a.text),
].join(' + ');

export const lookUrl = (productId, occasion) => `${config.shopUrl}/?product=${productId}&occasion=${occasion}`;

// The template to register in WhatsApp Manager (category: Marketing). {{n}} are filled per message.
export const TEMPLATE_BODY = `Hi {{1}}, your {{2}} is on its way.

Two ways to wear it:
{{3}}: {{4}}
{{5}}: {{6}}

Tap a look to shop it. Reply STOP to opt out.`;

export async function buildStylingMessage({ productId, name, phone }) {
  const anchor = await getProduct(productId);
  if (!anchor) throw new Error('product not found');
  const first = defaultOccasion(anchor);
  const second = first === 'casual' ? 'date' : 'casual';
  const [a, b] = await Promise.all([getLooks(productId, { occasion: first }), getLooks(productId, { occasion: second })]);
  const lookA = a.looks[0];
  const lookB = b.looks.find((l) => lookLine(l) !== lookLine(lookA)) ?? b.looks[0];
  if (!lookA || !lookB) throw new Error('not enough items to style this product');

  const collage = await makeCollage(anchor.image_url, lookA.items.map((i) => i.image));
  const params = [name || 'there', anchor.title, PROFILES[first].label, lookLine(lookA), PROFILES[second].label, lookLine(lookB)];
  const text = TEMPLATE_BODY.replace(/\{\{(\d)\}\}/g, (_, n) => params[Number(n) - 1]);

  // The in-shop preview uses relative links so it works on any host (localhost, a tunnel, a deploy).
  const buttons = [
    { type: 'url', text: `Shop ${PROFILES[first].label.toLowerCase()} look`, url: `/?product=${productId}&occasion=${first}` },
    { type: 'url', text: `Shop ${PROFILES[second].label.toLowerCase()} look`, url: `/?product=${productId}&occasion=${second}` },
    { type: 'quick_reply', text: 'Style it for a wedding' },
  ];

  // Exactly what Meta receives. URL buttons carry the dynamic part after the template's base URL.
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: config.whatsapp.template,
      language: { code: config.whatsapp.templateLang },
      components: [
        { type: 'header', parameters: [{ type: 'image', image: { link: `${config.publicUrl}/collages/${collage}` } }] },
        { type: 'body', parameters: params.map((t) => ({ type: 'text', text: t })) },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: `?product=${productId}&occasion=${first}` }] },
        { type: 'button', sub_type: 'url', index: '1', parameters: [{ type: 'text', text: `?product=${productId}&occasion=${second}` }] },
      ],
    },
  };

  return {
    preview: { image: `/collages/${collage}`, text, buttons },
    payload,
    looks: { [first]: lookA, [second]: lookB },
  };
}

export async function sendStylingMessage({ productId, phone, orderRef }) {
  const { rows } = await query('SELECT * FROM subscribers WHERE phone = $1', [phone]);
  const sub = rows[0];
  if (!sub || sub.opted_out_at) {
    const err = new Error('Customer has not opted in to WhatsApp styling messages');
    err.status = 403;
    throw err;
  }

  const existing = await query(
    `SELECT payload, status FROM messages WHERE order_ref = $1 AND kind = 'styling_template' AND status IN ('sent','preview')`,
    [orderRef]);
  if (existing.rows[0]) return { ...existing.rows[0].payload, status: existing.rows[0].status, duplicate: true };

  const msg = await buildStylingMessage({ productId, name: sub.name, phone });
  let status = 'preview';
  let error = null;
  if (whatsappLive()) {
    try {
      await sendTemplate(msg.payload);
      status = 'sent';
    } catch (err) {
      status = 'failed';
      error = err.message;
    }
  }

  await query(
    `INSERT INTO messages (phone, direction, kind, order_ref, payload, status) VALUES ($1, 'out', 'styling_template', $2, $3, $4)`,
    [phone, orderRef, { preview: msg.preview, payload: msg.payload, error }, status]);
  await query('UPDATE subscribers SET last_product = $2 WHERE phone = $1', [phone, productId]);
  return { preview: msg.preview, payload: msg.payload, status, error };
}
