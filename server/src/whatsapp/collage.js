// Builds the outfit image for the WhatsApp header: the bought item large, the matching pieces beside it.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const COLLAGE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/collages');

const W = 1200;
const H = 1200;
const GAP = 16;
const BG = { r: 244, g: 242, b: 238, alpha: 1 };

async function tile(url, width, height) {
  const sized = url.includes('cdn.shopify.com') ? `${url}${url.includes('?') ? '&' : '?'}width=800` : url;
  const res = await fetch(sized, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`image ${res.status}`);
  return sharp(Buffer.from(await res.arrayBuffer()))
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 85 })
    .toBuffer();
}

// Layout: anchor fills the left 60%, up to three pieces stack on the right.
export async function makeCollage(anchorImage, itemImages) {
  const items = itemImages.filter(Boolean).slice(0, 3);
  const key = createHash('sha1').update([anchorImage, ...items].join('|')).digest('hex').slice(0, 16);
  const file = `${key}.jpg`;
  await mkdir(COLLAGE_DIR, { recursive: true });

  const leftW = Math.round(W * 0.6) - GAP * 1.5;
  const rightW = W - leftW - GAP * 3;
  const rows = Math.max(items.length, 1);
  const rowH = Math.floor((H - GAP * (rows + 1)) / rows);

  const layers = [{ input: await tile(anchorImage, leftW, H - GAP * 2), left: GAP, top: GAP }];
  for (let i = 0; i < items.length; i++) {
    layers.push({ input: await tile(items[i], rightW, rowH), left: leftW + GAP * 2, top: GAP + i * (rowH + GAP) });
  }

  await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite(layers)
    .jpeg({ quality: 82 })
    .toFile(path.join(COLLAGE_DIR, file));
  return file;
}
