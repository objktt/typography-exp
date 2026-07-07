// Render thumbnails for cloud templates via the live app (headless Chrome).
//
// For each template (all, or only those missing a thumb with --missing, or a
// name filter), opens /?t=<id>&key=<RENDER_SECRET> — the proxy validates the
// key and AuthGate lets the studio mount — waits for the engines/fonts to
// settle, captures the composite canvas downscaled, and writes the data URL
// to templates.thumb. Optionally dumps PNGs for visual review with --out DIR.
//
// Usage:
//   npm run dev                                    # app must be running
//   npx tsx scripts/render-thumbs.mts              # all templates
//   npx tsx scripts/render-thumbs.mts --missing    # only templates without a thumb
//   npx tsx scripts/render-thumbs.mts "fan"        # name filter
//   npx tsx scripts/render-thumbs.mts --out ./out/thumbs   # also save PNG files
//
// Env (.env.local): DATABASE_URL, RENDER_SECRET. Flags: --url (default
// http://localhost:3000), --width (default 360).

import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const env: Record<string, string> = { ...process.env as Record<string, string> };
const envFile = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && !env[m[1]]) env[m[1]] = m[2];
  }
}
if (!env.DATABASE_URL) throw new Error('DATABASE_URL missing');
if (!env.RENDER_SECRET) throw new Error('RENDER_SECRET missing');

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}
const BASE_URL = flag('url') ?? 'http://localhost:3000';
const WIDTH = Number(flag('width') ?? 360);
const OUT_DIR = flag('out');
const MISSING_ONLY = args.includes('--missing');
const nameFilter = args.find((a) => !a.startsWith('--') && a !== flag('url') && a !== flag('width') && a !== flag('out'))?.toLowerCase();

const sql = neon(env.DATABASE_URL);

async function main() {
  const { default: puppeteer } = await import('puppeteer');

  let rows = await sql`SELECT id, name, thumb IS NULL AS missing FROM templates ORDER BY name`;
  if (MISSING_ONLY) rows = rows.filter((r) => r.missing);
  if (nameFilter) rows = rows.filter((r) => String(r.name).toLowerCase().includes(nameFilter));
  console.log(`Rendering ${rows.length} thumbnails via ${BASE_URL}…`);
  if (OUT_DIR) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl',
      '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--no-sandbox',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 1 });

  let ok = 0;
  for (const row of rows) {
    const url = `${BASE_URL}/?t=${row.id}&key=${encodeURIComponent(env.RENDER_SECRET)}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
      await page.waitForSelector('canvas', { timeout: 30_000 });
      // Let the template fetch, engine setup, fonts and first frames settle.
      await page.evaluate(() => (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready);
      await new Promise((r) => setTimeout(r, 3500));

      const dataUrl = await page.evaluate((maxW: number) => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
        if (!canvas || canvas.width === 0) return null;
        const w = Math.min(maxW, canvas.width);
        const h = Math.round(w * (canvas.height / canvas.width));
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        off.getContext('2d')!.drawImage(canvas, 0, 0, w, h);
        try { return off.toDataURL('image/webp', 0.82); } catch { return off.toDataURL('image/jpeg', 0.82); }
      }, WIDTH);

      if (!dataUrl) throw new Error('canvas not found or empty');
      await sql`UPDATE templates SET thumb = ${dataUrl} WHERE id = ${row.id}`;
      if (OUT_DIR) {
        const png = await page.evaluate(() => (document.querySelector('canvas') as HTMLCanvasElement).toDataURL('image/png'));
        fs.writeFileSync(path.join(OUT_DIR, `${String(row.name).replace(/[^a-z0-9-]+/gi, '_')}.png`), Buffer.from(png.split(',')[1], 'base64'));
      }
      ok++;
      console.log(`✓ ${row.name} (${Math.round(dataUrl.length / 1024)}KB)`);
    } catch (e) {
      console.log(`✗ ${row.name} — ${(e as Error).message}`);
    }
  }

  await browser.close();
  console.log(`\nDone: ${ok}/${rows.length} thumbnails written.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
