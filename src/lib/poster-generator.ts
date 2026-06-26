/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PosterState, Layer, EngineType } from './types';
import { getDefaultParams } from './engine-registry';

// ---------------------------------------------------------------------------
// Poster Generator — turns a parsed event into a finished Swiss-modern poster.
//   detectEvent()    : is this calendar entry a listening session / party?
//   pickStyle()      : auto-choose a style (weekly variety from a seed)
//   generatePoster() : EventInfo + style -> PosterState (ready to load)
// No audio/video here — purely the calendar -> style -> poster stage.
// ---------------------------------------------------------------------------

export interface EventInfo {
  /** Headline / event name, e.g. "Listening Session". */
  title: string;
  /** Performing DJ / artist (act name), e.g. "Peggy Gou" or "PAPAYA". */
  dj: string;
  /** Member line-up when an act has multiple DJs, e.g. "Hogi & Hender". */
  lineup?: string;
  /** Origin country for an international act, e.g. "Japan". */
  origin?: string;
  /** Human date string already formatted, e.g. "FRI 19 JUN". */
  dateText: string;
  /** Time string, e.g. "22:00 – LATE". */
  timeText: string;
  /** Optional venue / location. */
  venue?: string;
  /** Optional brand slogan / tagline. */
  slogan?: string;
}

export interface DetectedEvent extends EventInfo {
  kind: 'listening' | 'party';
}

const EVENT_KEYWORDS: { kind: DetectedEvent['kind']; rx: RegExp }[] = [
  { kind: 'listening', rx: /listening\s*session|리스닝\s*세션|리스닝/i },
  { kind: 'party', rx: /\bparty\b|파티|\brave\b|\bclub\b|\bb2b\b|\bdj\s*set\b|\bdj\b|\bset\b|\bmix\b/i },
];

/** Try to pull a DJ name out of free text ("w/ X", "feat. X", "DJ X"). */
function extractDj(text: string): string {
  const patterns = [
    /(?:w\/|with|feat\.?|featuring|ft\.?)\s+([A-Za-z0-9 .'&-]{2,40})/i,
    /\bdj\s+([A-Za-z0-9 .'&-]{2,40})/i,
    /[-–—]\s*([A-Za-z0-9 .'&-]{2,40})$/,
  ];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m) return m[1].trim();
  }
  return '';
}

/**
 * Detect whether a calendar event is a listening session / party, and parse
 * the basic fields. `dateText` / `timeText` are passed in already-formatted
 * from the calendar's start time (the caller formats them).
 */
export function detectEvent(
  rawTitle: string,
  opts: { description?: string; dateText: string; timeText: string; venue?: string }
): DetectedEvent | null {
  const haystack = `${rawTitle} ${opts.description ?? ''}`;
  const match = EVENT_KEYWORDS.find((k) => k.rx.test(haystack));
  if (!match) return null;

  const dj = extractDj(haystack) || extractDj(rawTitle);
  return {
    kind: match.kind,
    title: rawTitle.trim() || (match.kind === 'listening' ? 'Listening Session' : 'Party'),
    dj: dj || rawTitle.trim(),
    dateText: opts.dateText,
    timeText: opts.timeText,
    venue: opts.venue,
  };
}

// --- Styles ----------------------------------------------------------------

export interface PosterStyle {
  id: string;
  name: string;
  bg: string;
  ink: string;
  accent: string;
  heroFinish: string;   // object3d material
  heroColor: string;
  heroDither: boolean;
  texture: 'none' | 'grid';
}

export const POSTER_STYLES: PosterStyle[] = [
  { id: 'swiss-red', name: 'Swiss Red', bg: '#f3f1ec', ink: '#141414', accent: '#e2231a', heroFinish: 'chrome', heroColor: '#1b1b1b', heroDither: false, texture: 'none' },
  { id: 'noir', name: 'Noir Metal', bg: '#0c0c0c', ink: '#fafafa', accent: '#fafafa', heroFinish: 'metal', heroColor: '#dcdcdc', heroDither: false, texture: 'none' },
  { id: 'blueprint', name: 'Blueprint', bg: '#0a1f44', ink: '#ffffff', accent: '#ffd400', heroFinish: 'satin', heroColor: '#ffd400', heroDither: false, texture: 'grid' },
  { id: 'newsprint', name: 'Newsprint', bg: '#f4f1e6', ink: '#15130f', accent: '#c0392b', heroFinish: 'matte', heroColor: '#15130f', heroDither: true, texture: 'none' },
];

/** Stable hash → pick a style. Use the event title + week for weekly variety. */
export function pickStyle(seed: string): PosterStyle {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return POSTER_STYLES[h % POSTER_STYLES.length];
}

// --- Instagram safe zones --------------------------------------------------
// Insets (fraction of canvas) that Instagram's UI overlays. Labels must stay
// INSIDE these so text is never hidden behind IG chrome.
//   feed  (4:5): the image itself isn't overlaid — small aesthetic margin.
//   story (9:16): top = profile/close, bottom = caption/reply/send,
//                 right = Reels action button column.

export type PosterFormat = 'feed' | 'story';

interface SafeZone { top: number; bottom: number; left: number; right: number; }

export const SAFE_ZONES: Record<PosterFormat, SafeZone> = {
  feed:  { top: 0.06, bottom: 0.07, left: 0.06, right: 0.06 },
  story: { top: 0.14, bottom: 0.20, left: 0.06, right: 0.13 },
};

export const FORMAT_RATIO: Record<PosterFormat, string> = {
  feed: '4:5',
  story: '9:16',
};

const ASCII_RX = /^[\x00-\x7F]+$/;

// --- Helpers ---------------------------------------------------------------

let _gen = 0;
function genId(): string {
  return `gen-${++_gen}-${Date.now().toString(36)}`;
}

function layer(engineType: EngineType, name: string, overrides: Record<string, any>, meta?: Partial<Layer>): Layer {
  return {
    id: genId(),
    name,
    engineType,
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    params: { ...getDefaultParams(engineType), ...overrides },
    ...meta,
  };
}

/** Hero glyph(s): DJ initials (max 2) or first letters of the title. */
function heroText(ev: EventInfo): string {
  const source = ev.dj || ev.title;
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

// --- Generate --------------------------------------------------------------

export function generatePoster(ev: EventInfo, styleId?: string, format: PosterFormat = 'feed'): PosterState {
  const style = styleId ? POSTER_STYLES.find((s) => s.id === styleId) ?? pickStyle(ev.title) : pickStyle(ev.title + ev.dj);
  const layers: Layer[] = [];

  // Instagram-safe layout box: all text is anchored inside these edges so it
  // can never be hidden behind IG's UI chrome.
  const sz = SAFE_ZONES[format];
  const L = sz.left;            // left edge of safe box
  const R = 1 - sz.right;       // right edge
  const T = sz.top;             // top edge
  const B = 1 - sz.bottom;      // bottom edge
  const big = format === 'story' ? 0.9 : 1;   // scale type slightly for tall story

  // 1. Optional faint structural grid (blueprint).
  if (style.texture === 'grid') {
    layers.push(layer('rastr', 'Grid Texture', {
      source: 'fill',
      cellSize: 46,
      shapeType: 'rectangle',
      shapeSizeX: 0.12,
      shapeSizeY: 0.12,
      firstColor: style.ink,
      secondColor: style.ink,
      fillType: 'solid',
      loopSpeed: 0,
    }, { opacity: 0.14 }));
  }

  // 2. 3D hero — extruded initials (Latin), else a primitive so non-Latin
  //    names (e.g. Korean) still get a clean hero instead of missing glyphs.
  const hero = heroText(ev);
  const heroIsText = ASCII_RX.test(hero);
  layers.push(layer('object3d', '3D Hero', {
    shape: heroIsText ? 'text' : 'torusKnot',
    text: hero,
    size: 150,
    depth: 52,
    bevel: 3,
    material: style.heroFinish,
    color: style.heroColor,
    lighting: 'studio',
    intensity: 1.15,
    motion: 'spin',
    speed: 0.4,
    amplitude: 50,
    tilt: -12,
    dither: style.heroDither,
    ditherType: 'bayer8',
    ditherColorMode: 'duotone',
    ditherFg: style.ink,
    ditherBg: style.bg,
    threshold: 0.5,
    ditherScale: 1,
  }));

  // 3. Kicker (event kind) — top of safe box, left.
  layers.push(layer('label', 'Kicker', {
    text: ev.title, color: style.accent, uppercase: true,
    fontSize: 26 * big, weight: '700', tracking: 0.16, lineHeight: 1.1,
    maxWidth: 1 - sz.left - sz.right,
    posX: L, posY: T, align: 'left', vAlign: 'top',
  }));

  // 4. DJ name — just below kicker, dominant flat type (wraps to fit width).
  layers.push(layer('label', 'DJ Name', {
    text: ev.dj, color: style.ink, uppercase: true,
    fontSize: 66 * big, weight: '900', tracking: -0.01, lineHeight: 0.98,
    maxWidth: 1 - sz.left - sz.right,
    posX: L, posY: T + 0.05, align: 'left', vAlign: 'top',
  }));

  // 4b. Sub-name lines under the act name: line-up and/or origin.
  let subY = T + 0.135;
  if (ev.lineup) {
    layers.push(layer('label', 'Line-up', {
      text: ev.lineup, color: style.ink, uppercase: true,
      fontSize: 26 * big, weight: '500', tracking: 0.04, lineHeight: 1.1,
      posX: L, posY: subY, align: 'left', vAlign: 'top',
    }));
    subY += 0.045;
  }
  if (ev.origin) {
    layers.push(layer('label', 'Origin', {
      text: `From ${ev.origin}`, color: style.accent, uppercase: true,
      fontSize: 22 * big, weight: '700', tracking: 0.1, lineHeight: 1.1,
      posX: L, posY: subY, align: 'left', vAlign: 'top',
    }));
  }

  // 5. Brand logo — top-right of safe box, tinted to the ink colour.
  layers.push(layer('logo', 'Logo', {
    logoSource: '/logo.svg',
    tint: true,
    color: style.ink,
    scale: format === 'story' ? 0.26 : 0.2,
    posX: R, posY: T, align: 'right', vAlign: 'top',
  }));

  // 6. Date / time / venue — one multi-line block (snaps to grid as a unit,
  //    even line spacing). Edit all lines in the single text field.
  const info = [ev.dateText, ev.timeText, ev.venue].filter(Boolean).join('\n');
  layers.push(layer('label', 'Date / Time', {
    text: info, color: style.ink, uppercase: true,
    fontSize: 28 * big, weight: '600', tracking: 0.04, lineHeight: 1.5,
    posX: L, posY: B, align: 'left', vAlign: 'bottom',
  }));

  // 7. Slogan / tagline — bottom-right, accent colour, wraps to fit width.
  if (ev.slogan) {
    layers.push(layer('label', 'Slogan', {
      text: ev.slogan, color: style.accent, uppercase: true,
      fontSize: 22 * big, weight: '700', tracking: 0.04, lineHeight: 1.08,
      maxWidth: 0.42,
      posX: R, posY: B, align: 'right', vAlign: 'bottom',
    }));
  }

  // 8. Copyright — very small, centred along the very bottom edge.
  layers.push(layer('label', 'Copyright', {
    text: '© 2026 OBJKTT. All rights reserved.', color: style.ink, uppercase: false,
    fontSize: 11, weight: '400', tracking: 0.04, lineHeight: 1,
    posX: 0.5, posY: 0.986, align: 'center', vAlign: 'bottom',
  }, { opacity: 0.55 }));

  return {
    canvasRatio: FORMAT_RATIO[format],
    backgroundColor: style.bg,
    layers,
    selectedLayerId: layers.length ? layers[layers.length - 1].id : null,
  };
}
