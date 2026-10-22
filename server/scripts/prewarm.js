// Usage: npm run prewarm -- [--category shirt] [--limit 12]
// Generates and caches looks for every occasion, so a live demo never waits on the LLM.
import { parseArgs } from 'node:util';
import { pool } from '../src/db.js';
import { getLooks } from '../src/engine/outfits.js';
import { OCCASION_KEYS } from '../src/engine/occasions.js';

const { values: args } = parseArgs({
  options: {
    category: { type: 'string', default: 'shirt' },
    limit: { type: 'string', default: '12' },
  },
});

// Same order as the shop's product grid, so the first products people see are warm.
const { rows } = await pool.query(
  `SELECT id::text, title FROM products WHERE in_stock AND category = $1 ORDER BY id DESC LIMIT $2`,
  [args.category, Number(args.limit)]);

const started = Date.now();
let done = 0;
for (const p of rows) {
  for (const occasion of OCCASION_KEYS) {
    const res = await getLooks(p.id, { occasion });
    done++;
    process.stdout.write(`\r  ${done}/${rows.length * OCCASION_KEYS.length}  ${res.cached ? 'cached' : res.copySource}   `);
  }
}
console.log(`\nWarmed ${done} looks for ${rows.length} ${args.category} products in ${Math.round((Date.now() - started) / 1000)}s.`);
await pool.end();
