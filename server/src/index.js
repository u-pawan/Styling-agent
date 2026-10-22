import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { api, webhooks } from './routes.js';
import { COLLAGE_DIR } from './whatsapp/collage.js';

const app = express();
app.use(cors({ origin: config.shopUrl }));
app.use(express.json({ limit: '1mb' }));

app.use('/collages', express.static(COLLAGE_DIR, { maxAge: '7d' }));
app.use('/api', api);
app.use('/webhooks', webhooks);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(config.port, () => {
  console.log(`Styling agent API on ${config.publicUrl} (store: ${config.storeName})`);
});
