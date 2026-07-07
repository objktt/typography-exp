// Seed the cloud template library with AI-generated starter designs.
//
// Generates one original poster per concept brief below (concepts inspired by
// common generative-typography patterns), validates each result (spec parses,
// custom-engine code compiles), and upserts it into the Neon templates table —
// so they appear in the studio's Templates panel immediately.
//
// Usage:  npx tsx scripts/seed-templates.mts            # all concepts
//         npx tsx scripts/seed-templates.mts "Fan Type" # only matching names
//
// Env (.env.local): ANTHROPIC_API_KEY (+ ANTHROPIC_BASE_URL / POSTER_MODEL
// for GLM) and DATABASE_URL.

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { neon } from '@neondatabase/serverless';
import { buildSystemPrompt, parseSpecText, specToPosterState } from '../src/lib/poster-spec';
import type { PosterState } from '../src/lib/types';

// --- env ---------------------------------------------------------------------

const env: Record<string, string> = { ...process.env as Record<string, string> };
const envFile = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && !env[m[1]]) env[m[1]] = m[2];
  }
}
const MODEL = env.POSTER_MODEL || 'claude-opus-4-8';
const IS_CLAUDE = MODEL.startsWith('claude');
if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
if (!env.DATABASE_URL) throw new Error('DATABASE_URL missing');

// --- concept briefs ------------------------------------------------------------

// Precise art direction matters: name the palette in hex, position every text
// block, keep graphics out of text bands, and demand fitWidth on wide lines.
const RULES = 'Composition rules: every label spanning a width must set fitWidth. Keep graphic layers out of the text bands stated below. All colors exactly as given.';

const CONCEPTS: { name: string; brief: string }[] = [
  { name: 'Fan Type', brief: `Editorial poster on warm cream #f2ede3. Custom code hero: the letter "A" (weight 900, ~520px, color #17150f) drawn 9 times fanning around a pivot at (0.18w, 0.86h), rotations 0°..64° spread on knob a, older copies at lower alpha. Text band = top 18%: kicker "TYPE STUDY — 01" in #c33d1a at posY 0.06, headline "FAN" weight 900 fitWidth 0.5 at posY 0.09. ${RULES}` },
  { name: 'Warp Rows', brief: `Kinetic type on paper white #f4f2ec. Textr engine: word "MOTION" repeated rows, ink #191919, gentle sine wave, medium density, slow. Bottom band clear (bottom 14%): small info block at posX 0.06 posY 0.94 ("MOTION STUDIES / SERIES 02" two lines, 16px, weight 600). ${RULES}` },
  { name: 'Cell Cluster', brief: `Deep navy #0c1830 canvas. Custom code: FIRST build const seeds = [...Array(22)].map((_,i)=>({x,y,r,hue})) using seeded pseudorandom from i (e.g. Math.sin(i*127.1)*43758.5453 % 1) — never read undefined arrays; then draw each cell as a soft blob: filled circle radius r 40–110px in pastels (#9db8e8, #e8b8c8, #b8e8d0 alternating), 0.85 alpha, subtle outline; cells pulse ±6% with lfo on knob a. Keep cells inside the middle 70% vertically. Text: headline "ORGANISM" weight 200 tracking 0.3 fitWidth 0.8 centered posY 0.9 in #ffffff; kicker "SPECIMEN 07" 15px #9db8e8 centered posY 0.06. ${RULES}` },
  { name: 'Word Stack', brief: `Acid yellow #e8f000 canvas, ink #101010. Four label layers, each fitWidth 0.88, posX 0.06 align left, weight alternating 900/100/900/100: "DESIGN" posY 0.07, "IS" posY 0.29, "NEVER" posY 0.51, "DONE" posY 0.73 — fontSize 230 each (fitWidth protects). Tiny credits "STUDIO — EST. 2024 — TYPE SPECIMEN" 12px weight 500 posX 0.06 posY 0.965. Nothing else. ${RULES}` },
  { name: 'Elastic Grid', brief: `Charcoal #1c1c1e canvas. Custom code: 8×10 grid of single letters cycling "ELASTIC" (weight 700, #ece9e2, base 52px) centered in cells; each letter's scale = 1 + 0.9 * falloff from a focal point at (k.a*w, k.b*h), falloff = Math.max(0, 1 - dist/(w*0.35)). Bind knob a to mouseX amount 1 and knob b to mouseY amount 1. Grid occupies middle 78%; bottom band: label "ELASTIC — INTERACTIVE SPECIMEN" 15px #8e8b84 posX 0.06 posY 0.95. ${RULES}` },
  { name: 'Ring Type', brief: `Black #0a0a0a canvas. Custom code: 4 concentric text rings centered at (0.5w, 0.46h), radii 130/210/290/370, each ring = uppercase phrase "ORBIT SYSTEM — " repeated around the circle (ctx.rotate per character), colors alternating #d8d8d8/#7a7a7a, rings rotate at different speeds with t, speed scaled by knob a; solid #e2231a circle radius 26 at the exact center. Bottom band clear: label "REVOLUTIONS PER MINUTE" 15px tracking 0.25 centered posY 0.93 #d8d8d8. ${RULES}` },
  { name: 'Gradient Grid', brief: `Near-black plum #17131c canvas. Custom code: 6×6 grid of rounded rectangles (corner radius 14) filling top 76% of canvas with 10px gaps and 40px outer margin; each tile filled with a vertical two-stop gradient interpolating between #f2a06e (peach) and #6e5ae0 (violet) by a per-tile phase (i+j)/12 shifted slowly by t*0.05. Bottom band (bottom 20%) completely clear of tiles: headline "SOFT SYSTEMS" weight 200 tracking 0.12 fitWidth 0.8 posX 0.06 posY 0.85 #f5f2ff, caption "COLOR FIELD / 36 UNITS" 14px #8d84b8 posX 0.06 posY 0.93. ${RULES}` },
  { name: 'Dancing Type', brief: `Black #050505 canvas. Textr engine hero: word "DANCE" electric blue #2e62ff, bold, strong wave amplitude, fast scroll, dense rows filling the full canvas; bind amplitude to audioLevel amount 0.4. Top-left kicker "MOVEMENT 04" 15px #2e62ff posY 0.05 posX 0.06. ${RULES}` },
  { name: 'Stamp Scatter', brief: `Manila paper #e6d8b8 canvas. Custom code: 12 rubber stamps — words "APPROVED" (red #c0392b) and "VOID" (ink #262626) alternating — each drawn rotated -25°..25° at scattered positions in the middle 70% of canvas, double rounded-rect border + bold uppercase text, slightly transparent (0.85) with per-stamp seeded jitter; sizes 120–200px wide. Top band: headline "BUREAUCRACY" weight 900 fitWidth 0.88 posX 0.06 posY 0.05 in #262626. Bottom: caption "FORM 27B/6 — STAMPED IN TRIPLICATE" 13px posX 0.06 posY 0.955. ${RULES}` },
  { name: 'Vanishing Point', brief: `Light gray #e8e6e2 canvas. Custom code: one-point perspective — from vanishing point at (0.5w, 0.34h) draw 40 thin #1a1a1a lines (0.75px, alpha 0.35) radiating to points along the bottom and side edges; add 8 horizontal "ground" lines below the horizon with perspective spacing. Headline band ABOVE horizon kept clear: "DEPTH" weight 900 fitWidth 0.88 centered posX 0.5 posY 0.13 color #e85510 (label layer on top of lines is fine — lines are thin). Small labels: "01 — TYPOGRAPHIC SPACE" 14px posX 0.06 posY 0.05; two-line caption bottom-left 13px posY 0.93. Logo top-right. ${RULES}` },
  { name: 'Poster Shuffle', brief: `Off-white #efece6 canvas. Custom code: 7 large solid rectangles (min 200×260px) in palette #e2231a/#1b48c2/#f0b400/#111111/#e8e2d4, each rotated -14°..14°, overlapping around canvas center within the middle 72%, each with a hard 10px offset shadow rgba(0,0,0,0.18); slow drift with lfo on knob a. Headline punched across the middle: "SHUFFLE" weight 900 fitWidth 0.88 centered posX 0.5 posY 0.44 in #ffffff (on top). Corners: kicker top-left 14px, credits bottom-right 12px in #111111. ${RULES}` },
  { name: 'Pill Stripes', brief: `Cream #f3e9dc canvas. Custom code: 9 full-width horizontal capsule bars (height 7.5% each, rounded ends, 2% gaps) alternating #d43d2a and #f3e9dc with 1.5px #d43d2a outline on the cream ones, sliding horizontally ±30px with slow lfo phase offset per bar (knob a = speed). Headline "RHYTHM" weight 900 fitWidth 0.82 centered posX 0.5 posY 0.42 in #f3e9dc with blendMode difference so it reverses out of the bars. Bottom caption 13px centered posY 0.955 #7a2a1e. ${RULES}` },
  { name: 'Sharp Type', brief: `Black #000 canvas. Dither engine hero: word "SHARP" white on black, bayer8, fontSize sized to span ~86% width (about 250px), centered vertically at 0.42. Spec-sheet labels in #ffffff, 12–13px weight 500 tracking 0.2: top-left "FILE / 001 BRUTALIST TYPO" posY 0.04, top-right "REV. 04 — 2024" align right posX 0.94 posY 0.04, bottom-left three lines "TYPESETTING\nDITHER / BAYER-8\n2PX MATRIX" posY 0.9, bottom-right three lines align right posY 0.9. All labels fitWidth 0.4. ${RULES}` },
  { name: 'Corner Fan', brief: `Bone white #f0ede6 canvas. Custom code: fan of 16 thin wedges (1.5–3px stroke #1e4d38, alternate filled #1e4d38 at 0.08 alpha) radiating from the EXACT top-right corner (w, 0) sweeping 90° into the canvas, lengths ~85% of diagonal; wedge count on knob a (8–24). Bottom-left text block kept clear: headline "ARC" weight 900 fitWidth 0.42 posX 0.06 posY 0.72 #1e4d38, caption "SIXTEEN SEGMENTS / 90°" 14px posY 0.87, credits 12px posY 0.95. ${RULES}` },
  { name: 'Circle Collage', brief: `Off-black #101014 canvas. Custom code: 11 translucent circles radius 70–240px in #b9a8e8 (lavender), #59c2b8 (teal), #e88a7a (coral), globalCompositeOperation "screen", alpha 0.5, drifting ±20px on slow lfo per-circle phase (knob a = drift amount); keep circle centers inside middle 68% vertically. Headline "ORBIT" weight 200 tracking 0.35 fitWidth 0.66 centered posX 0.5 posY 0.885 #ffffff; kicker "OVERLAY STUDY" 14px centered posY 0.055 #8f8a9e. ${RULES}` },
  // --- SWISS series: International-Typographic-Style grids × bold type × experimental dithering ---
  { name: 'Swiss Grid 01', brief: `Paper white #f4f2ed canvas, strict Swiss grid. Dither engine hero: word "RASTER" ink #111111 on transparent (transparentBg true), ditherType bayer8, pixelSize 3, colorMode duotone fg #111111 bg #f4f2ed, fontSize ~240 spanning the middle, vertically centered at 0.4. Red structural bar: custom code draws ONE solid #e2231a rectangle from (0.06w, 0.62h) to (0.62w, 0.66h), nothing else. Labels weight 500, #111111: "Internationale Ausstellung" 20px posX 0.06 posY 0.68, "für Typografie und Raster" 20px posX 0.06 posY 0.71, date block "12.—28. Juni" weight 900 26px posX 0.06 posY 0.78, page mark "01" weight 900 40px align right posX 0.94 posY 0.05. All fitWidth 0.5. No other decoration. ${RULES}` },
  { name: 'Swiss Diagonal', brief: `Ink black #111111 canvas. Custom code: one bold diagonal band — a #e2231a parallelogram stripe ~18% tall rotated -18° crossing the full canvas centered at 0.45h. Dither hero ON TOP: word "AKZIDENZ" white #f4f2ed transparentBg true, ditherType fs, pixelSize 2, fontSize ~180, centered posY 0.42 — the dithered edges should visibly break up against the red band. Labels #f4f2ed weight 500 16px: "Schweizer Plakat" posX 0.06 posY 0.06; "Serie 03 — Typografie" posX 0.06 posY 0.09; bottom-right credits 12px align right posX 0.94 posY 0.95. fitWidth on all. ${RULES}` },
  { name: 'Swiss Halftone', brief: `Warm white #f2efe8 canvas. Dither hero: single giant numeral "5" ditherType halftone, pixelSize 6, ditherScale 2, colorMode duotone fg #111111, transparentBg true, fontSize ~700, positioned right-heavy (centered around x 0.62), filling most of the height — halftone dots must read clearly as texture. Bind threshold to lfo amount 0.15 speed 0.1 (slow breathing). Left column kept clear: kicker "FESTIVAL" weight 900 34px #e2231a posX 0.06 posY 0.06; five program lines 15px weight 500 #111111 starting posY 0.13 spaced 0.03 ("20.00 Eröffnung" style German/Swiss program entries); bottom "Halle 5 — Basel" weight 700 20px posX 0.06 posY 0.92. All fitWidth 0.4. ${RULES}` },
  { name: 'Swiss Scale', brief: `Paper #f4f2ed canvas. The word "SKALA" three times as three separate dither layers, all transparentBg true, colorMode duotone fg #111111, left-aligned posX 0.06: (1) fontSize ~300 ditherType bayer2 pixelSize 8 posY 0.08 — coarse and broken; (2) fontSize ~150 ditherType bayer4 pixelSize 4 posY 0.42 — medium; (3) fontSize ~75 ditherType bayer8 pixelSize 2 posY 0.62 — fine. Shows the dither matrix scaling as typographic experiment. Red dot: custom code, one #e2231a filled circle radius 34 at (0.85w, 0.12h). Caption 14px weight 500 #111 posX 0.06 posY 0.94: "Bayer-Matrix 2/4/8 — Massstabstudie", credits align right posX 0.94 posY 0.94 12px. ${RULES}` },
  { name: 'Swiss Column', brief: `White #f7f5f0 canvas, rigorous 4-column editorial grid. Custom code: draw 3 thin vertical #cfcbc2 rules at x = 0.29w, 0.52w, 0.75w from y 0.3h to 0.88h. Dither hero: giant numeral "4" ditherType ordered4 pixelSize 4 fg #1a1a1a transparentBg true fontSize ~560 anchored left (centered x ~0.2, y ~0.55). Top band: headline "VIER SPALTEN" weight 900 fitWidth 0.88 posX 0.06 posY 0.05 #1a1a1a; red rule: custom code also draws #e2231a rectangle (0.06w..0.94w, y 0.16h, 6px tall). Three text columns 12px weight 500 #333 lineHeight 1.5, each a 5-line lorem-style German column, posY 0.32, posX 0.31/0.54/0.77, maxWidth 0.2. ${RULES}` },
  { name: 'Swiss Puls', brief: `Black #0d0d0d canvas, experimental. Dither hero: word "PULS" white transparentBg true, ditherType bayer4, pixelSize 5, fontSize ~260, centered posY 0.38; bind pixelSize to audioBass amount 0.5 and threshold to audioLevel amount 0.3 — the dither matrix visibly pumps with music. Rastr texture underneath: source fill, cellSize 60, shapeType line, strokeWeight 1, firstColor #2a2a2a, solid, opacity 0.5. Labels #f4f2ed: "Elektronische Musik" 16px posX 0.06 posY 0.06; "Klub Bern — Samstag 23.00" 16px posX 0.06 posY 0.9; red accent square: custom code one #e2231a filled square 46×46 at (0.88w, 0.86h). fitWidth on all labels. ${RULES}` },
  { name: 'Swiss Fragment', brief: `Paper #f3f0e9 canvas. Experimental fragmented headline: custom code draws the word "BRUCH" (ctx.font = "900 220px sans-serif", fillText) THREE times overlapping at (0.5w, 0.45h) with horizontal slice clipping — for each of ~14 horizontal slices (ctx.save/beginPath/rect clip) shift x by seeded jitter ±(6+k.a*30)px alternating #111111 and #e2231a copies offset 4px — a glitched/sliced Swiss headline. Slow lfo on knob a amount 0.2 speed 0.15. Clear bands: kicker "Typografische Monatsblätter" 15px weight 500 #111 posX 0.06 posY 0.06; "Nr. 11 — Bruchstücke" 15px posX 0.06 posY 0.09; bottom credits 12px posX 0.06 posY 0.95. ${RULES}` },
  { name: 'Swiss Ordnung', brief: `Two-tone split canvas: custom code fills left 38% with solid #e2231a, rest stays #f4f2ed (canvas bg #f4f2ed). Dither hero crossing the split: word "ORDNUNG" ditherType fs pixelSize 3 colorMode duotone fg #111111 transparentBg true, fontSize ~170, centered posY 0.44 — Floyd–Steinberg noise breaks the hard edge. Left column (on red, white text): "Gestaltung" weight 900 24px #f4f2ed posX 0.05 posY 0.07; "und Chaos" weight 200 24px posX 0.05 posY 0.11. Right column (on paper, ink text): four 13px meta lines align right posX 0.94 starting posY 0.07 spacing 0.03. Bottom center: "Museum für Gestaltung — Zürich" 15px weight 700 #111 centered posY 0.93. fitWidth everywhere. ${RULES}` },
  { name: 'Test Chart', brief: `Pure white #ffffff canvas, clinical print-calibration aesthetic. Custom code: crosshair registration marks (circle + cross, #111, 1px) at all four corners at 6% inset; a horizontal strip of 8 solid swatches (#00aeef,#ec008c,#fff200,#111111,#e2231a,#1b48c2,#00a651,#f7941d) each ~9% wide × 7% tall at posY 0.62; fine 1px #ddd grid rules across the middle third; one large #111 circle outline radius 90 at (0.72w, 0.3h). Labels 12px mono-feel weight 500 #111: "PRINT TEST CHART — DO NOT PRINT" posX 0.06 posY 0.05 (fitWidth 0.6), "CMYK REGISTRATION ±0.1mm" posX 0.06 posY 0.72, "DENSITY 1.8 / PAPER 130gsm" posX 0.06 posY 0.76, credits centered posY 0.96. ${RULES}` },
];

// --- generation ----------------------------------------------------------------

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, timeout: 240_000 });
const sql = neon(env.DATABASE_URL);
const SYSTEM = buildSystemPrompt({ promptJson: !IS_CLAUDE });

// Universal stub that absorbs any Canvas2D API usage (method chains, gradient
// objects, measureText().width in arithmetic, …) so custom code can be
// smoke-executed without a browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function anyProxy(): any {
  const fn = () => anyProxy();
  return new Proxy(fn, {
    get: (_t, p) => (p === Symbol.toPrimitive ? () => 0 : anyProxy()),
    apply: () => anyProxy(),
    set: () => true,
  });
}

function validate(state: PosterState): string | null {
  if (state.layers.length === 0) return 'no layers';
  for (const l of state.layers) {
    if (l.engineType === 'custom') {
      try {
        const sketch = new Function('ctx', 'w', 'h', 't', 'k', String(l.params.code));
        // Execute a few frames — catches runtime crashes, not just syntax.
        for (const t of [0, 1, 2.5]) {
          sketch(anyProxy(), 900, 1125, t, { a: 0.5, b: 0.5, c: 0.5, d: 0.5, color1: '#fff', color2: '#000', text: 'X' });
        }
      } catch (e) {
        return `custom code crashes (${(e as Error).message})`;
      }
    }
  }
  return null;
}

async function generateOne(name: string, brief: string): Promise<PosterState> {
  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Design a poster template for this brief (canvas ratio 4:5 unless the brief implies otherwise):\n\n${brief}` }],
    });
    const text = response.content.find((b) => b.type === 'text')?.text ?? '';
    try {
      const state = specToPosterState(parseSpecText(text));
      const problem = validate(state);
      if (problem) throw new SyntaxError(problem);
      return state;
    } catch (e) {
      lastErr = (e as Error).message;
      console.log(`  ${name}: attempt ${attempt} failed (${lastErr})`);
    }
  }
  throw new Error(`${name}: failed after 3 attempts — ${lastErr}`);
}

async function main() {
  const filter = process.argv[2]?.toLowerCase();
  const targets = filter ? CONCEPTS.filter((c) => c.name.toLowerCase().includes(filter)) : CONCEPTS;
  console.log(`Seeding ${targets.length} templates via ${MODEL}…`);

  const results: { name: string; ok: boolean; detail: string }[] = [];
  const queue = [...targets];
  const workers = Array.from({ length: 4 }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        const state = await generateOne(c.name, c.brief);
        await sql`
          INSERT INTO templates (name, state, layer_count)
          VALUES (${c.name}, ${JSON.stringify(state)}::jsonb, ${state.layers.length})
          ON CONFLICT (name) DO UPDATE
            SET state = EXCLUDED.state, layer_count = EXCLUDED.layer_count, updated_at = now()
        `;
        const summary = state.layers.map((l) => l.engineType + (l.modulations ? '*' : '')).join(',');
        results.push({ name: c.name, ok: true, detail: `${state.layers.length} layers (${summary})` });
        console.log(`✓ ${c.name} — ${state.layers.length} layers`);
      } catch (e) {
        results.push({ name: c.name, ok: false, detail: (e as Error).message });
        console.log(`✗ ${c.name} — ${(e as Error).message}`);
      }
    }
  });
  await Promise.all(workers);

  const ok = results.filter((r) => r.ok);
  console.log(`\nDone: ${ok.length}/${results.length} templates seeded.`);
  for (const r of results.filter((x) => !x.ok)) console.log(`  failed: ${r.name} — ${r.detail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
