import { config } from '../src/config.js';
import { pool } from '../src/db.js';
import { schema } from '../src/schema.js';

await pool.query(schema(config.embedDim));
console.log(`Schema ready (embedding dim ${config.embedDim}) on ${new URL(config.databaseUrl).host}`);
await pool.end();
