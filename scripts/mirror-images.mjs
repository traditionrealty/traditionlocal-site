// Downloads every image still hosted on Wix into public/media and records the mapping,
// so the site keeps working after the Wix plan is cancelled.
// Run with:  npm run mirror-images   (or the "Mirror images from Wix" GitHub Action)
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const images = JSON.parse(await fs.readFile(path.join(root, 'src/data/images.json'), 'utf8'));
const site = JSON.parse(await fs.readFile(path.join(root, 'src/data/site.json'), 'utf8'));
const areas = JSON.parse(await fs.readFile(path.join(root, 'src/data/areas.json'), 'utf8'));
const mapFile = path.join(root, 'src/data/image-map.json');
const map = JSON.parse(await fs.readFile(mapFile, 'utf8').catch(() => '{}'));
const outDir = path.join(root, 'public/media');
await fs.mkdir(outDir, { recursive: true });

const all = [...new Set([...images, site.logo, ...site.sponsors, ...areas.map((a) => a.hero)].filter((u) => u && u.includes('wixstatic')))];
let done = 0, skipped = 0, failed = 0;
const queue = all.filter((u) => !map[u] || (skipped++, false));

async function grab(u) {
  const file = decodeURIComponent(u.split('/').pop()).replace(/[^\w.~-]/g, '_');
  // Ask Wix for a web sized copy (max 1600px wide) instead of the original upload
  const src = /\.(jpe?g|png|webp)$/i.test(file) ? `${u}/v1/fit/w_1600,h_1600,q_85/${file}` : u;
  for (const tryUrl of [src, u]) {
    try {
      const r = await fetch(tryUrl);
      if (!r.ok) continue;
      await fs.writeFile(path.join(outDir, file), Buffer.from(await r.arrayBuffer()));
      map[u] = `/media/${file}`; done++; return;
    } catch {}
  }
  failed++; console.warn('failed', u);
}
for (let i = 0; i < queue.length; i += 8) await Promise.all(queue.slice(i, i + 8).map(grab));
await fs.writeFile(mapFile, JSON.stringify(map, null, 1));
console.log(`mirrored ${done}, already had ${skipped}, failed ${failed}`);
