/* eslint-disable @typescript-eslint/no-explicit-any */
import type p5 from 'p5';
import type { ControlParam, LayerEngine } from './types';

// ---------------------------------------------------------------------------
// Logo Engine — places the brand mark on the poster. Loads a (monochrome) SVG
// and optionally tints it to any palette colour via canvas compositing, so the
// same mark adapts to every style. Anchored inside the Instagram safe box.
// ---------------------------------------------------------------------------

export const logoParams: ControlParam[] = [
  { key: 'logoSource', name: 'Logo URL', type: 'string', default: '/logo.svg', folder: 'LOGO' },
  { key: 'tint', name: 'Tint', type: 'boolean', default: true, folder: 'LOGO' },
  { key: 'color', name: 'Color', type: 'color', default: '#111111', folder: 'LOGO' },

  { key: 'scale', name: 'Scale', type: 'number', min: 0.05, max: 1, step: 0.005, default: 0.22, folder: 'LAYOUT' },
  { key: 'posX', name: 'Pos X', type: 'number', min: 0, max: 1, step: 0.005, default: 0.93, folder: 'LAYOUT' },
  { key: 'posY', name: 'Pos Y', type: 'number', min: 0, max: 1, step: 0.005, default: 0.07, folder: 'LAYOUT' },
  { key: 'align', name: 'Align', type: 'select', folder: 'LAYOUT', default: 'right', options: [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'right' },
  ] },
  { key: 'vAlign', name: 'V-Align', type: 'select', folder: 'LAYOUT', default: 'top', options: [
    { label: 'Top', value: 'top' },
    { label: 'Middle', value: 'middle' },
    { label: 'Bottom', value: 'bottom' },
  ] },
];

export class LogoEngine implements LayerEngine {
  private img: HTMLImageElement | null = null;
  private loadedUrl = '';
  private ready = false;
  private tmp: HTMLCanvasElement | null = null;

  setup(): void {
    /* lazy-loads in draw */
  }

  private ensureImage(url: string): void {
    if (url === this.loadedUrl) return;
    this.loadedUrl = url;
    this.ready = false;
    if (!url) { this.img = null; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (this.loadedUrl === url) { this.img = img; this.ready = true; } };
    img.onerror = () => { if (this.loadedUrl === url) this.ready = false; };
    img.src = url;
  }

  draw(pg: p5.Graphics, _p: p5, _t: number, pr: Record<string, any>): void {
    pg.clear();
    this.ensureImage(String(pr.logoSource || ''));
    if (!this.ready || !this.img) return;

    const aspect = this.img.naturalWidth / Math.max(1, this.img.naturalHeight) || 1;
    const w = Math.max(1, Math.round(pr.scale * pg.width));
    const h = Math.max(1, Math.round(w / aspect));

    // Render (and optionally recolor) the logo on an offscreen canvas.
    if (!this.tmp) this.tmp = document.createElement('canvas');
    const tmp = this.tmp;
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d')!;
    tctx.clearRect(0, 0, w, h);
    tctx.drawImage(this.img, 0, 0, w, h);
    if (pr.tint) {
      tctx.globalCompositeOperation = 'source-in';
      tctx.fillStyle = pr.color || '#111111';
      tctx.fillRect(0, 0, w, h);
      tctx.globalCompositeOperation = 'source-over';
    }

    // Anchor inside the canvas.
    let x = pr.posX * pg.width;
    let y = pr.posY * pg.height;
    if (pr.align === 'center') x -= w / 2;
    else if (pr.align === 'right') x -= w;
    if (pr.vAlign === 'middle') y -= h / 2;
    else if (pr.vAlign === 'bottom') y -= h;

    (pg.drawingContext as CanvasRenderingContext2D).drawImage(tmp, x, y, w, h);
  }

  dispose(): void {
    this.img = null;
    this.tmp = null;
    this.ready = false;
  }
}
