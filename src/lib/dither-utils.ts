// Shared dither utilities — single source of truth for both dither-engine and img-dither-engine
// Two-stage pipeline: computeMask() → colorize()

export const bayer2x2 = [
  [0, 2],
  [3, 1]
];

export const bayer4x4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

export const bayer8x8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21]
];

export const ordered4x4 = [
  [1, 9, 3, 11],
  [13, 5, 15, 7],
  [4, 12, 2, 10],
  [16, 8, 14, 6]
];

// --- Helpers ---

const hexCache = new Map<string, { r: number; g: number; b: number }>();

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cached = hexCache.get(hex);
  if (cached) return cached;
  const h = hex.replace('#', '');
  const result = {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
  hexCache.set(hex, result);
  return result;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function toGrayBuffer(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  contrast: number,
  brightness: number,
  saturation: number,
): Float32Array {
  const len = width * height;
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    const r = data[idx] / 255;
    const g = data[idx + 1] / 255;
    const b = data[idx + 2] / 255;
    let gray = r * 0.299 + g * 0.587 + b * 0.114;
    // Apply saturation (desaturate toward gray when < 1, boost when > 1)
    // For mask computation, saturation affects how much color variance maps to luminance
    if (saturation !== 1) {
      gray = lerp(gray, gray, saturation); // luminance doesn't change, but we keep the param for colorize
    }
    // Apply contrast + brightness
    gray = (gray - 0.5) * contrast + 0.5 + brightness;
    buf[i] = Math.max(0, Math.min(1, gray));
  }
  return buf;
}

function posterizeGrayBuffer(buf: Float32Array, levels: number): void {
  if (levels >= 256) return;
  const step = 1 / (levels - 1);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.round(buf[i] / step) * step;
  }
}

// --- Stage 1: Mask computation ---

function bayerMask(
  gray: Float32Array,
  w: number,
  h: number,
  matrix: number[][],
  size: number,
  threshold: number,
  ditherScale: number,
): Uint8Array {
  const mask = new Uint8Array(w * h);
  const maxVal = size * size;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const sx = Math.floor(x / ditherScale) % size;
      const sy = Math.floor(y / ditherScale) % size;
      const bayerValue = matrix[sy][sx] / maxVal;
      mask[i] = gray[i] > bayerValue + threshold - 0.5 ? 255 : 0;
    }
  }
  return mask;
}

function fsMask(
  gray: Float32Array,
  w: number,
  h: number,
  threshold: number,
): Uint8Array {
  const mask = new Uint8Array(w * h);
  const err = new Float32Array(gray); // working copy

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const oldVal = err[i];
      const newVal = oldVal < threshold ? 0 : 1;
      mask[i] = newVal * 255;
      const quantError = oldVal - newVal;

      if (x + 1 < w) err[i + 1] += quantError * (7 / 16);
      if (y + 1 < h) {
        if (x > 0) err[(y + 1) * w + (x - 1)] += quantError * (3 / 16);
        err[(y + 1) * w + x] += quantError * (5 / 16);
        if (x + 1 < w) err[(y + 1) * w + (x + 1)] += quantError * (1 / 16);
      }
    }
  }
  return mask;
}

function halftoneMask(
  gray: Float32Array,
  w: number,
  h: number,
  ditherScale: number,
  isLine: boolean,
): Uint8Array {
  const mask = new Uint8Array(w * h);
  const dotSize = Math.max(2, Math.round(4 * ditherScale));

  for (let y = 0; y < h; y += dotSize) {
    for (let x = 0; x < w; x += dotSize) {
      const cx = Math.min(x + dotSize / 2, w - 1);
      const cy = Math.min(y + dotSize / 2, h - 1);
      const grayVal = gray[Math.floor(cy) * w + Math.floor(cx)];
      const radius = grayVal * dotSize / 2;

      for (let dy = 0; dy < dotSize && y + dy < h; dy++) {
        for (let dx = 0; dx < dotSize && x + dx < w; dx++) {
          const pi = (y + dy) * w + (x + dx);
          if (isLine) {
            const centerX = dotSize / 2;
            const dist = Math.abs(dx - centerX);
            mask[pi] = dist < (grayVal * dotSize) / 2 ? 255 : 0;
          } else {
            const centerX = dotSize / 2;
            const centerY = dotSize / 2;
            const dist = Math.sqrt((dx - centerX) ** 2 + (dy - centerY) ** 2);
            mask[pi] = dist < radius ? 255 : 0;
          }
        }
      }
    }
  }
  return mask;
}

function computeMask(
  imageData: ImageData,
  w: number,
  h: number,
  params: {
    ditherType: string;
    threshold: number;
    contrast: number;
    brightness: number;
    ditherScale: number;
    posterization: number;
    saturation: number;
  },
): Uint8Array {
  const gray = toGrayBuffer(imageData.data, w, h, params.contrast, params.brightness, params.saturation);
  posterizeGrayBuffer(gray, params.posterization);

  const scale = Math.max(1, Math.round(params.ditherScale));

  switch (params.ditherType) {
    case 'bayer2':
      return bayerMask(gray, w, h, bayer2x2, 2, params.threshold, scale);
    case 'bayer4':
      return bayerMask(gray, w, h, bayer4x4, 4, params.threshold, scale);
    case 'bayer8':
      return bayerMask(gray, w, h, bayer8x8, 8, params.threshold, scale);
    case 'ordered4':
      return bayerMask(gray, w, h, ordered4x4, 4, params.threshold, scale);
    case 'fs':
      return fsMask(gray, w, h, params.threshold);
    case 'halftone':
      return halftoneMask(gray, w, h, scale, false);
    case 'halftoneLine':
      return halftoneMask(gray, w, h, scale, true);
    default: {
      // Fallback: threshold-based mask
      const mask = new Uint8Array(w * h);
      for (let i = 0; i < mask.length; i++) mask[i] = gray[i] > params.threshold ? 255 : 0;
      return mask;
    }
  }
}

// --- Stage 2: Colorize ---

function colorize(
  imageData: ImageData,
  mask: Uint8Array,
  w: number,
  h: number,
  params: {
    colorMode: string;
    foregroundColor: string;
    backgroundColor: string;
    invert: boolean;
    saturation: number;
    transparentBg?: boolean;
  },
): Uint8ClampedArray {
  const srcData = imageData.data;
  const len = w * h;
  const output = new Uint8ClampedArray(len * 4);
  const fg = hexToRgb(params.foregroundColor);
  const bg = hexToRgb(params.backgroundColor);
  const sat = params.saturation;
  const mode = params.colorMode || 'duotone';
  const transparentBg = !!params.transparentBg;

  for (let i = 0; i < len; i++) {
    const isOn = params.invert ? mask[i] === 0 : mask[i] !== 0;
    const oi = i * 4;

    if (mode === 'original') {
      if (isOn) {
        const si = i * 4;
        let r = srcData[si];
        let g = srcData[si + 1];
        let b = srcData[si + 2];
        // Apply saturation to source colors
        if (sat !== 1) {
          const gray = r * 0.299 + g * 0.587 + b * 0.114;
          r = Math.max(0, Math.min(255, lerp(gray, r, sat)));
          g = Math.max(0, Math.min(255, lerp(gray, g, sat)));
          b = Math.max(0, Math.min(255, lerp(gray, b, sat)));
        }
        output[oi] = r;
        output[oi + 1] = g;
        output[oi + 2] = b;
      } else {
        output[oi] = bg.r;
        output[oi + 1] = bg.g;
        output[oi + 2] = bg.b;
      }
    } else if (mode === 'grayscale') {
      const si = i * 4;
      const lum = (srcData[si] * 0.299 + srcData[si + 1] * 0.587 + srcData[si + 2] * 0.114) / 255;
      if (isOn) {
        output[oi] = lerp(bg.r, fg.r, lum);
        output[oi + 1] = lerp(bg.g, fg.g, lum);
        output[oi + 2] = lerp(bg.b, fg.b, lum);
      } else {
        output[oi] = bg.r;
        output[oi + 1] = bg.g;
        output[oi + 2] = bg.b;
      }
    } else {
      // duotone (default)
      if (isOn) {
        output[oi] = fg.r;
        output[oi + 1] = fg.g;
        output[oi + 2] = fg.b;
      } else {
        output[oi] = bg.r;
        output[oi + 1] = bg.g;
        output[oi + 2] = bg.b;
      }
    }
    // "Off" pixels become transparent when transparentBg is on (overlay GIFs).
    output[oi + 3] = (!isOn && transparentBg) ? 0 : 255;
  }

  return output;
}

// --- Main entry point ---

export function applyDither(
  imageData: ImageData,
  width: number,
  height: number,
  params: {
    ditherType: string;
    threshold: number;
    contrast: number;
    brightness: number;
    invert: boolean;
    foregroundColor: string;
    backgroundColor: string;
    colorMode?: string;
    ditherScale?: number;
    posterization?: number;
    saturation?: number;
    transparentBg?: boolean;
  },
): Uint8ClampedArray {
  const fullParams = {
    ...params,
    colorMode: params.colorMode || 'duotone',
    ditherScale: params.ditherScale ?? 1,
    posterization: params.posterization ?? 256,
    saturation: params.saturation ?? 1,
    transparentBg: params.transparentBg ?? false,
  };

  const mask = computeMask(imageData, width, height, fullParams);
  return colorize(imageData, mask, width, height, fullParams);
}

// --- Reusable temp canvas (avoids per-frame allocation) ---

let _ditherRenderCanvas: HTMLCanvasElement | null = null;

export function renderDitheredPixels(
  pg: { drawingContext: CanvasRenderingContext2D; width: number; height: number },
  ditheredData: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  pixelSize: number
): void {
  if (!_ditherRenderCanvas) _ditherRenderCanvas = document.createElement('canvas');
  const tmp = _ditherRenderCanvas;
  tmp.width = srcWidth;
  tmp.height = srcHeight;
  const tmpCtx = tmp.getContext('2d')!;

  const imgData = tmpCtx.createImageData(srcWidth, srcHeight);

  if (pixelSize === 1) {
    imgData.data.set(ditheredData);
  } else {
    for (let y = 0; y < srcHeight; y += pixelSize) {
      for (let x = 0; x < srcWidth; x += pixelSize) {
        const si = (y * srcWidth + x) * 4;
        const r = ditheredData[si];
        const g = ditheredData[si + 1];
        const b = ditheredData[si + 2];
        const a = ditheredData[si + 3]; // preserve alpha (transparent BG)

        for (let py = 0; py < pixelSize && y + py < srcHeight; py++) {
          for (let px = 0; px < pixelSize && x + px < srcWidth; px++) {
            const di = ((y + py) * srcWidth + (x + px)) * 4;
            imgData.data[di] = r;
            imgData.data[di + 1] = g;
            imgData.data[di + 2] = b;
            imgData.data[di + 3] = a;
          }
        }
      }
    }
  }

  tmpCtx.putImageData(imgData, 0, 0);

  const ctx = pg.drawingContext;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, pg.width, pg.height);
  ctx.restore();
}

// --- Pixel-size-correct dithering ---
// Dither at a REDUCED resolution (1 dither dot per `pixelSize` screen pixels),
// then upscale nearest-neighbour. This is the right way to do chunky pixels —
// sampling a full-res dither pattern just yields noise.
let _smallSrcCanvas: HTMLCanvasElement | null = null;

export function renderDitherDownscaled(
  pg: { drawingContext: CanvasRenderingContext2D; width: number; height: number },
  sourceCanvas: HTMLCanvasElement,
  w: number,
  h: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  pixelSize: number,
): void {
  const ps = Math.max(1, Math.round(pixelSize));
  const sw = Math.max(1, Math.round(w / ps));
  const sh = Math.max(1, Math.round(h / ps));

  if (!_smallSrcCanvas) _smallSrcCanvas = document.createElement('canvas');
  const sc = _smallSrcCanvas;
  sc.width = sw;
  sc.height = sh;
  const sctx = sc.getContext('2d', { willReadFrequently: true })!;
  sctx.clearRect(0, 0, sw, sh);
  sctx.imageSmoothingEnabled = true;        // average each block on downscale
  sctx.drawImage(sourceCanvas, 0, 0, sw, sh);

  const id = sctx.getImageData(0, 0, sw, sh); // throws if tainted (CORS) — caller handles
  const dithered = applyDither(id, sw, sh, params);
  // Keep fully-transparent source pixels transparent (letterbox / no image).
  const src = id.data;
  for (let i = 0; i < sw * sh; i++) {
    if (src[i * 4 + 3] === 0) dithered[i * 4 + 3] = 0;
  }
  id.data.set(dithered);
  sctx.putImageData(id, 0, 0);

  const ctx = pg.drawingContext;
  ctx.save();
  ctx.imageSmoothingEnabled = false;        // crisp upscale
  ctx.drawImage(sc, 0, 0, pg.width, pg.height);
  ctx.restore();
}

// --- Presets ---

export interface DitherPreset {
  name: string;
  ditherType: string;
  foregroundColor: string;
  backgroundColor: string;
  threshold: number;
  pixelSize: number;
  invert: boolean;
  contrast: number;
  brightness: number;
  colorMode: string;
  ditherScale: number;
  posterization: number;
  saturation: number;
}

export const ditherPresets: Record<string, DitherPreset> = {
  // --- Original color presets ---
  bayer16Original: {
    name: 'Bayer 16 Original',
    ditherType: 'bayer4',
    foregroundColor: '#ffffff',
    backgroundColor: '#000000',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1.1,
    brightness: 0,
    colorMode: 'original',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  halftoneCMYKOriginal: {
    name: 'Halftone CMYK',
    ditherType: 'halftone',
    foregroundColor: '#ffffff',
    backgroundColor: '#000000',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1.2,
    brightness: 0,
    colorMode: 'original',
    ditherScale: 1,
    posterization: 256,
    saturation: 1.2,
  },
  fsOriginal: {
    name: 'FS Original',
    ditherType: 'fs',
    foregroundColor: '#ffffff',
    backgroundColor: '#000000',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1,
    brightness: 0,
    colorMode: 'original',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  retroGaming: {
    name: 'Retro Gaming',
    ditherType: 'bayer2',
    foregroundColor: '#ffffff',
    backgroundColor: '#000000',
    threshold: 0.5,
    pixelSize: 2,
    invert: false,
    contrast: 1.3,
    brightness: 0.05,
    colorMode: 'original',
    ditherScale: 2,
    posterization: 8,
    saturation: 1.4,
  },
  noise16: {
    name: 'Noise 16',
    ditherType: 'bayer8',
    foregroundColor: '#ffffff',
    backgroundColor: '#111111',
    threshold: 0.45,
    pixelSize: 1,
    invert: false,
    contrast: 1,
    brightness: 0,
    colorMode: 'original',
    ditherScale: 1,
    posterization: 16,
    saturation: 0.8,
  },

  // --- Duotone presets ---
  newsprint: {
    name: 'Newsprint',
    ditherType: 'halftone',
    foregroundColor: '#000000',
    backgroundColor: '#ffffff',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1.2,
    brightness: 0,
    colorMode: 'duotone',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  retro: {
    name: 'Retro Game',
    ditherType: 'bayer4',
    foregroundColor: '#00ff00',
    backgroundColor: '#000000',
    threshold: 0.5,
    pixelSize: 2,
    invert: false,
    contrast: 1,
    brightness: 0,
    colorMode: 'duotone',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  dotMatrix: {
    name: 'Dot Matrix',
    ditherType: 'ordered4',
    foregroundColor: '#ffffff',
    backgroundColor: '#001144',
    threshold: 0.45,
    pixelSize: 1,
    invert: false,
    contrast: 1.5,
    brightness: 0.1,
    colorMode: 'duotone',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  newspaper: {
    name: 'Newspaper',
    ditherType: 'bayer8',
    foregroundColor: '#1a1a1a',
    backgroundColor: '#f5f5dc',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1.3,
    brightness: 0,
    colorMode: 'duotone',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  ascii: {
    name: 'ASCII Terminal',
    ditherType: 'bayer2',
    foregroundColor: '#33ff33',
    backgroundColor: '#000000',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1,
    brightness: 0,
    colorMode: 'duotone',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  glitch: {
    name: 'Glitch',
    ditherType: 'fs',
    foregroundColor: '#ff00ff',
    backgroundColor: '#000033',
    threshold: 0.4,
    pixelSize: 1,
    invert: true,
    contrast: 1.5,
    brightness: 0,
    colorMode: 'duotone',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  minimal: {
    name: 'Minimal',
    ditherType: 'bayer4',
    foregroundColor: '#ffffff',
    backgroundColor: '#000000',
    threshold: 0.5,
    pixelSize: 3,
    invert: false,
    contrast: 1,
    brightness: 0,
    colorMode: 'duotone',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  halftoneNeon: {
    name: 'Halftone Neon',
    ditherType: 'halftone',
    foregroundColor: '#ff00cc',
    backgroundColor: '#0a0020',
    threshold: 0.45,
    pixelSize: 1,
    invert: false,
    contrast: 1.4,
    brightness: 0,
    colorMode: 'duotone',
    ditherScale: 2,
    posterization: 256,
    saturation: 1,
  },
  halftoneCandy: {
    name: 'Halftone Candy',
    ditherType: 'halftone',
    foregroundColor: '#ff6699',
    backgroundColor: '#ffe4f0',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1.1,
    brightness: 0.05,
    colorMode: 'duotone',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  fineChecker: {
    name: 'Fine Checker',
    ditherType: 'bayer2',
    foregroundColor: '#222222',
    backgroundColor: '#eeeeee',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1.2,
    brightness: 0,
    colorMode: 'duotone',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },

  // --- Grayscale presets ---
  bayer4Fine: {
    name: 'Bayer 4 Fine',
    ditherType: 'bayer4',
    foregroundColor: '#ffffff',
    backgroundColor: '#000000',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1,
    brightness: 0,
    colorMode: 'grayscale',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  halftoneCMYKGrad: {
    name: 'Halftone Gradient',
    ditherType: 'halftone',
    foregroundColor: '#ffffff',
    backgroundColor: '#000000',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1.1,
    brightness: 0,
    colorMode: 'grayscale',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  diagonalContrast: {
    name: 'Diagonal Contrast',
    ditherType: 'ordered4',
    foregroundColor: '#ffffff',
    backgroundColor: '#111111',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1.6,
    brightness: 0,
    colorMode: 'grayscale',
    ditherScale: 1,
    posterization: 256,
    saturation: 1,
  },
  gridGradient: {
    name: 'Grid Gradient',
    ditherType: 'bayer8',
    foregroundColor: '#dddddd',
    backgroundColor: '#222222',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1,
    brightness: 0,
    colorMode: 'grayscale',
    ditherScale: 2,
    posterization: 256,
    saturation: 1,
  },
  posterize: {
    name: 'Posterize',
    ditherType: 'bayer4',
    foregroundColor: '#ffffff',
    backgroundColor: '#000000',
    threshold: 0.5,
    pixelSize: 1,
    invert: false,
    contrast: 1.2,
    brightness: 0,
    colorMode: 'grayscale',
    ditherScale: 1,
    posterization: 4,
    saturation: 1,
  },
};
