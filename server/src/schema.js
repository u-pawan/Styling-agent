// Works on local Postgres (pgvector image) and on Neon, which ships pgvector.
export const schema = (embedDim) => `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS products (
  id               BIGINT PRIMARY KEY,          -- Shopify product id
  store            TEXT NOT NULL,
  handle           TEXT NOT NULL,
  title            TEXT NOT NULL,
  product_type     TEXT,
  description      TEXT,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  image_url        TEXT,
  images           TEXT[] NOT NULL DEFAULT '{}',
  price            NUMERIC(10,2),
  compare_at_price NUMERIC(10,2),
  sizes            JSONB NOT NULL DEFAULT '[]',  -- [{size, available, variantId}]
  in_stock         BOOLEAN NOT NULL DEFAULT false,

  -- attributes (rules first, AI fills the gaps)
  category         TEXT,
  slot             TEXT,                          -- top | layer | bottom | footwear | accessory | other
  color            TEXT,
  color_family     TEXT,
  pattern          TEXT,
  fit              TEXT,
  fabric           TEXT,
  formality        SMALLINT,                      -- 1 (lounge) .. 5 (formal)
  occasions        TEXT[] NOT NULL DEFAULT '{}',  -- office | casual | date | festive
  style_note       TEXT,
  ai_tagged_at     TIMESTAMPTZ,
  embedding        vector(${embedDim}),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_slot_idx ON products (slot, category) WHERE in_stock;
CREATE INDEX IF NOT EXISTS products_embedding_idx ON products USING hnsw (embedding vector_cosine_ops);

-- Generated looks are cached so repeat views cost nothing.
CREATE TABLE IF NOT EXISTS looks_cache (
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  occasion    TEXT NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, occasion)
);

-- WhatsApp: only customers who opted in get styling messages.
CREATE TABLE IF NOT EXISTS subscribers (
  phone         TEXT PRIMARY KEY,               -- E.164 without +, e.g. 919812345678
  name          TEXT,
  opted_in_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  opted_out_at  TIMESTAMPTZ,
  last_product  BIGINT REFERENCES products(id) ON DELETE SET NULL,
  last_inbound  TIMESTAMPTZ                     -- opens the 24h free-form window
);

CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY,
  phone       TEXT NOT NULL,
  direction   TEXT NOT NULL,                    -- out | in
  kind        TEXT NOT NULL,                    -- styling_template | chat | inbound
  order_ref   TEXT,
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL,                    -- preview | sent | failed | received
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One styling message per order, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS messages_one_per_order
  ON messages (order_ref) WHERE kind = 'styling_template' AND status IN ('sent', 'preview');
`;
