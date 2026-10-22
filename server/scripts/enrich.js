// Usage: npm run enrich -- [--vision] [--force] [--limit 50] [--concurrency 2]
// Tags untagged products with the local model, then embeds anything missing a vector.
import { parseArgs } from 'node:util';
import { pool, toVector } from '../src/db.js';
import { tagProduct, embedProducts } from '../src/catalog/enrich.js';
import { ollamaReady } from '../src/ollama.js';
import { config } from '../src/config.js';

const { values: args } = parseArgs({
  options: {
    vision: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    limit: { type: 'string', default: '100000' },
    concurrency: { type: 'string', default: '2' },
  },
});

if (!(await ollamaReady())) {
  console.error(`Ollama is not reachable at ${config.ollamaUrl}. Start it with: ollama serve`);
  process.exit(1);
}

const { rows: todo } = await pool.query(
  `SELECT * FROM products WHERE ${args.force ? 'TRUE' : 'ai_tagged_at IS NULL'} AND slot <> 'other'
   ORDER BY slot, category LIMIT $1`, [Number(args.limit)]);

console.log(`Tagging ${todo.length} products with ${config.tagModel}${args.vision ? ' (vision on)' : ''} ...`);
const started = Date.now();
let done = 0;
let failed = 0;

async function worker(queue) {
  while (queue.length) {
    const p = queue.shift();
    try {
      const t = await tagProduct(p, { vision: args.vision });
      await pool.query(
        `UPDATE products SET color=$2, color_family=$3, formality=$4, occasions=$5, style_note=$6,
           ai_tagged_at=now(), embedding=NULL WHERE id=$1`,
        [p.id, t.color, t.color_family, t.formality, t.occasions, t.style_note]);
    } catch (err) {
      failed++;
      console.error(`\n  ! ${p.title}: ${err.message}`);
    }
    done++;
    const rate = (Date.now() - started) / done / 1000;
    process.stdout.write(`\r  ${done}/${todo.length}  ~${rate.toFixed(1)}s each, ${Math.round(rate * (todo.length - done))}s left   `);
  }
}

const queue = [...todo];
await Promise.all(Array.from({ length: Number(args.concurrency) }, () => worker(queue)));
if (todo.length) console.log(`\nTagged ${done - failed}, failed ${failed}.`);

// Embeddings are cheap: batch everything that lacks one.
const { rows: needVec } = await pool.query(`SELECT * FROM products WHERE embedding IS NULL AND slot <> 'other'`);
console.log(`Embedding ${needVec.length} products with ${config.embedModel} ...`);
for (let i = 0; i < needVec.length; i += 32) {
  const batch = needVec.slice(i, i + 32);
  const vectors = await embedProducts(batch);
  for (let j = 0; j < batch.length; j++) {
    await pool.query('UPDATE products SET embedding=$2 WHERE id=$1', [batch[j].id, toVector(vectors[j])]);
  }
  process.stdout.write(`\r  ${Math.min(i + 32, needVec.length)}/${needVec.length}`);
}
await pool.query('DELETE FROM looks_cache');
console.log('\nDone. Looks cache cleared.');
await pool.end();
