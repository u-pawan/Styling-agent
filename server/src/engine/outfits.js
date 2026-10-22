// The outfit engine. Picks real, in-stock catalog items for each slot with rules + vector "vibe",
// then a small local LLM only names and explains the looks. It never invents products.
import { query, toVector } from '../db.js';
import { embed } from '../ollama.js';
import { config } from '../config.js';
import { PROFILES, NEEDS, OCCASION_KEYS, defaultOccasion } from './occasions.js';
import { colorScore, isLoud } from './colors.js';
import { writeCopy } from './copy.js';

const CARD = `id, handle, title, category, slot, color, color_family, pattern, fit, fabric, formality, occasions,
  price, compare_at_price, image_url, sizes, style_note`;

const LETTER_SIZE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)$/i;
const CACHE_HOURS = 6;
const BUNDLE_DISCOUNT = 0.1;

const vibeCache = new Map();
function vibeVector(occasion) {
  if (!vibeCache.has(occasion)) {
    vibeCache.set(occasion, embed([PROFILES[occasion].vibe], 'search_query')
      .then(([v]) => v)
      .catch(() => { vibeCache.delete(occasion); return null; }));
  }
  return vibeCache.get(occasion);
}

export async function getProduct(id) {
  const { rows } = await query(`SELECT ${CARD}, product_type, description, images, in_stock FROM products WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

async function fetchPool(slot, categories, excludeId, vibe) {
  const params = [slot, categories, excludeId];
  let vibeSql = 'NULL::float8 AS vibe';
  let order = 'formality DESC, id';
  if (vibe) {
    params.push(toVector(vibe));
    vibeSql = '1 - (embedding <=> $4::vector) AS vibe';
    order = 'embedding <=> $4::vector NULLS LAST';
  }
  const { rows } = await query(
    `SELECT ${CARD}, ${vibeSql} FROM products
     WHERE in_stock AND slot = $1 AND category = ANY($2) AND id <> $3
     ORDER BY ${order} LIMIT 150`, params);
  return rows;
}

function fitsSize(item, size) {
  if (!size || !LETTER_SIZE.test(size) || !['top', 'layer'].includes(item.slot)) return true;
  return item.sizes.some((s) => s.available && String(s.size).toUpperCase() === size.toUpperCase());
}

function scoreItem(item, ctx) {
  const { anchor, profile, occasion, target, prefer, vibeMean } = ctx;
  let s = 1.5 * colorScore(anchor.color_family, item.color_family);
  if (item.occasions?.includes(occasion)) s += 1.2;
  s -= 0.8 * Math.abs((item.formality ?? 3) - target);
  if (isLoud(anchor.pattern) && isLoud(item.pattern)) s -= 1.5;
  if (profile.avoid.includes(item.pattern)) s -= 1;
  const prefs = profile[item.slot] ?? [];
  const rank = prefs.indexOf(item.category);
  if (rank >= 0) s += (0.6 * (prefs.length - rank)) / prefs.length;
  if (item.vibe != null && vibeMean != null) s += 4 * (item.vibe - vibeMean);
  if (prefer?.colors?.includes(item.color_family)) s += 1.5;
  if (prefer?.avoidColors?.includes(item.color_family)) s -= 3;
  return s;
}

const LEATHER_BROWN = new Set(['brown', 'beige', 'olive']);

// A belt should match the shoes: black with black, brown/tan with brown/tan.
function beltScore(belt, chosen) {
  const shoes = chosen.find((c) => c.slot === 'footwear');
  if (belt.category !== 'belt' || !shoes) return 0;
  if (belt.color_family === shoes.color_family) return 2;
  return LEATHER_BROWN.has(belt.color_family) === LEATHER_BROWN.has(shoes.color_family) ? 1 : -3;
}

// Score of `item` next to pieces already in the look, minus repeats of earlier looks.
function contextScore(item, chosen, earlier, slot) {
  let s = item.score + beltScore(item, chosen);
  for (const c of chosen) {
    s += colorScore(c.color_family, item.color_family);
    if (isLoud(c.pattern) && isLoud(item.pattern)) s -= 1.5;
  }
  for (const look of earlier) {
    const prev = look.items.find((i) => i.slot === slot);
    if (!prev) continue;
    if (prev.id === item.id) s -= 2;
    if (prev.color_family === item.color_family) s -= 1;
    if (prev.category === item.category) s -= 0.3;
  }
  return s;
}

function pickBest(pool, chosen, earlier, slot, exclude) {
  let best = null;
  let bestScore = -Infinity;
  for (const item of pool) {
    if (exclude.has(item.id)) continue;
    const s = contextScore(item, chosen, earlier, slot);
    if (s > bestScore) { bestScore = s; best = item; }
  }
  return best;
}

const storeLink = (handle) => `https://${new URL(config.storeUrl).host}/products/${handle}`;

const toCard = (p) => ({
  id: String(p.id),
  handle: p.handle,
  title: p.title,
  category: p.category,
  slot: p.slot,
  color: p.color,
  colorFamily: p.color_family,
  price: Number(p.price),
  compareAtPrice: p.compare_at_price ? Number(p.compare_at_price) : null,
  image: p.image_url,
  sizes: p.sizes.filter((s) => s.available).map((s) => s.size),
  url: storeLink(p.handle),
});

export async function buildLooks(anchor, { occasion, size, prefer, count = 3 } = {}) {
  const profile = PROFILES[occasion];
  const [lo, hi] = profile.formality;
  const target = (profile.target + Math.min(hi, Math.max(lo, anchor.formality ?? profile.target))) / 2;
  const needs = NEEDS[anchor.slot] ?? NEEDS.top;
  const extras = ['top', 'bottom'].includes(anchor.slot) ? ['layer', 'accessory'] : ['accessory'];
  const vibe = await vibeVector(occasion);

  // One query per slot, all at once: on a remote database (Neon) each round trip costs ~250 ms from India.
  const slots = [...needs, ...extras];
  const fetched = await Promise.all(slots.map((slot) => fetchPool(slot, profile[slot], anchor.id, vibe)));
  const pools = {};
  slots.forEach((slot, i) => {
    const sized = fetched[i].filter((item) => fitsSize(item, size));
    pools[slot] = sized.length ? sized : fetched[i];
  });
  const vibes = Object.values(pools).flat().map((i) => i.vibe).filter((v) => v != null);
  const ctx = { anchor, profile, occasion, target, prefer, vibeMean: vibes.length ? vibes.reduce((a, b) => a + b) / vibes.length : null };
  for (const pool of Object.values(pools)) for (const item of pool) item.score = scoreItem(item, ctx);

  const looks = [];
  const usedPrimary = new Set();
  for (let k = 0; k < count; k++) {
    const items = [];
    const advice = [];
    needs.forEach((slot, i) => {
      const pool = pools[slot];
      const best = pool.length ? pickBest(pool, items, looks, slot, i === 0 ? usedPrimary : new Set()) : null;
      if (!best) { advice.push({ slot, text: profile.advice[slot] }); return; }
      if (i === 0) usedPrimary.add(best.id);
      items.push(best);
    });
    if (!items.length) break;
    // Extras raise order value: a layer on the last look, an accessory on the first.
    if (k === count - 1 && pools.layer?.length) {
      const layer = pickBest(pools.layer, items, looks, 'layer', new Set());
      if (layer && contextScore(layer, items, looks, 'layer') > 0) items.push(layer);
    }
    if (k === 0 && pools.accessory?.length) {
      const acc = pickBest(pools.accessory, items, looks, 'accessory', new Set());
      if (acc && contextScore(acc, items, looks, 'accessory') > 0) items.push(acc);
    }
    looks.push({ items, advice });
  }

  return looks.map((look) => {
    const cards = look.items.map(toCard);
    const total = Number(anchor.price) + cards.reduce((sum, c) => sum + c.price, 0);
    return {
      items: cards,
      advice: look.advice,
      total,
      bundlePrice: Math.round(total * (1 - BUNDLE_DISCOUNT)),
    };
  });
}

export async function getLooks(productId, { occasion, size, prefer, useCache = true } = {}) {
  const anchor = await getProduct(productId);
  if (!anchor) return null;
  if (!NEEDS[anchor.slot]) return { product: toCard(anchor), looks: [], occasions: [], note: 'This item is not part of outfits.' };
  const occ = PROFILES[occasion] ? occasion : defaultOccasion(anchor);
  const cacheable = useCache && !size && !prefer;

  if (cacheable) {
    const { rows } = await query(
      `SELECT payload FROM looks_cache WHERE product_id = $1 AND occasion = $2
       AND created_at > now() - make_interval(hours => $3)`, [anchor.id, occ, CACHE_HOURS]);
    if (rows[0]) return { ...rows[0].payload, cached: true };
  }

  const looks = await buildLooks(anchor, { occasion: occ, size, prefer });
  const copy = await writeCopy(anchor, occ, looks);
  const payload = {
    product: toCard(anchor),
    occasion: occ,
    occasionLabel: PROFILES[occ].label,
    occasions: OCCASION_KEYS.map((key) => ({
      key, label: PROFILES[key].label, suggested: anchor.occasions?.includes(key) ?? false,
    })),
    intro: copy.intro,
    looks: looks.map((look, i) => ({ ...look, name: copy.looks[i]?.name, why: copy.looks[i]?.why })),
    copySource: copy.source,
  };

  if (cacheable) {
    await query(
      `INSERT INTO looks_cache (product_id, occasion, payload) VALUES ($1, $2, $3)
       ON CONFLICT (product_id, occasion) DO UPDATE SET payload = EXCLUDED.payload, created_at = now()`,
      [anchor.id, occ, payload]);
  }
  return payload;
}
