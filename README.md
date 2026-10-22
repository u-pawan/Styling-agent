# Styling Agent

An AI stylist for D2C fashion brands. When a shopper opens a product, it shows 2–3 complete outfits built only from the brand's in-stock catalog. After an order, it sends a WhatsApp message showing how to wear what they bought. The goal is a higher average order value (AOV).

Runs on your own machine with open-source models: **Postgres + pgvector** (Docker locally, **Neon** in the cloud), **Ollama** for AI, a **Node/Express** API and a **React** demo shop.

| Part | Folder | Docs |
| --- | --- | --- |
| API, catalog pipeline, outfit engine, WhatsApp | [`server/`](server) | [server/README.md](server/README.md) |
| Demo shop with the styling widget | [`web/`](web) | [web/README.md](web/README.md) |

## How it works

1. **Import**: reads a Shopify store's catalog and pulls colour, fit, fabric, pattern and occasion from the brand's own tags with free rules.
2. **Enrich (once per catalog)**: a local vision-language model (`qwen3-vl:4b-instruct`) adds formality (1–5), occasions and a one-line style note. `nomic-embed-text` gives every product a vector.
3. **Outfits**: for each slot (bottom, shoes, layer, accessory) the engine scores real in-stock items on colour harmony, occasion, formality, pattern clashes and an occasion "vibe" vector, then builds distinct looks. The LLM only names and explains them. It **never invents products**. If the brand doesn't sell a piece, the look shows a tip with no link.
4. **WhatsApp**: after an order from a customer who opted in, it builds an outfit collage and a marketing template with two looks. A customer reply opens Meta's 24-hour window, so the stylist can chat freely. One message per order, and STOP opts out.

## Requirements

- macOS or Linux with 16 GB RAM (an Apple-silicon Mac works well)
- Node.js 22+
- Docker Desktop (only for the local database)
- Ollama (`brew install ollama`)
- Optional: a [Neon](https://neon.tech) Postgres project; `cloudflared` for share links

## Quick start

```bash
git clone <this repo> && cd Styling-agent
cp .env.example .env                      # defaults work for a local run
npm install

ollama serve                              # keep running in its own terminal
ollama pull qwen3-vl:4b-instruct          # ~3.3 GB
ollama pull nomic-embed-text              # ~270 MB

npm run db:up                             # local Postgres + pgvector on :5433
npm run migrate                           # tables, vector extension, indexes
npm run import                            # ~350-product sample of STORE_URL
npm run enrich                            # AI tagging, ~3 s per product
npm run dev                               # API on :4000, shop on :5173
```

Open http://localhost:5173, pick a product, and scroll to **Complete the look**. Add a full look, check out with the WhatsApp box ticked, and reply in the phone preview.

## Configuration

All settings live in `.env`; [`.env.example`](.env.example) documents each one. **Never commit `.env`**: it holds your database password and API keys, and `.gitignore` already excludes it.

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Local Docker Postgres, or your Neon pooled connection string |
| `OLLAMA_URL`, `TAG_MODEL`, `CHAT_MODEL`, `EMBED_MODEL`, `EMBED_DIM` | Which local models to use |
| `STORE_URL`, `STORE_NAME` | The Shopify store to demo |
| `PORT`, `PUBLIC_URL`, `SHOP_URL` | Where the API and shop are reachable (used in WhatsApp links) |
| `WHATSAPP_*`, `GRAPH_API_VERSION` | Meta Cloud API settings; leave empty for preview mode |

## Using Neon

Neon is plain Postgres with pgvector, so the code doesn't change.

1. Create a Neon project and copy the **pooled** connection string into `DATABASE_URL`.
2. Run `npm run migrate`.
3. Fill the catalog in one of two ways:
   - **Copy what you already tagged locally (no re-tagging):** `npm run copy-products -w server`, then `npm run enrich`.
   - **Start fresh:** `npm run import && npm run enrich`.

`GET /api/health` shows `db.host`, so you can confirm which database the API is using. Each query from India to a US region takes about 250 ms. In production, run the API in the same region as the database; Singapore (`aws-ap-southeast-1`) is closest to India.

## Sharing a demo link

To show the demo to someone without deploying:

```bash
npm run build -w web
npm run preview -w web                    # production shop on :4173 (API must be running)
cloudflared tunnel --url http://localhost:4173
```

Put the printed `https://<random>.trycloudflare.com` address into `PUBLIC_URL` and `SHOP_URL` in `.env`; the API restarts on its own. Run `npm run prewarm -w server` so the first products load instantly. The link only works while your machine and these commands are running, and it changes every time.

## Going live on WhatsApp

The app runs in **preview mode** until these are set; it shows the exact payload it would send.

1. In Meta Business Manager, create a WhatsApp Cloud API app and add a number. Set `WHATSAPP_PHONE_NUMBER_ID` and a permanent `WHATSAPP_TOKEN`.
2. Create a **Marketing** template named `post_purchase_styling` (`en`) with an image header, the body from `GET /api/whatsapp/template`, two URL buttons with a dynamic suffix (`https://your-shop/{{1}}`) and a quick reply "Style it for a wedding".
3. Expose the API publicly and set `PUBLIC_URL` so Meta can fetch the collage image.
4. Set the webhook to `https://<public-url>/webhooks/whatsapp` with `WHATSAPP_VERIFY_TOKEN`, and subscribe to `messages`.

Marketing messages are paid per message (check Meta's current rate card). Only send them to customers who opted in.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (watch mode) and shop dev server together |
| `npm run db:up` / `db:down` | Start or stop local Postgres |
| `npm run migrate` | Create tables and indexes |
| `npm run import -- --store https://brand.com --scale 1` | Load a Shopify catalog sample (`--all` loads everything) |
| `npm run enrich -- [--vision] [--force]` | AI tagging + embeddings for untagged products |
| `npm run copy-products -w server -- --from <url>` | Copy tagged products between databases |
| `npm run prewarm -w server -- --category shirt --limit 12` | Cache looks so demos never wait |
| `npm test -w server` | Rule tests |

## Troubleshooting

- **Every tagging call times out**: you're on `qwen3-vl:4b`, the "thinking" variant, which ignores `think: false` when a JSON schema is set. Use `qwen3-vl:4b-instruct`.
- **"AI offline" in the shop header**: start `ollama serve`.
- **The first request after a break is slow**: Neon pauses idle databases, and waking takes a second or two.
- **Changed `EMBED_MODEL`**: set `EMBED_DIM` to match, then migrate a fresh database and re-run `enrich --force`.

## Status

Working: catalog import and tagging, outfit engine, demo shop, WhatsApp preview and chat. Next: Shopify app install (Admin API + order webhook), live WhatsApp sending, A/B test reporting on AOV, and per-brand onboarding.

The demo catalog is a brand's public product feed, for private pitches only; don't publish it.

## License

[MIT](LICENSE)
