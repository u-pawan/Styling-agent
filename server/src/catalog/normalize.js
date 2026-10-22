// Turns a raw Shopify product into our attributes using free rules (tags, type, title).
// The AI pass (enrich.js) only fills what these rules leave empty.

export const OCCASIONS = ['office', 'casual', 'date', 'festive'];

export const SLOT_OF = {
  shirt: 'top', tshirt: 'top', polo: 'top', kurta: 'top',
  overshirt: 'layer', jacket: 'layer', blazer: 'layer', sweater: 'layer', sweatshirt: 'layer', hoodie: 'layer',
  jeans: 'bottom', trousers: 'bottom', chinos: 'bottom', cargo: 'bottom', shorts: 'bottom', joggers: 'bottom',
  sneakers: 'footwear', loafers: 'footwear', formal_shoes: 'footwear', boots: 'footwear', mules: 'footwear', sandals: 'footwear',
  belt: 'accessory', sunglasses: 'accessory', bag: 'accessory', cap: 'accessory', jewellery: 'accessory', watch: 'accessory',
};

// Base formality per category (1 lounge .. 5 formal); tags and AI adjust it.
export const BASE_FORMALITY = {
  shirt: 3, tshirt: 1, polo: 2, kurta: 4,
  overshirt: 2, jacket: 2, blazer: 5, sweater: 3, sweatshirt: 1, hoodie: 1,
  jeans: 2, trousers: 4, chinos: 3, cargo: 1, shorts: 1, joggers: 1,
  sneakers: 2, loafers: 4, formal_shoes: 5, boots: 3, mules: 2, sandals: 1,
  belt: 3, sunglasses: 2, bag: 2, cap: 1, jewellery: 2, watch: 3,
};

const has = (s, re) => re.test(s);

function shoeType(text) {
  if (has(text, /\bmules?\b/)) return 'mules';
  if (has(text, /\b(sandals?|slides?|flip.?flops?)\b/)) return 'sandals';
  if (has(text, /\b(loafers?|moccasins?)\b/)) return 'loafers';
  if (has(text, /\bboots?\b/)) return 'boots';
  if (has(text, /\b(derby|oxford|brogue|formal shoes)\b/)) return 'formal_shoes';
  if (has(text, /\b(sneakers?|boat shoes|trainers?)\b/)) return 'sneakers';
  return null;
}

export function categorize(productType = '', title = '', tags = []) {
  const type = productType.toLowerCase();
  const t = `${title} ${tags.join(' ')}`.toLowerCase();
  switch (type) {
    case 'shirts':
      return has(t, /\bkurta\b/) ? 'kurta' : has(title.toLowerCase(), /\b(overshirt|shacket)\b/) ? 'overshirt' : 'shirt';
    case 't-shirts':
      return has(t, /\bpolo\b/) ? 'polo' : 'tshirt';
    case 'jeans': return 'jeans';
    case 'chinos': return 'chinos';
    case 'trousers': return has(t, /\bchino/) ? 'chinos' : has(t, /\bcargo/) ? 'cargo' : 'trousers';
    case 'cargo pants': return 'cargo';
    case 'shorts': return 'shorts';
    case 'joggers & trackpants': return 'joggers';
    case 'overshirt': return 'overshirt';
    case 'jackets': return has(t, /\bblazer\b/) ? 'blazer' : 'jacket';
    case 'sweaters': return 'sweater';
    case 'sweatshirts': return has(t, /\bhoodie|hooded\b/) ? 'hoodie' : 'sweatshirt';
    case 'shoes':
      // The title is the most reliable signal; tags only break ties ("Formal Wear" sits on sneakers too).
      return shoeType(title.toLowerCase()) ?? shoeType(t) ?? 'sneakers';
    case 'belts': return 'belt';
    case 'sunglasses': return 'sunglasses';
    case 'bags': return 'bag';
    case 'accessories': {
      const name = title.toLowerCase();
      if (has(name, /\b(cap|hat)\b/)) return 'cap';
      if (has(name, /\bwatch\b/)) return 'watch';
      if (has(name, /\b(chain|bracelet|ring|pendant|necklace|kada)\b/)) return 'jewellery';
      return null; // socks, wallets, keychains... not outfit pieces
    }
    default:
      return null; // luggage, perfume, etc. are not part of outfits
  }
}

// Colour names collapse into families the harmony rules understand.
const COLOR_FAMILIES = [
  [/off.?white|cream|ivory|ecru/, 'cream'],
  [/white/, 'white'],
  [/black|charcoal black/, 'black'],
  [/light ?grey|grey|gray|charcoal|silver/, 'grey'],
  [/navy|dark blue/, 'navy'],
  [/light blue|sky|powder blue/, 'light_blue'],
  [/blue|indigo|denim/, 'blue'],
  [/beige|khaki|sand|camel|taupe|stone/, 'beige'],
  [/brown|tan|coffee|chocolate/, 'brown'],
  [/olive/, 'olive'],
  [/green|mint|teal|sage/, 'green'],
  [/maroon|burgundy|wine/, 'maroon'],
  [/red/, 'red'],
  [/pink|peach|mauve|rose/, 'pink'],
  [/yellow|mustard/, 'yellow'],
  [/orange|rust/, 'orange'],
  [/purple|lavender|lilac/, 'purple'],
  [/gold/, 'gold'],
  [/multi/, 'multi'],
];

export function colorFamily(color) {
  if (!color) return null;
  const c = color.toLowerCase();
  for (const [re, fam] of COLOR_FAMILIES) if (re.test(c)) return fam;
  return null;
}

const KNOWN_COLOR_TAGS = ['Black', 'Blue', 'White', 'Navy', 'Grey', 'Green', 'Brown', 'Olive', 'Beige', 'Off White',
  'Maroon', 'Cream', 'Pink', 'Mauve', 'Khaki', 'Silver', 'Purple', 'Yellow', 'Multi', 'Lavender', 'Red', 'Orange',
  'Peach', 'Mustard', 'Light Blue', 'Burgundy', 'Gold', 'Taupe'];

function pickColor(raw) {
  const opt = raw.options?.find((o) => o.name.toLowerCase() === 'color');
  const fromOption = opt?.values?.find((v) => v && v !== 'Default Title');
  if (fromOption) return fromOption;
  const fromTag = raw.tags.find((tag) => KNOWN_COLOR_TAGS.includes(tag));
  if (fromTag) return fromTag;
  const inTitle = KNOWN_COLOR_TAGS.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(raw.title));
  return inTitle ?? null;
}

const PATTERNS = [
  [/graphic|print(ed)?|abstract|floral|tropical|camo/i, 'print'],
  [/checks?|checked|plaid|gingham/i, 'checks'],
  [/stripes?|striped/i, 'stripes'],
  [/embroider/i, 'embroidered'],
  [/textured|self.?design|jacquard|waffle|ribbed/i, 'textured'],
  [/plain|solid/i, 'solid'],
];

function pickPattern(tags, title) {
  const text = `${tags.join(' ')} ${title}`;
  for (const [re, p] of PATTERNS) if (re.test(text)) return p;
  return null;
}

const FITS = ['Slim Fit', 'Regular Fit', 'Oversized Fit', 'Box Fit', 'Relaxed Fit', 'Straight Fit', 'Baggy Fit', 'Skinny Fit', 'Tapered Fit', 'Wide Leg'];
const FABRICS = ['Linen', 'Cotton', 'Cotton Blend', 'Denim Weave', 'Poly Blend', 'Polyester', 'Viscose', 'Viscose Blend', 'Nylon Blend', 'Wool', 'Corduroy', 'Suede', 'Leather', 'Vegan Leather'];

// Store tags that tell us the occasion directly.
const OCCASION_TAGS = {
  'Formal Wear': ['office'],
  'Smart Casuals': ['office', 'date'],
  'Casual Wear': ['casual'],
  'Street Wear': ['casual'],
  'College Wear': ['casual'],
  'Beach Wear': ['casual'],
  'Club Wear': ['date'],
  'Party Wear': ['date'],
  'Festive Wear': ['festive'],
};

const FORMALITY_TAGS = { 'Formal Wear': 1, 'Smart Casuals': 0.5, 'Festive Wear': 0.5, 'Street Wear': -1, 'Beach Wear': -1 };

const stripHtml = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function normalize(raw, store) {
  const tags = raw.tags ?? [];
  const category = categorize(raw.product_type, raw.title, tags);
  const color = pickColor(raw);
  const sizeIdx = raw.options?.findIndex((o) => o.name.toLowerCase() === 'size') ?? -1;

  const sizes = raw.variants.map((v) => ({
    size: sizeIdx >= 0 ? v[`option${sizeIdx + 1}`] : v.title,
    available: Boolean(v.available),
    variantId: v.id,
  }));

  const occasions = [...new Set(tags.flatMap((tag) => OCCASION_TAGS[tag] ?? []))];

  let formality = null;
  if (category) {
    const shift = tags.reduce((s, tag) => s + (FORMALITY_TAGS[tag] ?? 0), 0);
    formality = Math.max(1, Math.min(5, Math.round(BASE_FORMALITY[category] + shift)));
  }

  const prices = raw.variants.map((v) => Number(v.price)).filter(Number.isFinite);
  const compare = raw.variants.map((v) => Number(v.compare_at_price)).filter((n) => Number.isFinite(n) && n > 0);

  return {
    id: raw.id,
    store,
    handle: raw.handle,
    title: raw.title,
    product_type: raw.product_type,
    description: stripHtml(raw.body_html).slice(0, 1200),
    tags,
    image_url: raw.images?.[0]?.src ?? null,
    images: (raw.images ?? []).slice(0, 6).map((i) => i.src),
    price: prices.length ? Math.min(...prices) : null,
    compare_at_price: compare.length ? Math.max(...compare) : null,
    sizes,
    in_stock: sizes.some((s) => s.available),
    category,
    slot: category ? SLOT_OF[category] : 'other',
    color,
    color_family: colorFamily(color),
    pattern: pickPattern(tags, raw.title),
    fit: tags.find((tag) => FITS.includes(tag)) ?? null,
    fabric: tags.find((tag) => FABRICS.includes(tag)) ?? null,
    formality,
    occasions,
  };
}
