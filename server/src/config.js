const env = process.env;

export const config = {
  databaseUrl: env.DATABASE_URL ?? 'postgres://styling:styling@localhost:5433/styling',
  ollamaUrl: env.OLLAMA_URL ?? 'http://localhost:11434',
  tagModel: env.TAG_MODEL ?? 'qwen3-vl:4b-instruct',
  chatModel: env.CHAT_MODEL ?? 'qwen3-vl:4b-instruct',
  embedModel: env.EMBED_MODEL ?? 'nomic-embed-text',
  embedDim: Number(env.EMBED_DIM ?? 768),
  storeUrl: (env.STORE_URL ?? 'https://www.snitch.co.in').replace(/\/$/, ''),
  storeName: env.STORE_NAME ?? 'Snitch',
  port: Number(env.PORT ?? 4000),
  publicUrl: (env.PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, ''),
  shopUrl: (env.SHOP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  whatsapp: {
    token: env.WHATSAPP_TOKEN || '',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || 'change-me',
    template: env.WHATSAPP_TEMPLATE || 'post_purchase_styling',
    templateLang: env.WHATSAPP_TEMPLATE_LANG || 'en',
    graphVersion: env.GRAPH_API_VERSION || 'v23.0',
  },
};

// Without a token and phone number id we never call Meta; messages are only previewed.
export const whatsappLive = () => Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId);
