import { config } from './config.js';

async function post(path, body, { timeoutMs = 120_000 } = {}) {
  const res = await fetch(`${config.ollamaUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

// Chat that must answer in JSON matching `schema` (Ollama structured outputs).
export async function chatJson({ model = config.chatModel, system, prompt, images, schema, temperature = 0.2, timeoutMs }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt, ...(images?.length ? { images } : {}) });
  const data = await post('/api/chat', {
    model,
    messages,
    format: schema,
    stream: false,
    think: false, // qwen3-vl thinks by default; tagging and copy don't need it and it's ~10x slower
    options: { temperature },
  }, { timeoutMs });
  return JSON.parse(data.message.content);
}

export async function chatText({ model = config.chatModel, system, messages, temperature = 0.4, timeoutMs }) {
  const data = await post('/api/chat', {
    model,
    messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
    stream: false,
    think: false,
    options: { temperature },
  }, { timeoutMs });
  return data.message.content.trim();
}

// nomic-embed-text expects a task prefix; other models ignore it harmlessly.
const prefix = (kind) => (config.embedModel.startsWith('nomic') ? `${kind}: ` : '');

export async function embed(texts, kind = 'search_document') {
  const input = texts.map((t) => prefix(kind) + t);
  const data = await post('/api/embed', { model: config.embedModel, input });
  return data.embeddings;
}

export async function imageToBase64(url, width = 512) {
  const sized = url.includes('cdn.shopify.com') ? `${url}${url.includes('?') ? '&' : '?'}width=${width}` : url;
  const res = await fetch(sized, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`image ${res.status}`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

export async function ollamaReady() {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
