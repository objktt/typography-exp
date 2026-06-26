import type p5 from 'p5';
import type { ControlParam, LayerEngine } from './types';
import { renderDitherDownscaled } from './dither-utils';

export const imgDitherParams: ControlParam[] = [
  // IMAGE
  { key: 'imageSource', name: 'Image Source', type: 'string', default: '', folder: 'IMAGE' },
  { key: 'imageScale', name: 'Scale', type: 'number', min: 0.1, max: 5, step: 0.1, default: 1, folder: 'IMAGE' },
  { key: 'fit', name: 'Fit', type: 'select', folder: 'IMAGE', default: 'contain', options: [
    { label: 'Contain (keep size)', value: 'contain' },
    { label: 'Cover (fill, crop)', value: 'cover' },
  ] },
  { key: 'imageX', name: 'Position X', type: 'number', min: -1000, max: 1000, default: 0, folder: 'IMAGE' },
  { key: 'imageY', name: 'Position Y', type: 'number', min: -1000, max: 1000, default: 0, folder: 'IMAGE' },

  // DITHER
  { key: 'preset', name: 'Preset', type: 'select', options: [
    { label: 'Bayer 16 Original', value: 'bayer16Original' },
    { label: 'Halftone CMYK', value: 'halftoneCMYKOriginal' },
    { label: 'FS Original', value: 'fsOriginal' },
    { label: 'Retro Gaming', value: 'retroGaming' },
    { label: 'Noise 16', value: 'noise16' },
    { label: 'Newsprint', value: 'newsprint' },
    { label: 'Retro Game', value: 'retro' },
    { label: 'Dot Matrix', value: 'dotMatrix' },
    { label: 'Newspaper', value: 'newspaper' },
    { label: 'ASCII Terminal', value: 'ascii' },
    { label: 'Glitch', value: 'glitch' },
    { label: 'Minimal', value: 'minimal' },
    { label: 'Halftone Neon', value: 'halftoneNeon' },
    { label: 'Halftone Candy', value: 'halftoneCandy' },
    { label: 'Fine Checker', value: 'fineChecker' },
    { label: 'Bayer 4 Fine', value: 'bayer4Fine' },
    { label: 'Halftone Gradient', value: 'halftoneCMYKGrad' },
    { label: 'Diagonal Contrast', value: 'diagonalContrast' },
    { label: 'Grid Gradient', value: 'gridGradient' },
    { label: 'Posterize', value: 'posterize' }
  ], default: 'bayer16Original', folder: 'DITHER' },
  { key: 'colorMode', name: 'Color Mode', type: 'select', options: [
    { label: 'Original Colors', value: 'original' },
    { label: 'Duotone', value: 'duotone' },
    { label: 'Grayscale', value: 'grayscale' }
  ], default: 'original', folder: 'DITHER' },
  { key: 'ditherType', name: 'Dither Type', type: 'select', options: [
    { label: 'Bayer 2x2', value: 'bayer2' },
    { label: 'Bayer 4x4', value: 'bayer4' },
    { label: 'Bayer 8x8', value: 'bayer8' },
    { label: 'Floyd-Steinberg', value: 'fs' },
    { label: 'Ordered 4x4', value: 'ordered4' },
    { label: 'Halftone Dot', value: 'halftone' },
    { label: 'Halftone Line', value: 'halftoneLine' }
  ], default: 'bayer4', folder: 'DITHER' },
  { key: 'foregroundColor', name: 'Foreground', type: 'color', default: '#ffffff', folder: 'DITHER' },
  { key: 'backgroundColor', name: 'Background', type: 'color', default: '#000000', folder: 'DITHER' },
  { key: 'threshold', name: 'Threshold', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, folder: 'DITHER' },
  { key: 'pixelSize', name: 'Pixel Size', type: 'number', min: 1, max: 16, default: 1, folder: 'DITHER' },
  { key: 'ditherScale', name: 'Dither Scale', type: 'number', min: 1, max: 8, default: 1, folder: 'DITHER' },

  // EFFECTS
  { key: 'invert', name: 'Invert', type: 'boolean', default: false, folder: 'EFFECTS' },
  { key: 'contrast', name: 'Contrast', type: 'number', min: 0, max: 2, step: 0.1, default: 1.1, folder: 'EFFECTS' },
  { key: 'brightness', name: 'Brightness', type: 'number', min: -1, max: 1, step: 0.1, default: 0, folder: 'EFFECTS' },
  { key: 'posterization', name: 'Posterization', type: 'number', min: 2, max: 256, default: 256, folder: 'EFFECTS' },
  { key: 'saturation', name: 'Saturation', type: 'number', min: 0, max: 2, step: 0.05, default: 1, folder: 'EFFECTS' },
  { key: 'transparentBg', name: 'Transparent BG', type: 'boolean', default: false, folder: 'EFFECTS' }
];

function isVideoUrl(src: string): boolean {
  const url = src.split('?')[0].toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.webm');
}

// Giphy GIF URLs can be converted to MP4 by swapping the extension
function toVideoUrl(src: string): string | null {
  if (isVideoUrl(src)) return src;
  try {
    const u = new URL(src);
    if (u.hostname.includes('giphy.com') && u.pathname.endsWith('.gif')) {
      u.pathname = u.pathname.replace(/\.gif$/, '.mp4');
      return u.toString();
    }
  } catch { /* not a valid URL */ }
  return null;
}

export class ImgDitherEngine implements LayerEngine {
  private mediaSource: HTMLImageElement | HTMLVideoElement | null = null;
  private mediaWidth = 0;
  private mediaHeight = 0;
  private mediaReady = false;
  private lastImageSrc = '';
  private offCanvas: HTMLCanvasElement | null = null;
  private corsError = false;
  private lastTime = -1;

  setup(_p: p5, _w: number, _h: number, _params: Record<string, any>): void {
    if (typeof window !== 'undefined') {
      this.offCanvas = document.createElement('canvas');
    }
  }

  dispose(): void {
    if (this.offCanvas) {
      this.offCanvas.remove();
      this.offCanvas = null;
    }
    this.cleanupMedia();
    this.lastImageSrc = '';
  }

  private cleanupMedia() {
    if (this.mediaSource instanceof HTMLVideoElement) {
      this.mediaSource.pause();
      this.mediaSource.removeAttribute('src');
      this.mediaSource.load();
    }
    this.mediaSource = null;
    this.mediaReady = false;
    this.corsError = false;
  }

  draw(pg: p5.Graphics, _p: p5, time: number, params: Record<string, any>): void {
    pg.clear();

    if (!params.imageSource || !this.offCanvas) return;

    if (this.lastImageSrc !== params.imageSource) {
      this.loadMedia(params.imageSource);
      this.lastImageSrc = params.imageSource;
      return;
    }

    if (!this.mediaReady || !this.mediaSource) return;

    // Sync video playback with the app's play/pause: when time stops advancing
    // (paused), freeze the GIF/video on its current frame.
    if (this.mediaSource instanceof HTMLVideoElement) {
      const v = this.mediaSource;
      const paused = time === this.lastTime;
      if (paused && !v.paused) v.pause();
      else if (!paused && v.paused) v.play().catch(() => {});
    }
    this.lastTime = time;

    // Skip dithering if we hit CORS — just draw the raw source
    if (this.corsError) {
      const pgCtx = (pg as any).drawingContext as CanvasRenderingContext2D;
      try {
        const imgAspectF = this.mediaWidth / this.mediaHeight;
        const canvasAspectF = pg.width / pg.height;
        const coverF = params.fit !== 'contain';
        const fitWF = coverF ? imgAspectF <= canvasAspectF : imgAspectF > canvasAspectF;
        let fw: number, fh: number;
        if (fitWF) {
          fw = pg.width * params.imageScale;
          fh = fw / imgAspectF;
        } else {
          fh = pg.height * params.imageScale;
          fw = fh * imgAspectF;
        }
        const fx = Math.round((pg.width - fw) / 2 + (params.imageX ?? 0));
        const fy = Math.round((pg.height - fh) / 2 + (params.imageY ?? 0));
        pgCtx.drawImage(this.mediaSource, fx, fy, fw, fh);
      } catch (_e) { /* ignore */ }
      return;
    }

    const cvs = this.offCanvas;
    cvs.width = pg.width;
    cvs.height = pg.height;

    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imgAspect = this.mediaWidth / this.mediaHeight;
    const canvasAspect = pg.width / pg.height;
    // Cover (default): fill the canvas, cropping overflow — no black bars.
    // Contain: fit inside with letterboxing.
    const cover = params.fit !== 'contain';
    const fitWidthFirst = cover ? imgAspect <= canvasAspect : imgAspect > canvasAspect;
    let drawWidth: number, drawHeight: number;
    if (fitWidthFirst) {
      drawWidth = Math.round(pg.width * params.imageScale);
      drawHeight = Math.round(drawWidth / imgAspect);
    } else {
      drawHeight = Math.round(pg.height * params.imageScale);
      drawWidth = Math.round(drawHeight * imgAspect);
    }
    const offsetX = Math.round((pg.width - drawWidth) / 2 + (params.imageX ?? 0));
    const offsetY = Math.round((pg.height - drawHeight) / 2 + (params.imageY ?? 0));

    // Transparent base so the area outside the image has no black bars.
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.drawImage(this.mediaSource, offsetX, offsetY, drawWidth, drawHeight);

    try {
      // Dither at reduced resolution for clean chunky pixels; also keeps the
      // letterbox transparent (handled inside).
      renderDitherDownscaled(pg as any, cvs, cvs.width, cvs.height, params as any, Math.max(1, params.pixelSize));
    } catch (e) {
      // CORS tainted canvas — fall back to raw draw
      console.warn('[img-dither] Canvas tainted (CORS), falling back to raw render:', e);
      this.corsError = true;
      const pgCtx = (pg as any).drawingContext as CanvasRenderingContext2D;
      pgCtx.drawImage(this.mediaSource, offsetX, offsetY, drawWidth, drawHeight);
    }
  }

  private loadMedia(src: string) {
    this.cleanupMedia();

    // Try video first: explicit video URL or Giphy GIF converted to MP4
    const videoSrc = isVideoUrl(src) ? src : toVideoUrl(src);
    if (videoSrc) {
      this.loadVideo(videoSrc, src);
    } else {
      this.loadImage(src);
    }
  }

  private loadVideo(src: string, fallbackSrc: string) {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      this.mediaSource = video;
      this.mediaWidth = video.videoWidth;
      this.mediaHeight = video.videoHeight;
      this.mediaReady = true;
      console.log('[img-dither] Video loaded:', src, video.videoWidth, 'x', video.videoHeight);
      video.play().catch((err) => {
        console.warn('[img-dither] Video autoplay blocked:', err);
      });
    };

    video.onerror = () => {
      console.warn('[img-dither] Video failed to load, trying as image:', src);
      this.loadImage(fallbackSrc);
    };

    video.src = src;
  }

  private loadImage(src: string) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.mediaSource = img;
      this.mediaWidth = img.naturalWidth;
      this.mediaHeight = img.naturalHeight;
      this.mediaReady = true;
      console.log('[img-dither] Image loaded (CORS):', src, img.naturalWidth, 'x', img.naturalHeight);
    };
    img.onerror = () => {
      // Retry without CORS (won't be able to dither, but at least renders)
      console.warn('[img-dither] CORS image load failed, retrying without CORS:', src);
      const img2 = new Image();
      img2.onload = () => {
        this.mediaSource = img2;
        this.mediaWidth = img2.naturalWidth;
        this.mediaHeight = img2.naturalHeight;
        this.mediaReady = true;
        this.corsError = true;
        console.log('[img-dither] Image loaded (no-CORS fallback):', src, img2.naturalWidth, 'x', img2.naturalHeight);
      };
      img2.src = src;
    };
    img.src = src;
  }
}
