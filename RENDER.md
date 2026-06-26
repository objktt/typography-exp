# Headless rendering (full automation)

The app can be driven without the UI so a script (or the weekly cron) can render
posters to **PNG** and **MP4** automatically.

## How it works

1. The page reads a `?gen=` query param — base64 JSON of `{ event, style?, format? }`.
   It auto-builds the poster (same generator as ✨ Generate), plays it, then sets
   `window.__POSTER_READY__ = true`.
2. `scripts/render-poster.mjs` (Puppeteer) opens that URL, waits for the ready
   flag, and captures the **composite canvas** via `toDataURL` (the main canvas is
   2D, so this is reliable and full-resolution). Frames → `ffmpeg` → MP4.

## One-time setup

```bash
npm i -D puppeteer            # already in devDependencies
npx puppeteer browsers install chrome   # downloads Chromium (~150MB)
# ffmpeg must be on PATH (brew install ffmpeg)
```

## Render

```bash
# 1. start the app
npm run dev          # or: npm run build && npm start

# 2. render PNG (+ optional MP4)
node scripts/render-poster.mjs \
  --event '{"title":"Listening Session","dj":"GOOD BOY","dateText":"SAT 13 JUN","timeText":"ALL NIGHT","venue":"Objktt","slogan":"Every Object is a Universe in Itself."}' \
  --format feed --style auto --video --seconds 6 --out ./out --name good-boy
```

Flags: `--url` (default http://localhost:3000), `--format` feed|story,
`--style` auto|swiss-red|noir|blueprint|newsprint, `--video`, `--seconds`,
`--fps`, `--out`, `--name`.

## Wiring the weekly cron to render

The scheduled task `objktt-weekly-poster-scan` already scans the calendar and
builds a spec per event. To make it render too, have it (with the app running):
for each detected event, base64-encode `{event, style:'auto', format:'feed'}` and
run `scripts/render-poster.mjs` with that payload, then deliver the files.
Headless WebGL needs the SwiftShader flags already set in the script.
