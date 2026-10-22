# Server

Node 22+ / Express 5 API, the catalog pipeline (import → AI tagging → embeddings), the outfit engine and the WhatsApp flow. Plain JavaScript (ES modules). It reads settings from the root `.env`.

## Run

```bash
npm run dev        # API on :4000, restarts on file or .env changes
npm test           # rule tests (node:test)
```

## Pipeline scripts

| Script | What it does |
| --- | --- |
| `npm run migrate` | Creates the `vector` extension, tables and the HNSW index. Safe to re-run. |
| `npm run import -- --store <url> [--scale n] [--all]` | Reads `<store>/products.json`, applies rule tags and saves a colour-balanced sample. It refreshes products saved earlier and marks delisted ones out of stock. |
| `npm run enrich -- [--vision] [--force] [--limit n] [--concurrency n]` | Has the local LLM fill formality, occasions and a style note, then embeds anything without a vector. `--vision` also sends the photo. |
| `npm run copy-products -- --from <postgres url>` | Copies products, tags and vectors included, into `DATABASE_URL` (for example local → Neon). |
| `npm run prewarm -- [--category shirt] [--limit 12]` | Generates and caches looks for every occasion. |

## Code map

```
scripts/                CLI entry points listed above
src/
  config.js             reads .env; whatsappLive() decides preview vs real sending
  db.js                 pg pool (TLS + certificate check for Neon)
  schema.js             tables: products, looks_cache, subscribers, messages
  ollama.js             chatJson (structured output), embed, image download
  routes.js             REST API + Meta webhook
  catalog/
    shopify.js          paged /products.json reader
    normalize.js        rules: category, slot, colour family, pattern, fit, fabric, occasions
    enrich.js           LLM tagging prompt + embedding text
  engine/
    occasions.js        what each occasion needs (categories, formality, advice, vibe text)
    colors.js           colour harmony scores (-2 clash .. +2 classic)
    outfits.js          candidate pools per slot, scoring, look assembly, caching
    copy.js             LLM look names and reasons (template fallback)
    stylist.js          free-text request → occasion + colour preferences
  whatsapp/
    collage.js          outfit image with sharp
    message.js          post-purchase template payload + preview
    inbound.js          customer replies, STOP opt-out
    cloudApi.js         Meta Graph API client
test/rules.test.js
```

## How a look is built

1. Load the anchor product and pick the occasion (the one asked for, else the product's own tags, else the nearest formality).
2. For each slot the anchor needs (a shirt needs a bottom and shoes; layers and accessories are extras), fetch up to 150 in-stock candidates from allowed categories, ordered by vector similarity to the occasion's vibe. All slots are queried in parallel.
3. Score each candidate: colour harmony with the anchor ×1.5, occasion match +1.2, formality distance −0.8 per step, pattern clash −1.5, category preference, relative vibe, and the shopper's colour likes and dislikes.
4. Build up to 3 looks greedily. Each pick is also scored against pieces already in the look (belt matches shoes, no two loud patterns), and looks are penalised for repeating each other. A layer goes on the last look and an accessory on the first.
5. The LLM writes a name and reason per look from the chosen items only. If Ollama is down, a template fills in.
6. The result is cached in `looks_cache` for 6 hours (not for size- or preference-specific requests).

## API

| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/api/health` | – |
| GET | `/api/categories` | – |
| GET | `/api/products` | `category`, `slot`, `q` (meaning search), `limit` |
| GET | `/api/products/:id` | – |
| GET | `/api/products/:id/looks` | `occasion` (`office`, `casual`, `date`, `festive`), `size` |
| POST | `/api/stylist/chat` | `{ productId, message, size? }` |
| GET | `/api/whatsapp/template` | – |
| POST | `/api/whatsapp/optin` | `{ phone, name }` |
| POST | `/api/orders/simulate` | `{ productId, phone, orderRef? }` |
| POST | `/api/whatsapp/simulate-reply` | `{ phone, text }` |
| GET | `/api/whatsapp/messages` | `phone` |
| GET/POST | `/webhooks/whatsapp` | Meta verification + inbound messages |

Phone numbers are digits with country code and no `+` (for example `919812345678`).
