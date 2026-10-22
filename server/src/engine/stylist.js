// Free-text styling requests ("something for my cousin's sangeet, no black") -> occasion + colour prefs -> looks.
import { chatJson } from '../ollama.js';
import { OCCASION_KEYS } from './occasions.js';
import { getLooks } from './outfits.js';

const FAMILIES = ['black', 'white', 'cream', 'grey', 'navy', 'light_blue', 'blue', 'beige', 'brown', 'olive', 'green',
  'maroon', 'red', 'pink', 'yellow', 'orange', 'purple'];

const SCHEMA = {
  type: 'object',
  properties: {
    occasion: { type: 'string', enum: OCCASION_KEYS },
    prefer_colors: { type: 'array', items: { type: 'string', enum: FAMILIES } },
    avoid_colors: { type: 'array', items: { type: 'string', enum: FAMILIES } },
  },
  required: ['occasion', 'prefer_colors', 'avoid_colors'],
};

const SYSTEM = `Map a shopper's styling request to one occasion and colour preferences.
office = work, meetings, interviews. casual = weekend, college, travel, beach, brunch.
date = dinner, date, party, club, night out. festive = Diwali, weddings, sangeet, mehendi, haldi, puja, Eid.
Only list colours the shopper actually asked for or against.`;

const KEYWORDS = [
  [/wedding|shaadi|diwali|festive|puja|pooja|sangeet|mehendi|haldi|eid|reception|engagement/i, 'festive'],
  [/office|work|meeting|interview|formal|presentation|client/i, 'office'],
  [/date|dinner|party|club|night|anniversary|drinks/i, 'date'],
  [/casual|weekend|college|travel|beach|brunch|trip|vacation|movie/i, 'casual'],
];

export function guessOccasion(text) {
  return KEYWORDS.find(([re]) => re.test(text))?.[1] ?? null;
}

export async function understand(message) {
  try {
    const out = await chatJson({ system: SYSTEM, prompt: message, schema: SCHEMA, temperature: 0, timeoutMs: 30_000 });
    return {
      occasion: OCCASION_KEYS.includes(out.occasion) ? out.occasion : guessOccasion(message),
      prefer: { colors: out.prefer_colors ?? [], avoidColors: out.avoid_colors ?? [] },
      source: 'llm',
    };
  } catch {
    return { occasion: guessOccasion(message), prefer: null, source: 'keywords' };
  }
}

export async function stylistChat(productId, message, { size } = {}) {
  const intent = await understand(message);
  const hasPrefs = intent.prefer && (intent.prefer.colors.length || intent.prefer.avoidColors.length);
  const looks = await getLooks(productId, {
    occasion: intent.occasion,
    size,
    prefer: hasPrefs ? intent.prefer : undefined,
  });
  return looks && { ...looks, understood: intent };
}
