import { Router } from 'express';
import { config, whatsappLive } from './config.js';
import { query, toVector } from './db.js';
import { embed, ollamaReady } from './ollama.js';
import { getLooks } from './engine/outfits.js';
import { stylistChat } from './engine/stylist.js';
import { sendStylingMessage, TEMPLATE_BODY } from './whatsapp/message.js';
import { handleInbound, extractMessages } from './whatsapp/inbound.js';

export const api = Router();

const LIST = `id::text, handle, title, category, slot, color, price, compare_at_price, image_url, occasions`;

const card = (r) => ({
  id: r.id, handle: r.handle, title: r.title, category: r.category, slot: r.slot, color: r.color,
  price: Number(r.price), compareAtPrice: r.compare_at_price ? Number(r.compare_at_price) : null,
  image: r.image_url, occasions: r.occasions,
});

const phoneOk = (p) => /^\d{10,15}$/.test(p ?? '');

api.get('/health', async (_req, res) => {
  const db = await query('SELECT count(*)::int AS n, count(ai_tagged_at)::int AS tagged, count(embedding)::int AS embedded FROM products')
    .then((r) => ({ host: new URL(config.databaseUrl).hostname, ...r.rows[0] })).catch((e) => ({ error: e.message }));
  res.json({
    store: config.storeName, db, ollama: await ollamaReady(),
    models: { tag: config.tagModel, chat: config.chatModel, embed: config.embedModel },
    whatsapp: whatsappLive() ? 'live' : 'preview',
  });
});

api.get('/categories', async (_req, res) => {
  const { rows } = await query(
    `SELECT category, slot, count(*)::int AS n FROM products WHERE in_stock AND slot <> 'other'
     GROUP BY category, slot
     ORDER BY array_position(ARRAY['top','bottom','layer','footwear','accessory'], slot), n DESC`);
  res.json(rows);
});

// Browse, or search by meaning when `q` is given (pgvector), falling back to text match.
api.get('/products', async (req, res) => {
  const { category, slot, q } = req.query;
  const limit = Math.min(Number(req.query.limit ?? 48), 100);
  const where = ['in_stock', `slot <> 'other'`];
  const params = [];
  if (category) { params.push(category); where.push(`category = $${params.length}`); }
  if (slot) { params.push(slot); where.push(`slot = $${params.length}`); }

  if (q) {
    const vector = await embed([q], 'search_query').then(([v]) => v).catch(() => null);
    if (vector) {
      params.push(toVector(vector));
      const { rows } = await query(
        `SELECT ${LIST} FROM products WHERE ${where.join(' AND ')} AND embedding IS NOT NULL
         ORDER BY embedding <=> $${params.length}::vector LIMIT ${limit}`, params);
      return res.json({ products: rows.map(card), search: 'vector' });
    }
    params.push(`%${q}%`);
    where.push(`title ILIKE $${params.length}`);
  }
  const { rows } = await query(
    `SELECT ${LIST} FROM products WHERE ${where.join(' AND ')} ORDER BY slot = 'top' DESC, id DESC LIMIT ${limit}`, params);
  res.json({ products: rows.map(card), search: q ? 'text' : null });
});

api.get('/products/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT ${LIST}, description, images, sizes, pattern, fit, fabric, formality, style_note
     FROM products WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  const r = rows[0];
  res.json({
    ...card(r), description: r.description, images: r.images, sizes: r.sizes, pattern: r.pattern,
    fit: r.fit, fabric: r.fabric, formality: r.formality, styleNote: r.style_note,
    url: `https://${new URL(config.storeUrl).host}/products/${r.handle}`,
  });
});

api.get('/products/:id/looks', async (req, res) => {
  const started = Date.now();
  const result = await getLooks(req.params.id, { occasion: req.query.occasion, size: req.query.size });
  if (!result) return res.status(404).json({ error: 'not found' });
  res.json({ ...result, ms: Date.now() - started });
});

api.post('/stylist/chat', async (req, res) => {
  const { productId, message, size } = req.body ?? {};
  if (!productId || !message) return res.status(400).json({ error: 'productId and message are required' });
  const started = Date.now();
  const result = await stylistChat(productId, String(message).slice(0, 500), { size });
  if (!result) return res.status(404).json({ error: 'not found' });
  res.json({ ...result, ms: Date.now() - started });
});

// --- WhatsApp -----------------------------------------------------------------

api.get('/whatsapp/template', (_req, res) => res.json({
  name: config.whatsapp.template, category: 'MARKETING', language: config.whatsapp.templateLang,
  body: TEMPLATE_BODY, mode: whatsappLive() ? 'live' : 'preview',
}));

api.post('/whatsapp/optin', async (req, res) => {
  const { phone, name } = req.body ?? {};
  if (!phoneOk(phone)) return res.status(400).json({ error: 'phone must be digits with country code, e.g. 919812345678' });
  await query(
    `INSERT INTO subscribers (phone, name) VALUES ($1, $2)
     ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, subscribers.name), opted_in_at = now(), opted_out_at = NULL`,
    [phone, name || null]);
  res.json({ ok: true });
});

// Stands in for Shopify's orders/create webhook during the demo.
api.post('/orders/simulate', async (req, res) => {
  const { productId, phone } = req.body ?? {};
  if (!productId || !phoneOk(phone)) return res.status(400).json({ error: 'productId and phone are required' });
  const orderRef = req.body.orderRef ?? `demo-${productId}-${phone}-${Date.now()}`;
  try {
    res.json({ orderRef, ...(await sendStylingMessage({ productId, phone, orderRef })) });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// Lets the demo play the customer's side of the chat without a real phone.
api.post('/whatsapp/simulate-reply', async (req, res) => {
  const { phone, text } = req.body ?? {};
  if (!phoneOk(phone) || !text) return res.status(400).json({ error: 'phone and text are required' });
  res.json(await handleInbound(phone, String(text).slice(0, 500)));
});

api.get('/whatsapp/messages', async (req, res) => {
  const { rows } = await query(
    `SELECT id, direction, kind, payload, status, created_at FROM messages WHERE phone = $1 ORDER BY id`, [req.query.phone]);
  res.json(rows);
});

// --- Meta webhook -----------------------------------------------------------------

export const webhooks = Router();

webhooks.get('/whatsapp', (req, res) => {
  const ok = req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.whatsapp.verifyToken;
  return ok ? res.send(req.query['hub.challenge']) : res.sendStatus(403);
});

webhooks.post('/whatsapp', async (req, res) => {
  res.sendStatus(200); // Meta retries unless it gets a fast 200
  for (const { phone, text } of extractMessages(req.body)) {
    handleInbound(phone, text).catch((err) => console.error(`[webhook] ${err.message}`));
  }
});
