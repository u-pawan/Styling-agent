import pg from 'pg';
import pgvector from 'pgvector/pg';
import { config } from './config.js';

// Neon needs TLS; local docker Postgres does not. We verify the certificate ourselves
// (Neon's is publicly trusted), so sslmode is dropped from the URL to avoid pg's alias warning.
const url = new URL(config.databaseUrl);
const needsSsl = url.searchParams.get('sslmode') === 'require' || url.hostname.endsWith('neon.tech');
url.searchParams.delete('sslmode');

// Vectors are only written (as '[..]' text) and compared inside SQL, so no type registration is needed.
export const pool = new pg.Pool({
  connectionString: url.toString(),
  ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
  max: 10,
});

export const query = (text, params) => pool.query(text, params);

export const toVector = (arr) => (arr ? pgvector.toSql(arr) : null);
