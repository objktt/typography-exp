/* eslint-disable @typescript-eslint/no-explicit-any */
import type p5 from 'p5';
import type { ControlParam, LayerEngine } from './types';

// ---------------------------------------------------------------------------
// Label Engine — positioned, grid-aware Swiss-modern text.
// Unlike TEXTR (repeating kinetic grid) this places one block of text at a
// normalized anchor with alignment, tracking and weight. The building block
// for laid-out posters (DJ name, date, time, venue).
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
];

const FONT_STACK = '"Google Sans Flex Variable", Helvetica Neue, Helvetica, Arial, sans-serif';

export class LabelEngine implements LayerEngine {
  setup(): void {
    /* stateless */
  }

  draw(pg: p5.Graphics, _p: p5, _time: number, pr: Record<string, any>): void {
    pg.clear();
    const ctx = pg.drawingContext as CanvasRenderingContext2D & { letterSpacing?: string };

    const raw = String(pr.text ?? '');
    const size = pr.fontSize;
    const lh = size * pr.lineHeight;
    const x = pr.posX * pg.width;
    const y = pr.posY * pg.height;

    ctx.save();
    ctx.font = `${pr.weight} ${size}px ${FONT_STACK}`;
    ctx.fillStyle = pr.color;
    ctx.textAlign = (pr.align as CanvasTextAlign) || 'left';
    ctx.textBaseline = 'alphabetic';
    try { ctx.letterSpacing = `${pr.tracking * size}px`; } catch { /* older browsers */ }

    // Build lines: split on \n, then word-wrap to Max Width so the full text fits.
    const baseLines = (pr.uppercase ? raw.toUpperCase() : raw).split('\n');
    let lines: string[] = baseLines;
    const maxPx = (pr.maxWidth ?? 0) * pg.width;
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
    if (pr.bg) {
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
    }

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 0, oy + i * lh);
    }
    ctx.restore();
    try { ctx.letterSpacing = '0px'; } catch { /* noop */ }
  }
}
