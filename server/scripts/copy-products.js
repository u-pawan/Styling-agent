// Usage: npm run copy-products -- [--from postgres://...]
// Copies products (tags + embeddings included) from another database into DATABASE_URL,
// e.g. local docker -> Neon, so a catalog never has to be re-tagged.
import { parseArgs } from 'node:util';
import pg from 'pg';
import { pool } from '../src/db.js';

const { values: args } = parseArgs({
  options: { from: { type: 'string', default: 'postgres://styling:styling@localhost:5433/styling' } },
});

const source = new pg.Pool({ connectionString: args.from });
const { rows } = await source.query('SELECT * FROM products ORDER BY id');
await source.end();
console.log(`Read ${rows.length} products from ${new URL(args.from).host}`);

// One round trip per chunk: Postgres turns the JSON back into rows (text '[..]' -> vector, arrays -> text[]).
const CHUNK = 100;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  await pool.query(
    `INSERT INTO products SELECT * FROM json_populate_recordset(NULL::products, $1)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, tags = EXCLUDED.tags, image_url = EXCLUDED.image_url, images = EXCLUDED.images,
       price = EXCLUDED.price, compare_at_price = EXCLUDED.compare_at_price, sizes = EXCLUDED.sizes,
       in_stock = EXCLUDED.in_stock, category = EXCLUDED.category, slot = EXCLUDED.slot, color = EXCLUDED.color,
       color_family = EXCLUDED.color_family, pattern = EXCLUDED.pattern, fit = EXCLUDED.fit, fabric = EXCLUDED.fabric,
       formality = EXCLUDED.formality, occasions = EXCLUDED.occasions, style_note = EXCLUDED.style_note,
       ai_tagged_at = EXCLUDED.ai_tagged_at, embedding = EXCLUDED.embedding, updated_at = now()`,
    [JSON.stringify(chunk)]);
  process.stdout.write(`\r  ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
}
await pool.query('DELETE FROM looks_cache');
const { rows: [n] } = await pool.query(
  'SELECT count(*)::int AS total, count(ai_tagged_at)::int AS tagged, count(embedding)::int AS embedded FROM products');
console.log(`\nTarget now has ${n.total} products (${n.tagged} AI-tagged, ${n.embedded} embedded).`);
await pool.end();
