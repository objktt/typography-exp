import { jsonrepair } from 'jsonrepair';
import type { PosterState, Layer, EngineType, BlendMode, ControlParam, ModSource, ParamModulation } from './types';
import { engineRegistry, getDefaultParams } from './engine-registry';

// ---------------------------------------------------------------------------
// PosterSpec — the AI-generation wire format.
// Claude can't emit free-form param objects under strict structured outputs
// (every object needs a closed schema), so layer params travel as {key, value}
// entries and are merged over each engine's defaults here. The engine registry
// is server-safe (engines import p5 as types only), so both the doc builder
// and the converter can run inside a route handler.
// ---------------------------------------------------------------------------

export interface SpecParamEntry {
  key: string;
  value: string | number | boolean;
}

export interface SpecModEntry {
  param: string;
  source: ModSource;
  amount: number;
  speed?: number;
}

export interface LayerSpec {
  name: string;
  engineType: EngineType;
  opacity: number;
  blendMode: BlendMode;
  /** Claude structured outputs emit {key,value} entries; prompt-JSON providers emit a plain object. */
  params: SpecParamEntry[] | Record<string, string | number | boolean>;
  modulations: SpecModEntry[];
}

export interface PosterSpec {
  canvasRatio: string;
  backgroundColor: string;
  layers: LayerSpec[];
}

export const CANVAS_RATIOS = ['1:1', '4:5', '9:16', '16:9', '4:3', '3:4'] as const;

const BLEND_MODES: BlendMode[] = [
  'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion',
];

const MOD_SOURCE_VALUES: ModSource[] = ['audioLevel', 'audioBass', 'audioTreble', 'mouseX', 'mouseY', 'lfo'];

/** Strict JSON schema for structured outputs (additionalProperties: false throughout). */
export const POSTER_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['canvasRatio', 'backgroundColor', 'layers'],
  properties: {
    canvasRatio: { type: 'string', enum: [...CANVAS_RATIOS] },
    backgroundColor: { type: 'string', description: 'Canvas background as #rrggbb hex' },
    layers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'engineType', 'opacity', 'blendMode', 'params', 'modulations'],
        properties: {
          name: { type: 'string' },
          engineType: { type: 'string', enum: Object.keys(engineRegistry) },
          opacity: { type: 'number', description: '0..1' },
          blendMode: { type: 'string', enum: BLEND_MODES },
          params: {
            type: 'array',
            description: 'Only params that differ from the engine defaults',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['key', 'value'],
              properties: {
                key: { type: 'string' },
                value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
              },
            },
          },
          modulations: {
            type: 'array',
            description: 'Live-input bindings for numeric params (empty array if none)',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['param', 'source', 'amount', 'speed'],
              properties: {
                param: { type: 'string', description: 'Numeric param key of this engine' },
                source: { type: 'string', enum: MOD_SOURCE_VALUES },
                amount: { type: 'number', description: '-1..1, fraction of the param range' },
                speed: { type: 'number', description: 'LFO Hz; use 0.25 for non-lfo sources (ignored)' },
              },
            },
          },
        },
      },
    },
  },
} as const;

// --- Engine documentation for the model --------------------------------------

const ENGINE_DESCRIPTIONS: Record<EngineType, string> = {
  rastr: 'Halftone/pattern raster grid. Renders text (source: text) or the full canvas (source: fill) as a grid of shapes. A low-opacity "fill" layer makes a great background texture; a "text" layer makes bold pattern typography. loopSpeed animates the pattern.',
  textr: 'Kinetic typography — rows of repeated scrolling text with wave/noise motion. Great as an animated typographic texture or marquee hero. Motion is central to this engine.',
  dither: 'Large typographic dither — text rendered through 1-bit ordered/error-diffusion dithering. Bold experimental hero type. foregroundColor paints the TEXT, backgroundColor the surrounding field; set transparentBg true to keep only the dithered text (for layering over other layers). Anchor with posX/posY (text center) and ALWAYS set fitWidth on wide headlines.',
  'img-dither': 'An uploaded image processed with dithering. ONLY use when the brief supplies an image URL; otherwise skip this engine.',
  object3d: 'WebGL 3D hero object — extruded text (1–3 ASCII characters look best), a geometric primitive, or a GLB model, with material/lighting/motion and optional dither post-processing. Usually the visual centerpiece.',
  label: 'Static typographic block with precise layout control (posX/posY are 0..1 canvas fractions, align/vAlign anchor the block). Use for headlines, kickers, date/time/venue info lines, slogans, and credits. Supports multi-line text via \\n. Set dither: true for an experimental dithered treatment of the text itself (ditherType/ditherPixel/ditherThreshold; field stays transparent).',
  logo: 'Places the brand logo image (default /logo.svg, tintable). Small, anchored to a corner.',
  lottie: 'Plays a Lottie/Bodymovin JSON vector animation as a layer, synced to the studio timeline. ONLY use when the brief supplies a Lottie JSON URL (lottieSource); otherwise skip this engine.',
  custom: [
    'Freeform generative layer — you write the visual as JavaScript in the `code` param. The code is the BODY of `function (ctx, w, h, t, k)`:',
    'ctx = CanvasRenderingContext2D (the layer is pre-cleared each frame; transparent where you do not paint), w/h = canvas px, t = seconds elapsed (animate with it!),',
    'k = live knobs the user can tweak: k.a k.b k.c k.d (numbers 0..1), k.color1 k.color2 (hex strings), k.text (string).',
    'Wire your key visual constants to the knobs so the design stays adjustable. Plain Canvas2D only — no DOM, network, p5, or external libs; no async.',
    'Use this when the fixed engines cannot express the brief (particle fields, flow lines, generative geometry, custom gradients, unusual type treatments).',
  ].join(' '),
};

/** Params the model must never set (file uploads / external asset sources). */
const EXCLUDED_PARAM_KEYS = new Set(['imageSource', 'modelSource', 'lottieSource']);

function paramLine(p: ControlParam): string | null {
  if (p.type === 'file' || EXCLUDED_PARAM_KEYS.has(p.key)) return null;
  const bits: string[] = [`${p.key} (${p.type})`];
  if (p.type === 'select' && p.options) bits.push(`one of: ${p.options.map((o) => o.value).join(' | ')}`);
  if (p.type === 'number' && p.min !== undefined && p.max !== undefined) bits.push(`range ${p.min}..${p.max}`);
  const def = JSON.stringify(p.default);
  bits.push(`default: ${def.length > 60 ? `${def.slice(0, 60)}…"` : def}`);
  return `  - ${bits.join(', ')}`;
}

/** Human/model-readable catalogue of every engine and its tunable params. */
export function buildEngineDoc(): string {
  return (Object.keys(engineRegistry) as EngineType[])
    .map((type) => {
      const entry = engineRegistry[type];
      const lines = entry.params.map(paramLine).filter(Boolean).join('\n');
      return `### ${type} ("${entry.label}")\n${ENGINE_DESCRIPTIONS[type]}\nParams:\n${lines}`;
    })
    .join('\n\n');
}

/**
 * Pull the JSON object out of a possibly chatty / fenced model response —
 * needed for providers without structured outputs (e.g. GLM via the
 * Anthropic-compatible endpoint), which may wrap the JSON in markdown fences
 * or lead with prose.
 */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) throw new SyntaxError('no JSON object in model response');
  return body.slice(start, end + 1);
}

/**
 * Parse a model response into a PosterSpec: extract the JSON, parse strictly,
 * and fall back to jsonrepair for recoverable damage (trailing commas,
 * unescaped newlines in code strings, fences). Throws SyntaxError when the
 * output is beyond repair — callers should retry the generation.
 */
export function parseSpecText(text: string): PosterSpec {
  const raw = extractJson(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = JSON.parse(jsonrepair(raw)); // may still throw — caller retries
  }
  const spec = parsed as PosterSpec;
  if (!spec || !Array.isArray(spec.layers)) throw new SyntaxError('spec has no layers array');
  return spec;
}

/**
 * Compact output-format contract for providers without structured outputs.
 * Uses a plain params object (not {key,value} entries) — far less repetitive,
 * which measurably reduces malformed-JSON glitches from smaller models.
 */
export function buildFormatDoc(): string {
  return `{
  "canvasRatio": ${CANVAS_RATIOS.map((r) => `"${r}"`).join(' | ')},
  "backgroundColor": "#rrggbb",
  "layers": [
    {
      "name": "string",
      "engineType": ${Object.keys(engineRegistry).map((k) => `"${k}"`).join(' | ')},
      "opacity": 0..1,
      "blendMode": ${BLEND_MODES.map((b) => `"${b}"`).join(' | ')},
      "params": { "<paramKey>": <value> },
      "modulations": [ { "param": "<numeric paramKey>", "source": "${MOD_SOURCE_VALUES.join('" | "')}", "amount": -1..1, "speed": <Hz, lfo only> } ]
    }
  ]
}
Rules: params contains ONLY keys that differ from the engine defaults, as a plain JSON object. modulations is [] when unused. All strings must be valid single-line JSON strings — escape newlines as \\n (especially in custom-engine code).`;
}

/**
 * Full model-facing system prompt for poster generation. Shared by the
 * /api/generate route and batch scripts (e.g. template seeding). Pass
 * `promptJson: true` for providers without structured outputs — it appends
 * the compact output-format contract.
 */
export function buildSystemPrompt(opts?: { promptJson?: boolean }): string {
  const base = `You are the design engine of "antlii", a layer-based motion-poster studio. You translate a creative brief into a finished poster design, expressed as JSON layers the studio renders live on an HTML canvas.

## Canvas model
- The canvas base size is 900px: 1:1 → 900×900, 4:5 → 900×1125, 9:16 → 900×1600, 16:9 → 1600×900, 4:3 → 1200×900, 3:4 → 900×1200. Pixel params (fontSize, cellSize, size…) are in these units.
- Params named posX/posY (and other 0..1 params like maxWidth, scale) are fractions of the canvas width/height.
- Layers render bottom-to-top in array order: first = background, last = foreground. backgroundColor paints the canvas behind everything.
- The poster typeface is "Google Sans Flex" (variable, weights 100–900). Engines animate while playing; parameters like loopSpeed/speed/motionSpeed control motion.

## Engines
${buildEngineDoc()}

## Design guidance
- Keep critical text inside a safe margin of ~6% from every edge. For 9:16 story posters keep top 14%, bottom 20% and right 13% clear (Instagram UI chrome).
- TEXT SIZING — you cannot measure text, so protect against overflow: on every label that must span a width, set fitWidth (fraction of canvas width the widest line may occupy; the engine auto-shrinks the font to fit). For huge full-bleed headlines use fitWidth ~0.88 with a generous fontSize; estimate fontSize ≈ (fitWidth × canvasWidth × 1.55) / characterCount for uppercase weight 900.
- LAYOUT HYGIENE: reserve clear bands for text — don't place labels on top of busy graphic areas; leave breathing room between the hero and the info block; align label anchors to a consistent grid (posX 0.06 / 0.5 / 0.94).
- A strong poster is usually: optional low-opacity texture layer (rastr fill) → one dominant hero visual (object3d, dither, rastr text or textr) → 3–6 label layers building a clear typographic hierarchy (kicker, headline, info lines, slogan, small credits) → optionally the logo layer in a corner.
- Commit to a cohesive palette (2–4 colors) with strong contrast against backgroundColor. Uppercase labels read Swiss-modern; mix weights (900 headline vs 400–600 info) for hierarchy.
- object3d shape "text" extrudes 1–3 ASCII characters best (e.g. initials); use a primitive (torusKnot etc.) for abstract heroes or non-Latin briefs.
- Reach for the custom code engine when the brief calls for visuals the fixed engines can't produce — write tight, purposeful Canvas2D code, animate with t, and wire its main constants to the k.a–k.d knobs so the user can tune it live. Prefer fixed engines when they suffice.
- In params, include ONLY the keys you want to differ from the engine defaults. Never invent param keys. Never set image/model/file source params.
- Subtle motion is good by default; make it bolder only when the brief asks for energy.
- Reactivity: each layer's "modulations" can bind a numeric param to a live input — audioLevel/audioBass/audioTreble (mic, 0..1), mouseX/mouseY (0..1), or lfo (-1..1 sine at speed Hz). Effective value = clamp(base + signal × amount × paramRange). Add bindings when the brief asks for audio-reactive, interactive, or breathing visuals (custom-engine knobs a–d and object3d/rastr size params are great targets; amounts around 0.2–0.5). Otherwise leave modulations as [].
- Follow the brief's language, mood and content faithfully — put the brief's actual text content (names, dates, taglines) into label layers verbatim where given.`;

  if (!opts?.promptJson) return base;
  return `${base}

## Output format (strict)
Respond with ONLY one JSON object — no markdown fences, no commentary before or after. Format:
${buildFormatDoc()}`;
}

// --- Spec → PosterState -------------------------------------------------------

let specCounter = 0;

/** Materialize an AI-generated spec into a loadable PosterState (defaults + overrides). */
export function specToPosterState(spec: PosterSpec): PosterState {
  const layers: Layer[] = spec.layers
    .filter((l) => l.engineType in engineRegistry)
    .map((l) => {
      const params = getDefaultParams(l.engineType);
      const entries: SpecParamEntry[] = Array.isArray(l.params)
        ? l.params
        : Object.entries(l.params ?? {}).map(([key, value]) => ({ key, value }));
      for (const { key, value } of entries) {
        if (EXCLUDED_PARAM_KEYS.has(key)) continue;
        // Models sometimes double-escape newlines in text values ("A\\nB"
        // arrives as a literal backslash-n). Repair for display strings; the
        // `code` param is real JS where "\n" literals must survive.
        params[key] = typeof value === 'string' && key !== 'code'
          ? value.replace(/\\n/g, '\n')
          : value;
      }

      // Keep only bindings that target a real numeric range param of this engine.
      const defs = engineRegistry[l.engineType].params;
      const modulations: Record<string, ParamModulation> = {};
      for (const m of l.modulations ?? []) {
        const def = defs.find((d) => d.key === m.param);
        if (!def || def.type !== 'number' || def.min === undefined || def.max === undefined) continue;
        if (!MOD_SOURCE_VALUES.includes(m.source)) continue;
        modulations[m.param] = {
          source: m.source,
          amount: Math.min(1, Math.max(-1, m.amount ?? 0.3)),
          ...(m.source === 'lfo' ? { speed: Math.min(8, Math.max(0.02, m.speed || 0.25)) } : {}),
        };
      }

      const layer: Layer = {
        id: `ai-${++specCounter}-${Date.now().toString(36)}`,
        name: l.name || engineRegistry[l.engineType].defaultName,
        engineType: l.engineType,
        visible: true,
        opacity: Math.min(1, Math.max(0, l.opacity ?? 1)),
        blendMode: BLEND_MODES.includes(l.blendMode) ? l.blendMode : 'source-over',
        params,
      };
      if (Object.keys(modulations).length > 0) layer.modulations = modulations;
      return layer;
    });

  return {
    canvasRatio: (CANVAS_RATIOS as readonly string[]).includes(spec.canvasRatio) ? spec.canvasRatio : '4:5',
    backgroundColor: spec.backgroundColor || '#1a1a1a',
    layers,
    selectedLayerId: layers.length ? layers[layers.length - 1].id : null,
  };
}
