/* eslint-disable @typescript-eslint/no-explicit-any */
import type p5 from 'p5';
import type { ControlParam, LayerEngine } from './types';

// ---------------------------------------------------------------------------
// LOTTIE engine — plays a Lottie/Bodymovin JSON animation as a layer.
// The animation renders into an offscreen canvas via lottie-web's canvas
// renderer, driven by the studio's timeline (time → frame), then composites
// onto the layer with position/scale. lottie-web is imported lazily inside
// setup so the engine registry stays server-safe.
// ---------------------------------------------------------------------------

export const lottieParams: ControlParam[] = [
  { key: 'lottieSource', name: 'Lottie URL', type: 'string', default: '/sample-lottie.json', folder: 'SOURCE' },

  { key: 'scale', name: 'Scale', type: 'number', min: 0.05, max: 2, step: 0.01, default: 0.6, folder: 'LAYOUT' },
  { key: 'posX', name: 'Pos X', type: 'number', min: 0, max: 1, step: 0.005, default: 0.5, folder: 'LAYOUT' },
  { key: 'posY', name: 'Pos Y', type: 'number', min: 0, max: 1, step: 0.005, default: 0.5, folder: 'LAYOUT' },

  { key: 'speed', name: 'Speed', type: 'number', min: 0, max: 4, step: 0.05, default: 1, folder: 'MOTION' },
  { key: 'loop', name: 'Loop', type: 'boolean', default: true, folder: 'MOTION' },
];

export class LottieEngine implements LayerEngine {
  private anim: any = null;
  private loadedSrc: string | null = null;
  private offCanvas: HTMLCanvasElement | null = null;
  private ready = false;
  private failed: string | null = null;
  private lottiePromise: Promise<any> | null = null;

  setup(): void {
    if (typeof window !== 'undefined' && !this.lottiePromise) {
      this.lottiePromise = import('lottie-web').then((m) => m.default ?? m);
    }
  }

  private load(src: string): void {
    this.loadedSrc = src;
    this.ready = false;
    this.failed = null;
    this.anim?.destroy();
    this.anim = null;
    if (!src || !this.lottiePromise) return;

    // Fetch the JSON ourselves so the offscreen canvas can be sized to the
    // animation BEFORE lottie initializes — the canvas renderer computes its
    // layout from the canvas size at init time.
    Promise.all([this.lottiePromise, fetch(src).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })])
      .then(([lottie, data]) => {
        if (this.loadedSrc !== src) return; // src changed while loading
        const canvas = document.createElement('canvas');
        canvas.width = data.w || 512;
        canvas.height = data.h || 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        this.offCanvas = canvas;
        this.anim = lottie.loadAnimation({
          renderer: 'canvas',
          loop: false,
          autoplay: false,
          animationData: data,
          rendererSettings: { context: ctx, clearCanvas: true, preserveAspectRatio: 'xMidYMid meet' },
        });
        this.ready = true;
      })
      .catch((e) => {
        if (this.loadedSrc === src) this.failed = `could not load Lottie JSON (${(e as Error).message})`;
      });
  }

  draw(pg: p5.Graphics, _p: p5, time: number, pr: Record<string, any>): void {
    pg.clear();
    const ctx = pg.drawingContext as CanvasRenderingContext2D;
    const src = String(pr.lottieSource ?? '');
    if (src !== this.loadedSrc) this.load(src);

    if (this.failed) {
      ctx.save();
      ctx.font = '12px monospace';
      ctx.fillStyle = '#ff5555';
      ctx.textBaseline = 'top';
      ctx.fillText(`lottie: ${this.failed}`.slice(0, 120), 12, 12);
      ctx.restore();
      return;
    }
    if (!this.ready || !this.anim || !this.offCanvas) return;

    // Timeline → frame (studio time drives playback; freezes when paused).
    const total = this.anim.totalFrames;
    const fr = this.anim.frameRate || 30;
    let frame = time * fr * (pr.speed ?? 1);
    frame = pr.loop !== false ? frame % total : Math.min(frame, total - 1);
    this.anim.goToAndStop(frame, true);

    // Composite: scale = fraction of canvas width the animation occupies.
    const aw = this.offCanvas.width;
    const ah = this.offCanvas.height;
    if (aw === 0 || ah === 0) return;
    const w = (pr.scale ?? 0.6) * pg.width;
    const h = w * (ah / aw);
    const x = (pr.posX ?? 0.5) * pg.width - w / 2;
    const y = (pr.posY ?? 0.5) * pg.height - h / 2;
    ctx.drawImage(this.offCanvas, x, y, w, h);
  }

  dispose(): void {
    this.anim?.destroy();
    this.anim = null;
    this.offCanvas = null;
  }
}
