/* eslint-disable @typescript-eslint/no-explicit-any */
import type p5 from 'p5';
import type { ControlParam, LayerEngine } from './types';

// ---------------------------------------------------------------------------
// CUSTOM engine — a layer whose visual is a JS sketch (Canvas 2D) stored in
// the `code` param, written by the AI generator or edited by hand in the
// inspector. The code is the body of:
//
//   function (ctx, w, h, t, k) { ... }
//
//   ctx : CanvasRenderingContext2D (already clipped to this layer)
//   w,h : canvas size in px
//   t   : elapsed time in seconds (frozen while paused)
//   k   : live knobs — { a, b, c, d, color1, color2, text }
//
// Trust model: code comes from Claude or the signed-in user of this personal
// studio, and runs in-page like any other layer. This is the same trade-off
// visu.haus-style tools make; revisit (iframe sandbox) before multi-tenant.
// ---------------------------------------------------------------------------

const DEFAULT_CODE = `// Pulsing concentric rings — edit me!
const cx = w / 2, cy = h / 2;
const rings = 14;
for (let i = 0; i < rings; i++) {
  const f = i / rings;
  const r = f * Math.min(w, h) * 0.48 * (1 + 0.05 * Math.sin(t * 2 + i * k.b * 6));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = f % 0.2 < 0.1 ? k.color1 : k.color2;
  ctx.lineWidth = 1 + k.a * 6 * (1 - f);
  ctx.globalAlpha = 1 - f * 0.7;
  ctx.stroke();
}
ctx.globalAlpha = 1;`;

export const customParams: ControlParam[] = [
  { key: 'code', name: 'Sketch Code', type: 'string', multiline: true, default: DEFAULT_CODE, folder: 'CODE' },

  { key: 'a', name: 'Knob A', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, folder: 'KNOBS' },
  { key: 'b', name: 'Knob B', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, folder: 'KNOBS' },
  { key: 'c', name: 'Knob C', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, folder: 'KNOBS' },
  { key: 'd', name: 'Knob D', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, folder: 'KNOBS' },

  { key: 'color1', name: 'Color 1', type: 'color', default: '#ffffff', folder: 'STYLE' },
  { key: 'color2', name: 'Color 2', type: 'color', default: '#e2231a', folder: 'STYLE' },
  { key: 'text', name: 'Text', type: 'string', default: '', folder: 'STYLE' },
];

type SketchFn = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, k: Record<string, any>) => void;

export class CustomEngine implements LayerEngine {
  private compiledSource: string | null = null;
  private compiled: SketchFn | null = null;
  private compileError: string | null = null;
  private lastRunError: string | null = null;

  setup(): void {
    /* stateless — compilation is lazy, keyed on the code param */
  }

  private compile(source: string): void {
    this.compiledSource = source;
    this.lastRunError = null;
    try {
      this.compiled = new Function('ctx', 'w', 'h', 't', 'k', `"use strict";\n${source}`) as SketchFn;
      this.compileError = null;
    } catch (e) {
      this.compiled = null;
      this.compileError = (e as Error).message;
    }
  }

  draw(pg: p5.Graphics, _p: p5, time: number, pr: Record<string, any>): void {
    pg.clear();
    const ctx = pg.drawingContext as CanvasRenderingContext2D;
    const source = String(pr.code ?? '');
    if (source !== this.compiledSource) this.compile(source);

    const error = this.compileError ?? this.lastRunError;
    if (this.compiled && !this.compileError) {
      const knobs = {
        a: pr.a ?? 0.5, b: pr.b ?? 0.5, c: pr.c ?? 0.5, d: pr.d ?? 0.5,
        color1: pr.color1 ?? '#ffffff', color2: pr.color2 ?? '#e2231a',
        text: pr.text ?? '',
      };
      ctx.save();
      try {
        this.compiled(ctx, pg.width, pg.height, time, knobs);
        this.lastRunError = null;
        ctx.restore();
        return;
      } catch (e) {
        // Keep the render loop alive; surface the error on the layer instead.
        this.lastRunError = (e as Error).message;
        ctx.restore();
      }
    }

    ctx.save();
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ff5555';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`code error: ${error ?? 'unknown'}`.slice(0, 120), 12, 12);
    ctx.restore();
  }
}
