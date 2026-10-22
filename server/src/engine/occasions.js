// What each occasion asks for. Category lists are in order of preference.
// `advice` is what we say when the brand doesn't sell that piece (no link, just a tip).

export const PROFILES = {
  office: {
    label: 'Office',
    formality: [3, 5],
    target: 4,
    top: ['shirt', 'polo'],
    bottom: ['trousers', 'chinos'],
    footwear: ['loafers', 'formal_shoes'],
    layer: ['blazer', 'sweater', 'overshirt'],
    accessory: ['belt', 'watch'],
    avoid: ['print'],
    advice: { top: 'a crisp solid shirt', bottom: 'tailored grey or beige trousers', footwear: 'brown leather loafers or derbies', layer: 'a navy blazer', accessory: 'a brown leather belt' },
    vibe: 'smart office wear, tailored business casual, clean and sharp',
  },
  casual: {
    label: 'Casual',
    formality: [1, 3],
    target: 2,
    top: ['tshirt', 'shirt', 'polo'],
    bottom: ['jeans', 'chinos', 'cargo', 'shorts', 'joggers'],
    footwear: ['sneakers', 'mules', 'sandals'],
    layer: ['overshirt', 'jacket', 'sweatshirt', 'hoodie'],
    accessory: ['sunglasses', 'cap'],
    avoid: [],
    advice: { top: 'a plain crew-neck tee', bottom: 'straight-fit blue jeans', footwear: 'clean white sneakers', layer: 'a light overshirt', accessory: 'sunglasses' },
    vibe: 'relaxed weekend casual, street style, comfortable',
  },
  date: {
    label: 'Date night',
    formality: [2, 4],
    target: 3,
    top: ['shirt', 'polo', 'tshirt'],
    bottom: ['jeans', 'chinos', 'trousers'],
    footwear: ['sneakers', 'loafers', 'boots'],
    layer: ['jacket', 'overshirt', 'blazer', 'sweater'],
    accessory: ['watch', 'jewellery', 'belt'],
    avoid: [],
    advice: { top: 'a dark fitted shirt', bottom: 'dark slim jeans', footwear: 'minimal white sneakers or suede loafers', layer: 'a suede or bomber jacket', accessory: 'a simple chain or watch' },
    vibe: 'dinner date night, sharp evening party look, confident',
  },
  festive: {
    label: 'Festive / Wedding',
    formality: [3, 5],
    target: 4,
    top: ['kurta', 'shirt'],
    bottom: ['trousers', 'chinos'],
    footwear: ['loafers', 'formal_shoes', 'mules'],
    layer: ['blazer', 'jacket'],
    accessory: ['watch', 'jewellery'],
    avoid: [],
    advice: { top: 'a rich-coloured kurta or shirt', bottom: 'cream or beige trousers', footwear: 'tan loafers or juttis', layer: 'a nehru jacket', accessory: 'a statement watch' },
    vibe: 'festive Diwali and wedding celebration, rich colours, elegant',
  },
};

export const OCCASION_KEYS = Object.keys(PROFILES);

// Which other pieces complete an outfit, given the piece the shopper is looking at.
export const NEEDS = {
  top: ['bottom', 'footwear'],
  layer: ['top', 'bottom', 'footwear'],
  bottom: ['top', 'footwear'],
  footwear: ['top', 'bottom'],
  accessory: ['top', 'bottom', 'footwear'],
};

// The occasion to open with: the product's own tags first, else the closest formality.
export function defaultOccasion(product) {
  const tagged = product.occasions?.find((o) => PROFILES[o]);
  if (tagged) return tagged;
  const f = product.formality ?? 3;
  return OCCASION_KEYS.reduce((best, o) =>
    Math.abs(PROFILES[o].target - f) < Math.abs(PROFILES[best].target - f) ? o : best, 'casual');
}
