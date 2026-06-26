// Headless poster renderer.
// Drives the running app via ?gen=<payload>, then captures the composite
// canvas (which is a 2D canvas, so toDataURL is reliable) to PNG and/or MP4.
//
// Usage:
//   1. Start the app:   npm run dev        (or: npm run build && npm start)
//   2. Render:
//      node scripts/render-poster.mjs \
//        --event '{"title":"Listening Session","dj":"GOOD BOY","dateText":"SAT 13 JUN","timeText":"ALL NIGHT","venue":"Contra, Seoul","slogan":"Every Object is a Universe in Itself."}' \
//        --format feed --style auto --video --seconds 6 --out ./out
//
// Requires: puppeteer (npm i -D puppeteer), ffmpeg on PATH (for --video).

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const url = arg('url', 'http://localhost:3000');
const out = arg('out', './out');
const format = arg('format', 'feed');
const style = arg('style', 'auto');
const wantVideo = !!arg('video', false);
const seconds = Number(arg('seconds', 6));
const fps = Number(arg('fps', 30));
const eventJson = arg('event', '{"title":"Listening Session","dj":"GOOD BOY","dateText":"SAT 13 JUN","timeText":"ALL NIGHT","slogan":"Every Object is a Universe in Itself."}');
const name = String(arg('name', 'poster'));

const event = JSON.parse(eventJson);
const payload = Buffer.from(JSON.stringify({ event, style, format }), 'utf8').toString('base64');
const target = `${url}/?gen=${payload}`;

const dataUrlToBuffer = (d) => Buffer.from(d.split(',')[1], 'base64');

async function main() {
  const { default: puppeteer } = await import('puppeteer');
  await mkdir(out, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl',
      '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--no-sandbox',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 1 });
  await page.goto(target, { waitUntil: 'networkidle2', timeout: 60000 });

  // Wait for the poster to be generated + 3D/fonts ready.
  await page.waitForFunction('window.__POSTER_READY__ === true', { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 400));

  const grab = () => page.evaluate(() => {
    const c = document.querySelector('canvas');
    return c ? c.toDataURL('image/png') : null;
  });

  // PNG
  const png = await grab();
  if (png) {
    const file = path.join(out, `${name}.png`);
    await writeFile(file, dataUrlToBuffer(png));
    console.log('PNG  →', file);
  }

  // Video (frames → ffmpeg)
  if (wantVideo) {
    const framesDir = path.join(out, '_frames');
    await mkdir(framesDir, { recursive: true });
    const total = Math.round(seconds * fps);
    const interval = 1000 / fps;
    for (let i = 0; i < total; i++) {
      const t0 = Date.now();
      const d = await grab();
      if (d) await writeFile(path.join(framesDir, `f${String(i).padStart(4, '0')}.png`), dataUrlToBuffer(d));
      const wait = interval - (Date.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
    const mp4 = path.join(out, `${name}.mp4`);
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-y', '-framerate', String(fps), '-i', path.join(framesDir, 'f%04d.png'),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4,
      ], { stdio: 'inherit' });
      ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited ' + code))));
    });
    await rm(framesDir, { recursive: true, force: true });
    console.log('MP4  →', mp4);
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
