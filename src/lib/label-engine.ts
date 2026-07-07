/* eslint-disable @typescript-eslint/no-explicit-any */
import type p5 from 'p5';
import type { ControlParam, LayerEngine } from './types';
import { renderDitherDownscaled } from './dither-utils';

// ---------------------------------------------------------------------------
// Label Engine — positioned, grid-aware Swiss-modern text.
// Unlike TEXTR (repeating kinetic grid) this places one block of text at a
// normalized anchor with alignment, tracking and weight. The building block
// for laid-out posters (DJ name, date, time, venue). Optional dither post-
// effect renders the text through the same pipeline as the TYPO engine.
// ---------------------------------------------------------------------------

export const labelParams: ControlParam[] = [
  { key: 'text', name: 'Text', type: 'string', multiline: true, default: 'LISTENING SESSION', folder: 'TEXT' },
  { key: 'color', name: 'Color', type: 'color', default: '#111111', folder: 'TEXT' },
  { key: 'uppercase', name: 'Uppercase', type: 'boolean', default: true, folder: 'TEXT' },

  { key: 'bg', name: 'Background', type: 'boolean', default: false, folder: 'BACKGROUND' },
  { key: 'bgColor', name: 'BG Color', type: 'color', default: '#ffffff', folder: 'BACKGROUND' },
  { key: 'bgPad', name: 'BG Padding', type: 'number', min: 0, max: 0.6, step: 0.01, default: 0.18, folder: 'BACKGROUND' },

  { key: 'fontSize', name: 'Size', type: 'number', min: 6, max: 320, step: 1, default: 34, folder: 'TYPE' },
  { key: 'weight', name: 'Weight', type: 'select', folder: 'TYPE', default: '700', options: [
    { label: 'Thin', value: '100' },
    { label: 'Light', value: '300' },
    { label: 'Regular', value: '400' },
    { label: 'Medium', value: '500' },
    { label: 'Bold', value: '700' },
    { label: 'Black', value: '900' },
  ] },
  { key: 'tracking', name: 'Tracking', type: 'number', min: -0.08, max: 0.4, step: 0.005, default: 0.02, folder: 'TYPE' },
  { key: 'lineHeight', name: 'Line Height', type: 'number', min: 0.8, max: 2.4, step: 0.05, default: 1.1, folder: 'TYPE' },
  { key: 'maxWidth', name: 'Max Width', type: 'number', min: 0, max: 1, step: 0.01, default: 0, folder: 'TYPE' },
  { key: 'fitWidth', name: 'Fit Width', type: 'number', min: 0, max: 1, step: 0.01, default: 0, folder: 'TYPE' },

  { key: 'posX', name: 'Pos X', type: 'number', min: 0, max: 1, step: 0.005, default: 0.08, folder: 'LAYOUT' },
  { key: 'posY', name: 'Pos Y', type: 'number', min: 0, max: 1, step: 0.005, default: 0.08, folder: 'LAYOUT' },
  { key: 'align', name: 'Align', type: 'select', folder: 'LAYOUT', default: 'left', options: [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'right' },
  ] },
  { key: 'vAlign', name: 'V-Align', type: 'select', folder: 'LAYOUT', default: 'top', options: [
    { label: 'Top', value: 'top' },
    { label: 'Middle', value: 'middle' },
    { label: 'Bottom', value: 'bottom' },
  ] },
  { key: 'direction', name: 'Direction', type: 'select', folder: 'LAYOUT', default: 'horizontal', options: [
    { label: 'Horizontal', value: 'horizontal' },
    { label: 'Vertical ↓ (CW)', value: 'vertical-cw' },
    { label: 'Vertical ↑ (CCW)', value: 'vertical-ccw' },
  ] },
  { key: 'rotate', name: 'Rotate', type: 'number', min: -180, max: 180, step: 1, default: 0, folder: 'LAYOUT' },

  // Dither post-effect: the text is rendered through the TYPO engine's dither
  // pipeline; the surrounding field stays transparent so it layers cleanly.
  { key: 'dither', name: 'Dither', type: 'boolean', default: false, folder: 'DITHER' },
  { key: 'ditherType', name: 'Dither Type', type: 'select', folder: 'DITHER', default: 'bayer4', options: [
    { label: 'Bayer 2x2', value: 'bayer2' },
    { label: 'Bayer 4x4', value: 'bayer4' },
    { label: 'Bayer 8x8', value: 'bayer8' },
    { label: 'Floyd-Steinberg', value: 'fs' },
    { label: 'Ordered 4x4', value: 'ordered4' },
    { label: 'Halftone Dot', value: 'halftone' },
    { label: 'Halftone Line', value: 'halftoneLine' },
  ] },
  { key: 'ditherPixel', name: 'Pixel Size', type: 'number', min: 1, max: 16, step: 1, default: 2, folder: 'DITHER' },
  { key: 'ditherThreshold', name: 'Threshold', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, folder: 'DITHER' },
  { key: 'ditherScale', name: 'Dither Scale', type: 'number', min: 1, max: 8, step: 1, default: 1, folder: 'DITHER' },
];

const FONT_STACK = '"Google Sans Flex Variable", Helvetica Neue, Helvetica, Arial, sans-serif';

export class LabelEngine implements LayerEngine {
  private offCanvas: HTMLCanvasElement | null = null;

  setup(): void {
    /* stateless */
  }

  dispose(): void {
    this.offCanvas?.remove();
    this.offCanvas = null;
  }

  draw(pg: p5.Graphics, _p: p5, _time: number, pr: Record<string, any>): void {
    pg.clear();

    if (!pr.dither) {
      this.renderText(
        pg.drawingContext as CanvasRenderingContext2D,
        pg.width, pg.height, pr, pr.color, !!pr.bg,
      );
      return;
    }

    // Dither path: render the text white-on-black offscreen (bright = "on"
    // pixels), then dither into the layer with the text color as foreground
    // and a transparent field. The BG box option doesn't compose with
    // dithering and is ignored here.
    if (typeof document === 'undefined') return;
    if (!this.offCanvas) this.offCanvas = document.createElement('canvas');
    const cvs = this.offCanvas;
    cvs.width = pg.width;
    cvs.height = pg.height;
    const octx = cvs.getContext('2d');
    if (!octx) return;
    octx.fillStyle = '#000000';
    octx.fillRect(0, 0, cvs.width, cvs.height);
    this.renderText(octx, pg.width, pg.height, pr, '#ffffff', false);

    renderDitherDownscaled(pg as any, cvs, cvs.width, cvs.height, {
      ditherType: pr.ditherType ?? 'bayer4',
      threshold: pr.ditherThreshold ?? 0.5,
      contrast: 1,
      brightness: 0,
      invert: false,
      foregroundColor: pr.color,
      backgroundColor: '#000000',
      colorMode: 'duotone',
      ditherScale: pr.ditherScale ?? 1,
      transparentBg: true,
    }, Math.max(1, pr.ditherPixel ?? 2));
  }

  /** Lay out and fill the text block into any 2D context (direct or offscreen). */
  private renderText(
    baseCtx: CanvasRenderingContext2D,
    W: number,
    H: number,
    pr: Record<string, any>,
    color: string,
    withBg: boolean,
  ): void {
    const ctx = baseCtx as CanvasRenderingContext2D & { letterSpacing?: string };

    const raw = String(pr.text ?? '');
    let size = pr.fontSize;
    let lh = size * pr.lineHeight;
    const x = pr.posX * W;
    const y = pr.posY * H;

    ctx.save();
    ctx.font = `${pr.weight} ${size}px ${FONT_STACK}`;
    ctx.fillStyle = color;
    ctx.textAlign = (pr.align as CanvasTextAlign) || 'left';
    ctx.textBaseline = 'alphabetic';
    try { ctx.letterSpacing = `${pr.tracking * size}px`; } catch { /* older browsers */ }

    // Build lines: split on \n, then word-wrap to Max Width so the full text fits.
    const baseLines = (pr.uppercase ? raw.toUpperCase() : raw).split('\n');
    let lines: string[] = baseLines;
    const maxPx = (pr.maxWidth ?? 0) * W;
    if (maxPx > 0) {
      lines = [];
      for (const line of baseLines) {
        const words = line.split(' ');
        let cur = '';
        for (const w of words) {
          const test = cur ? `${cur} ${w}` : w;
          if (cur && ctx.measureText(test).width > maxPx) { lines.push(cur); cur = w; }
          else cur = test;
        }
        lines.push(cur);
      }
    }

    // Auto-fit: shrink the font so the widest line fits within fitWidth
    // (fraction of canvas width). Makes big headlines overflow-proof — text
    // width can't be predicted when the design is authored as data.
    const fitPx = (pr.fitWidth ?? 0) * W;
    if (fitPx > 0) {
      let widest = 0;
      for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
      if (widest > fitPx) {
        size *= fitPx / widest;
        lh = size * pr.lineHeight;
        ctx.font = `${pr.weight} ${size}px ${FONT_STACK}`;
        try { ctx.letterSpacing = `${pr.tracking * size}px`; } catch { /* older browsers */ }
      }
    }

    ctx.translate(x, y);
    // Paragraph direction: rotate the whole block for vertical text.
    if (pr.direction === 'vertical-cw') ctx.rotate(Math.PI / 2);
    else if (pr.direction === 'vertical-ccw') ctx.rotate(-Math.PI / 2);
    if (pr.rotate) ctx.rotate((pr.rotate * Math.PI) / 180);

    const block = (lines.length - 1) * lh;
    let oy = 0;
    if (pr.vAlign === 'middle') oy = -block / 2;
    else if (pr.vAlign === 'bottom') oy = -block;
    // baseline sits ~0.8em below the anchor for top alignment
    oy += size * 0.8;

    const align = (pr.align as CanvasTextAlign) || 'left';

    // Optional readability background box behind each line.
    if (withBg) {
      const padX = (pr.bgPad ?? 0.18) * size;
      const padY = (pr.bgPad ?? 0.18) * size * 0.6;
      ctx.save();
      ctx.fillStyle = pr.bgColor || '#ffffff';
      for (let i = 0; i < lines.length; i++) {
        const tw = ctx.measureText(lines[i]).width;
        if (tw <= 0) continue;
        let lx = 0;
        if (align === 'center') lx = -tw / 2;
        else if (align === 'right') lx = -tw;
        const ly = oy + i * lh;
        ctx.fillRect(lx - padX, ly - size * 0.78 - padY, tw + padX * 2, size * 0.98 + padY * 2);
      }
      ctx.restore();
      ctx.fillStyle = color;
    }

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 0, oy + i * lh);
    }
    ctx.restore();
    try { ctx.letterSpacing = '0px'; } catch { /* noop */ }
  }
}
