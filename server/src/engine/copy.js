// Look names and one-line reasons, written by the local LLM from the items we already chose.
import { chatJson } from '../ollama.js';
import { PROFILES } from './occasions.js';

const SCHEMA = {
  type: 'object',
  properties: {
    intro: { type: 'string', description: 'one friendly sentence, max 20 words', maxLength: 140 },
    looks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'evocative 2 to 4 word name', maxLength: 32 },
          why: { type: 'string', description: 'max 20 words on why the pieces work together', maxLength: 150 },
        },
        required: ['name', 'why'],
      },
    },
  },
  required: ['intro', 'looks'],
};

const SYSTEM = `You are a friendly menswear stylist for an Indian D2C fashion brand.
Write short, specific styling copy. Mention colours and pieces by name. No emojis, no hype words like "elevate".
Only talk about the items given to you.
- intro: one sentence that names the shopper's piece and the occasion.
- each look name: 2 to 4 evocative words, like "Monday Boardroom" or "Sunset Rooftop". Never "Look 1".
- each why: one sentence, at most 20 words.`;

// "Olive Slim Fit Shirt" already says olive; only add the colour when the title doesn't.
const describe = (i) =>
  i.color && !i.title.toLowerCase().includes(i.color.toLowerCase()) ? `${i.color} ${i.title}` : i.title;

function fallback(anchor, occasion, looks) {
  const label = PROFILES[occasion].label.toLowerCase();
  const names = ['The easy classic', 'A fresh take', 'Layered up'];
  return {
    source: 'template',
    intro: `Here is how to wear the ${anchor.title.toLowerCase()} for ${label}.`,
    looks: looks.map((look, i) => ({
      name: names[i] ?? `Look ${i + 1}`,
      why: `${look.items.map((it) => `${it.color ?? ''} ${it.category}`.trim()).join(' + ')} keeps it right for ${label}.`,
    })),
  };
}

export async function writeCopy(anchor, occasion, looks) {
  if (!looks.length) return fallback(anchor, occasion, looks);
  const prompt = [
    `Occasion: ${PROFILES[occasion].label}`,
    `The shopper is looking at: ${describe(anchor)}`,
    ...looks.map((look, i) => [
      `Outfit ${String.fromCharCode(65 + i)}: ${look.items.map(describe).join(' | ')}`,
      ...look.advice.map((a) => `  (brand doesn't sell a ${a.slot}; suggest ${a.text})`),
    ].join('\n')),
    `Return exactly ${looks.length} looks in the same order.`,
  ].join('\n');

  try {
    const out = await chatJson({ system: SYSTEM, prompt, schema: SCHEMA, temperature: 0.5, timeoutMs: 60_000 });
    if (!Array.isArray(out.looks) || out.looks.length < looks.length) throw new Error('short answer');
    return { source: 'llm', intro: out.intro, looks: out.looks };
  } catch (err) {
    console.warn(`[copy] LLM unavailable, using template: ${err.message}`);
    return fallback(anchor, occasion, looks);
  }
}
