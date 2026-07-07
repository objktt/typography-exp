import type p5 from 'p5';
import type { ControlParam, LayerEngine } from './types';
import { renderDitherDownscaled, ditherPresets } from './dither-utils';

export { ditherPresets };
export type { ControlParam };

export const ditherParams: ControlParam[] = [
  // TEXT
  { key: 'text', name: 'Text', type: 'string', default: 'DITHER', folder: 'TEXT' },
  { key: 'fontSize', name: 'Font Size', type: 'number', min: 20, max: 400, default: 180, folder: 'TEXT' },
  { key: 'fontWeight', name: 'Font Weight', type: 'select', options: [
    { label: 'Thin', value: '100' },
    { label: 'Light', value: '300' },
    { label: 'Regular', value: '400' },
    { label: 'Bold', value: '700' },
    { label: 'Black', value: '900' }
  ], default: '900', folder: 'TEXT' },
  { key: 'posX', name: 'Pos X', type: 'number', min: 0, max: 1, step: 0.005, default: 0.5, folder: 'TEXT' },
  { key: 'posY', name: 'Pos Y', type: 'number', min: 0, max: 1, step: 0.005, default: 0.5, folder: 'TEXT' },
  { key: 'align', name: 'Align', type: 'select', folder: 'TEXT', default: 'center', options: [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'right' },
  ] },
  { key: 'fitWidth', name: 'Fit Width', type: 'number', min: 0, max: 1, step: 0.01, default: 0, folder: 'TEXT' },

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
  ], default: 'newsprint', folder: 'DITHER' },
  { key: 'colorMode', name: 'Color Mode', type: 'select', options: [
    { label: 'Duotone', value: 'duotone' },
    { label: 'Original Colors', value: 'original' },
    { label: 'Grayscale', value: 'grayscale' }
  ], default: 'duotone', folder: 'DITHER' },
  { key: 'ditherType', name: 'Dither Type', type: 'select', options: [
    { label: 'Bayer 2x2', value: 'bayer2' },
    { label: 'Bayer 4x4', value: 'bayer4' },
    { label: 'Bayer 8x8', value: 'bayer8' },
    { label: 'Floyd-Steinberg', value: 'fs' },
    { label: 'Ordered 4x4', value: 'ordered4' },
    { label: 'Halftone Dot', value: 'halftone' },
    { label: 'Halftone Line', value: 'halftoneLine' }
  ], default: 'halftone', folder: 'DITHER' },
  { key: 'foregroundColor', name: 'Foreground', type: 'color', default: '#000000', folder: 'DITHER' },
  { key: 'backgroundColor', name: 'Background', type: 'color', default: '#ffffff', folder: 'DITHER' },
  { key: 'threshold', name: 'Threshold', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, folder: 'DITHER' },
  { key: 'pixelSize', name: 'Pixel Size', type: 'number', min: 1, max: 16, default: 1, folder: 'DITHER' },
  { key: 'ditherScale', name: 'Dither Scale', type: 'number', min: 1, max: 8, default: 1, folder: 'DITHER' },

  // EFFECTS
  { key: 'invert', name: 'Invert', type: 'boolean', default: false, folder: 'EFFECTS' },
  { key: 'contrast', name: 'Contrast', type: 'number', min: 0, max: 2, step: 0.1, default: 1.2, folder: 'EFFECTS' },
  { key: 'brightness', name: 'Brightness', type: 'number', min: -1, max: 1, step: 0.1, default: 0, folder: 'EFFECTS' },
  { key: 'posterization', name: 'Posterization', type: 'number', min: 2, max: 256, default: 256, folder: 'EFFECTS' },
  { key: 'saturation', name: 'Saturation', type: 'number', min: 0, max: 2, step: 0.05, default: 1, folder: 'EFFECTS' },
  { key: 'transparentBg', name: 'Transparent BG', type: 'boolean', default: false, folder: 'EFFECTS' }
];

export class DitherEngine implements LayerEngine {
  private offCanvas: HTMLCanvasElement | null = null;

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
  }

  draw(pg: p5.Graphics, _p: p5, _time: number, params: Record<string, any>): void {
    pg.clear();

    if (!this.offCanvas) return;

    const cvs = this.offCanvas;
    cvs.width = pg.width;
    cvs.height = pg.height;

    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Render text white-on-black internally: bright pixels are the dither
    // mask's "on" pixels, so foregroundColor paints the TEXT (intuitive) and
    // backgroundColor / transparentBg apply to the surrounding field.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    const font = (size: number) => `${params.fontWeight} ${size}px "Google Sans Flex Variable", Helvetica, Arial, sans-serif`;
    let size = params.fontSize;
    ctx.font = font(size);
    ctx.textAlign = (params.align as CanvasTextAlign) || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';

    // Accept real newlines and literal "\n" (models emit either).
    const lines = String(params.text ?? '').split(/\r?\n|\\n/);

    // Auto-fit: shrink so the widest line fits within fitWidth × canvas width.
    const fitPx = (params.fitWidth ?? 0) * cvs.width;
    if (fitPx > 0) {
      let widest = 0;
      for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
      if (widest > fitPx) {
        size *= fitPx / widest;
        ctx.font = font(size);
      }
    }

    const cx = (params.posX ?? 0.5) * cvs.width;
    const cy = (params.posY ?? 0.5) * cvs.height;
    const lineHeight = size * 1.1;
    const totalHeight = (lines.length - 1) * lineHeight;
    let startY = cy - totalHeight / 2;

    for (const line of lines) {
      ctx.fillText(line, cx, startY);
      startY += lineHeight;
    }

    renderDitherDownscaled(pg as any, cvs, cvs.width, cvs.height, params as any, Math.max(1, params.pixelSize));
  }
}
