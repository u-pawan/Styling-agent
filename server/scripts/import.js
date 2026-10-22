// Usage: npm run import -- [--store https://brand.com] [--scale 1] [--all]
// Pulls the store's public catalog, applies rule-based tags and saves a balanced sample.
import { parseArgs } from 'node:util';
import { config } from '../src/config.js';
import { pool } from '../src/db.js';
import { fetchAllProducts } from '../src/catalog/shopify.js';
import { normalize } from '../src/catalog/normalize.js';

const { values: args } = parseArgs({
  options: {
    store: { type: 'string', default: config.storeUrl },
    scale: { type: 'string', default: '1' },
    all: { type: 'boolean', default: false },
  },
});

// How many of each category to keep at --scale 1 (~330 products, enough for a demo).
const QUOTA = {
  shirt: 70, tshirt: 30, polo: 20, kurta: 6,
  jeans: 35, trousers: 35, chinos: 20, cargo: 10, shorts: 10, joggers: 4,
  overshirt: 12, jacket: 10, blazer: 8, sweater: 10, sweatshirt: 4, hoodie: 4,
  sneakers: 15, loafers: 10, formal_shoes: 8, boots: 6, mules: 6, sandals: 6,
  belt: 8, sunglasses: 5, bag: 4, cap: 3, jewellery: 4, watch: 3,
};

// Round-robin across colour families so the sample isn't 70 black shirts.
function sampleByColor(items, n) {
  const groups = new Map();
  for (const it of items) {
    const key = it.color_family ?? 'none';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const out = [];
  const queues = [...groups.values()];
  while (out.length < n && queues.some((q) => q.length)) {
    for (const q of queues) if (q.length && out.length < n) out.push(q.shift());
  }
  return out;
}

const store = args.store.replace(/\/$/, '');
const storeHost = new URL(store).host;
console.log(`Fetching catalog from ${store} ...`);
const raw = await fetchAllProducts(store, {
  onPage: (page, n, total) => process.stdout.write(`\r  page ${page}: ${total} products`),
});
console.log();

const seen = new Set();
const products = raw
  .map((p) => normalize(p, storeHost))
  .filter((p) => p.category && p.in_stock && p.image_url)
  // Snitch lists some products twice under different ids; keep the first of each title + colour.
  .filter((p) => {
    const key = `${p.title.toLowerCase()}|${p.color}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

let selected = products;
if (!args.all) {
  const scale = Number(args.scale);
  const byCat = Object.groupBy(products, (p) => p.category);
  selected = Object.entries(byCat).flatMap(([cat, items]) =>
    sampleByColor(items, Math.ceil((QUOTA[cat] ?? 5) * scale)));
  // Products saved by an earlier run stay and get refreshed, so tags and stock never go stale.
  const { rows } = await pool.query('SELECT id::text FROM products WHERE store = $1', [storeHost]);
  const kept = new Set(rows.map((r) => r.id));
  const picked = new Set(selected.map((p) => String(p.id)));
  selected.push(...products.filter((p) => kept.has(String(p.id)) && !picked.has(String(p.id))));
}

const counts = Object.entries(Object.groupBy(selected, (p) => p.category))
  .map(([c, l]) => `${c}:${l.length}`).join('  ');
console.log(`Usable: ${products.length}, saving ${selected.length}\n  ${counts}`);

const UPSERT = `
INSERT INTO products (id, store, handle, title, product_type, description, tags, image_url, images, price,
  compare_at_price, sizes, in_stock, category, slot, color, color_family, pattern, fit, fabric, formality, occasions)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
ON CONFLICT (id) DO UPDATE SET
  handle = EXCLUDED.handle, title = EXCLUDED.title, product_type = EXCLUDED.product_type,
  description = EXCLUDED.description, tags = EXCLUDED.tags, image_url = EXCLUDED.image_url, images = EXCLUDED.images,
  price = EXCLUDED.price, compare_at_price = EXCLUDED.compare_at_price, sizes = EXCLUDED.sizes,
  in_stock = EXCLUDED.in_stock, category = EXCLUDED.category, slot = EXCLUDED.slot,
  pattern = EXCLUDED.pattern, fit = EXCLUDED.fit, fabric = EXCLUDED.fabric,
  -- keep what the AI pass decided; rules only fill rows it hasn't touched yet
  color = CASE WHEN products.ai_tagged_at IS NULL THEN EXCLUDED.color ELSE products.color END,
  color_family = CASE WHEN products.ai_tagged_at IS NULL THEN EXCLUDED.color_family ELSE products.color_family END,
  formality = CASE WHEN products.ai_tagged_at IS NULL THEN EXCLUDED.formality ELSE products.formality END,
  occasions = CASE WHEN products.ai_tagged_at IS NULL THEN EXCLUDED.occasions ELSE products.occasions END,
  updated_at = now()`;

const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const p of selected) {
    await client.query(UPSERT, [p.id, p.store, p.handle, p.title, p.product_type, p.description, p.tags, p.image_url,
      p.images, p.price, p.compare_at_price, JSON.stringify(p.sizes), p.in_stock, p.category, p.slot, p.color,
      p.color_family, p.pattern, p.fit, p.fabric, p.formality, p.occasions]);
  }
  // Anything no longer in the feed (or now sold out) can't be recommended.
  await client.query('UPDATE products SET in_stock = false WHERE store = $1 AND id <> ALL($2::bigint[])',
    [storeHost, selected.map((p) => p.id)]);
  await client.query('DELETE FROM looks_cache');
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}

console.log(`Saved ${selected.length} products. Next: npm run enrich`);
await pool.end();
