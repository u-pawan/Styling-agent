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

Works on **macOS** and **Windows 10/11** (Linux works too, with the macOS commands).

| | macOS | Windows |
| --- | --- | --- |
| Hardware | 16 GB RAM; Apple-silicon Macs run the models on the GPU | 16 GB RAM; an NVIDIA GPU makes AI tagging much faster (CPU-only works, just slower) |
| Node.js 22.9+ | `brew install node` | `winget install OpenJS.NodeJS.LTS` |
| Git | `xcode-select --install` | `winget install Git.Git` |
| Docker Desktop (local database only) | [docker.com](https://www.docker.com/products/docker-desktop) | `winget install Docker.DockerDesktop` (needs WSL 2; restart after installing) |
| Ollama | `brew install ollama` | `winget install Ollama.Ollama` |
| cloudflared (optional, share links) | `brew install cloudflared` | `winget install --id Cloudflare.cloudflared` |

You can skip Docker if you use a [Neon](https://neon.tech) database instead (see **Using Neon**).

After installing on Windows, open a **new** terminal so the new commands are found. Use **PowerShell** or **Windows Terminal**; every `npm` command below is the same on both systems.

## Quick start

**1. Get the code and install packages**

```bash
git clone https://github.com/u-pawan/Styling-agent.git
cd Styling-agent
npm install
```

**2. Start Ollama and download the models**

- **macOS:** run `ollama serve` in its own terminal and leave it open (or `brew services start ollama` to keep it running in the background).
- **Windows:** Ollama starts by itself after install (llama icon in the system tray). If it isn't there, open **Ollama** from the Start menu.

Then, on either system:

```bash
ollama pull qwen3-vl:4b-instruct     # ~3.3 GB
ollama pull nomic-embed-text         # ~270 MB
```

**3. Check everything and create `.env`**

```bash
npm run setup
```

This checks Node, Docker, Ollama and the models, copies `.env.example` to `.env` if you don't have one, and tells you exactly what's missing.

**4. Database, catalog and AI tagging**

Start Docker Desktop first, then:

```bash
npm run db:up       # local Postgres + pgvector on port 5433
npm run migrate     # tables, vector extension, indexes
npm run import      # ~350-product sample of STORE_URL
npm run enrich      # AI tagging: ~3 s per product on an M-series Mac, slower without a GPU
```

**5. Run it**

```bash
npm run dev         # API on :4000 and shop on :5173, in one terminal
```

Open http://localhost:5173, pick a product, and scroll to **Complete the look**. Add a full look, check out with the WhatsApp box ticked, and reply in the phone preview. Stop everything with `Ctrl+C`.

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

Install `cloudflared` first (see **Requirements**). Then, with `npm run dev` already running, open two more terminals:

```bash
# terminal 2: production build of the shop on :4173
npm run build -w web
npm run preview -w web

# terminal 3: public link
cloudflared tunnel --url http://localhost:4173
```

Put the printed `https://<random>.trycloudflare.com` address into `PUBLIC_URL` and `SHOP_URL` in `.env`; the API restarts on its own. Run `npm run prewarm -w server` so the first products load instantly. The link works only while your computer is awake and these commands are running. If your computer sleeps, Cloudflare drops the tunnel and you need a new one with a new address.

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
| `npm run setup` | Check tools and models, create `.env` |
| `npm run dev` | API (watch mode) and shop dev server together |
| `npm run db:up` / `db:down` | Start or stop local Postgres |
| `npm run migrate` | Create tables and indexes |
| `npm run import -- --store https://brand.com --scale 1` | Load a Shopify catalog sample (`--all` loads everything) |
| `npm run enrich -- [--vision] [--force]` | AI tagging + embeddings for untagged products |
| `npm run copy-products -w server -- --from <url>` | Copy tagged products between databases |
| `npm run prewarm -w server -- --category shirt --limit 12` | Cache looks so demos never wait |
| `npm test` | Rule tests |

## Troubleshooting

**Both systems**

- **Every tagging call times out**: you're on `qwen3-vl:4b`, the "thinking" variant, which ignores `think: false` when a JSON schema is set. Use `qwen3-vl:4b-instruct`.
- **"AI offline" in the shop header**: Ollama isn't running (macOS: `ollama serve`; Windows: open the Ollama app).
- **The first request after a break is slow**: Neon pauses idle databases, and waking takes a second or two.
- **Changed `EMBED_MODEL`**: set `EMBED_DIM` to match, then migrate a fresh database and re-run `enrich --force`.
- **"Port already in use"**: something else is on 4000, 5173 or 5433. Stop it, or change `PORT` in `.env` / the port in `docker-compose.yml`.

**Windows**

- **`npm` or `ollama` is "not recognized"**: open a new terminal after installing, or sign out and back in.
- **PowerShell says "running scripts is disabled"**: run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use **Command Prompt** instead.
- **Docker says "WSL 2 installation is incomplete"**: run `wsl --install` in an admin PowerShell, restart, then open Docker Desktop.
- **`npm run db:up` fails**: Docker Desktop must be open and show "Engine running" before you run it.
- **AI tagging is very slow**: without an NVIDIA GPU, Ollama runs on the CPU. Tag a small sample with `npm run enrich -- --limit 50` first, or use `--concurrency 1`.

## Status

Working: catalog import and tagging, outfit engine, demo shop, WhatsApp preview and chat. Next: Shopify app install (Admin API + order webhook), live WhatsApp sending, A/B test reporting on AOV, and per-brand onboarding.

The demo catalog is a brand's public product feed, for private pitches only; don't publish it.

## License

[MIT](LICENSE)
