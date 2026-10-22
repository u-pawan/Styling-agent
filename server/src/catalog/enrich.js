// AI pass: a local vision-language model fills formality, occasions and a style note,
// then every product gets an embedding for search. Runs once per catalog.
import { chatJson, embed, imageToBase64 } from '../ollama.js';
import { config } from '../config.js';
import { OCCASIONS, colorFamily } from './normalize.js';

// Merchandising tags (sale batches, model names, vendors) say nothing about style.
const NOISE = /^(model-|cg-|sl_|bday|ai\b|ai-|hide-app|no ?ex|no ?return|outsource|mp-skus|plus size$|snitch plus)|%|_|\d{4}|liquid|flash|tentative|collect/i;
const isVendor = (tag) => tag === tag.toUpperCase() && /[A-Z]{3,}/.test(tag);
export const styleTags = (tags) => tags.filter((t) => !NOISE.test(t) && !isVendor(t));

const SCHEMA = {
  type: 'object',
  properties: {
    color: { type: 'string', description: 'main colour as a shopper would say it, e.g. olive, navy, off white' },
    formality: { type: 'integer', minimum: 1, maximum: 5 },
    occasions: { type: 'array', items: { type: 'string', enum: OCCASIONS }, minItems: 1, maxItems: 3 },
    style_note: { type: 'string', description: 'one natural sentence, max 18 words, on colour, fabric, fit and vibe; never a list of tags' },
  },
  required: ['color', 'formality', 'occasions', 'style_note'],
};

const SYSTEM = `You are a menswear stylist tagging products for an Indian D2C fashion store.
Formality scale: 1 lounge/beach, 2 casual street, 3 smart casual, 4 office/business, 5 formal/wedding.
Occasions: office (work, meetings), casual (weekend, college, travel), date (dinner, party, club), festive (Diwali, weddings, pujas).
Only use what the product data and photo show. Pick only the occasions the piece truly suits (bags and casual pieces are rarely festive).
style_note is a sentence a stylist would say, e.g. "Breezy olive linen in a slim cut, easy for sunny weekends or a relaxed dinner."
Answer in JSON.`;

export async function tagProduct(p, { vision = false } = {}) {
  const useImage = vision || !p.color;
  const images = useImage && p.image_url ? [await imageToBase64(p.image_url)] : undefined;
  const prompt = [
    `Title: ${p.title}`,
    `Type: ${p.category} (${p.product_type})`,
    p.color ? `Listed colour: ${p.color}` : 'Listed colour: unknown, read it from the photo',
    `Tags: ${styleTags(p.tags).join(', ')}`,
    `Description: ${(p.description ?? '').slice(0, 500)}`,
  ].join('\n');

  const out = await chatJson({ model: config.tagModel, system: SYSTEM, prompt, images, schema: SCHEMA, timeoutMs: 180_000 });

  const aiOcc = (out.occasions ?? []).filter((o) => OCCASIONS.includes(o));
  const occasions = [...new Set([...(p.occasions ?? []), ...aiOcc])].slice(0, 3);
  const aiFormality = Math.max(1, Math.min(5, Math.round(Number(out.formality) || p.formality || 3)));
  const formality = p.formality ? Math.round((p.formality + aiFormality) / 2) : aiFormality;
  const color = p.color ?? out.color ?? null;

  return {
    color,
    color_family: p.color_family ?? colorFamily(color),
    formality,
    occasions: occasions.length ? occasions : ['casual'],
    style_note: String(out.style_note ?? '').slice(0, 200),
  };
}

export const embeddingText = (p) => [
  p.title,
  [p.color, p.pattern, p.fit, p.fabric, p.category].filter(Boolean).join(', '),
  p.style_note,
  p.occasions?.length ? `Good for ${p.occasions.join(', ')}` : '',
].filter(Boolean).join('. ');

export async function embedProducts(products) {
  return embed(products.map(embeddingText), 'search_document');
}
