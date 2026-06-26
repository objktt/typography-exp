import type p5 from 'p5';
import type { ControlParam, LayerEngine } from './types';

// --- Preset interface ---

export interface RastrPreset {
  name: string;
  cellSize: number;
  shapeType: string;
  arrangeShapes: string;
  shapeSizeX: number;
  shapeSizeY: number;
  rotation: number;
  strokeWeight: number;
  fillType: string;
  angle: number;
  softness: number;
  offset: number;
  firstColor: string;
  secondColor: string;
  distribution: string;
  amplify: number;
  loopSpeed: number;
}

// --- Presets ---

export const rastrPresets: Record<string, RastrPreset> = {
  hidingInPlainSight: {
    name: 'Hiding In Plain Sight',
    cellSize: 12, shapeType: 'rectangle', arrangeShapes: 'backward',
    shapeSizeX: 2.25, shapeSizeY: 1.5, rotation: 35, strokeWeight: 1.5,
    fillType: 'gradient', angle: 180, softness: 0.01, offset: -0.19,
    firstColor: '#ffffff', secondColor: '#ffaa00',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  exit: {
    name: 'Exit',
    cellSize: 12, shapeType: 'arrow', arrangeShapes: 'forward',
    shapeSizeX: 2.5, shapeSizeY: 1.8, rotation: -90, strokeWeight: 1.5,
    fillType: 'gradient', angle: 90, softness: 0.2, offset: 0,
    firstColor: '#33ff66', secondColor: '#ccff00',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  oneRasterADay: {
    name: 'One Raster A Day',
    cellSize: 15, shapeType: 'circle', arrangeShapes: 'backward',
    shapeSizeX: 2.0, shapeSizeY: 2.0, rotation: 0, strokeWeight: 1.5,
    fillType: 'gradient', angle: 135, softness: 0.15, offset: 0,
    firstColor: '#ffffff', secondColor: '#ff6644',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  loveDeathRobots: {
    name: 'Love, Death and Robots',
    cellSize: 10, shapeType: 'triangle', arrangeShapes: 'backward',
    shapeSizeX: 2.2, shapeSizeY: 2.2, rotation: 45, strokeWeight: 1.5,
    fillType: 'gradient', angle: 270, softness: 0.1, offset: 0.1,
    firstColor: '#ff0033', secondColor: '#1a0000',
    distribution: 'noise', amplify: 3, loopSpeed: 0.5,
  },
  textAsTexture: {
    name: 'Text As Texture',
    cellSize: 5, shapeType: 'rectangle', arrangeShapes: 'backward',
    shapeSizeX: 1.0, shapeSizeY: 1.0, rotation: 0, strokeWeight: 1,
    fillType: 'gradient', angle: 180, softness: 0.5, offset: 0,
    firstColor: '#999999', secondColor: '#555555',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  empirePride: {
    name: 'Empire Pride',
    cellSize: 14, shapeType: 'diamond', arrangeShapes: 'backward',
    shapeSizeX: 3.0, shapeSizeY: 3.0, rotation: 0, strokeWeight: 1.5,
    fillType: 'gradient', angle: 200, softness: 0.05, offset: -0.1,
    firstColor: '#ffd700', secondColor: '#990099',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  dieSciF: {
    name: 'Die Sci-fi',
    cellSize: 10, shapeType: 'diamond', arrangeShapes: 'backward',
    shapeSizeX: 2.0, shapeSizeY: 2.0, rotation: 45, strokeWeight: 1.5,
    fillType: 'gradient', angle: 45, softness: 0.1, offset: 0,
    firstColor: '#00ffff', secondColor: '#ff00ff',
    distribution: 'noise', amplify: 5, loopSpeed: 0.8,
  },
  feelTheVibe: {
    name: 'Feel The Vibe',
    cellSize: 12, shapeType: 'circle', arrangeShapes: 'backward',
    shapeSizeX: 2.5, shapeSizeY: 2.5, rotation: 0, strokeWeight: 1.5,
    fillType: 'gradient', angle: 160, softness: 0.2, offset: 0,
    firstColor: '#ff6600', secondColor: '#ffcc00',
    distribution: 'sine', amplify: 8, loopSpeed: 1.0,
  },
  windowFrames: {
    name: 'Window Frames',
    cellSize: 20, shapeType: 'rectangle', arrangeShapes: 'forward',
    shapeSizeX: 3.5, shapeSizeY: 3.5, rotation: 0, strokeWeight: 2,
    fillType: 'gradient', angle: 180, softness: 0.3, offset: 0,
    firstColor: '#ffffff', secondColor: '#888888',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  lampPost: {
    name: 'Lamp Post',
    cellSize: 10, shapeType: 'line', arrangeShapes: 'backward',
    shapeSizeX: 1.5, shapeSizeY: 3.0, rotation: 90, strokeWeight: 2,
    fillType: 'gradient', angle: 270, softness: 0.15, offset: 0.1,
    firstColor: '#ffcc00', secondColor: '#ffffff',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  lost: {
    name: 'Lost',
    cellSize: 7, shapeType: 'dot', arrangeShapes: 'backward',
    shapeSizeX: 1.0, shapeSizeY: 1.0, rotation: 0, strokeWeight: 1,
    fillType: 'solid', angle: 0, softness: 0, offset: 0,
    firstColor: '#ffffff', secondColor: '#ffffff',
    distribution: 'noise', amplify: 4, loopSpeed: 0.5,
  },
  lookAtMe: {
    name: 'Look At Me',
    cellSize: 18, shapeType: 'rectangle', arrangeShapes: 'forward',
    shapeSizeX: 4.0, shapeSizeY: 2.5, rotation: 0, strokeWeight: 1.5,
    fillType: 'gradient', angle: 0, softness: 0.05, offset: 0,
    firstColor: '#ff0000', secondColor: '#ffff00',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  needForSpeed: {
    name: 'Need For Speed',
    cellSize: 8, shapeType: 'line', arrangeShapes: 'backward',
    shapeSizeX: 4.0, shapeSizeY: 0.5, rotation: 0, strokeWeight: 1.5,
    fillType: 'gradient', angle: 180, softness: 0.1, offset: 0,
    firstColor: '#ffffff', secondColor: '#ff4400',
    distribution: 'uniform', amplify: 15, loopSpeed: 2.0,
  },
  uglyIsTheNewBlack: {
    name: 'Ugly Is The New Black',
    cellSize: 14, shapeType: 'cross', arrangeShapes: 'backward',
    shapeSizeX: 3.0, shapeSizeY: 3.0, rotation: 45, strokeWeight: 3,
    fillType: 'solid', angle: 0, softness: 0, offset: 0,
    firstColor: '#ffffff', secondColor: '#ffffff',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  cryingIsMyCardio: {
    name: 'Crying Is My Cardio',
    cellSize: 7, shapeType: 'circle', arrangeShapes: 'backward',
    shapeSizeX: 1.8, shapeSizeY: 1.8, rotation: 0, strokeWeight: 1,
    fillType: 'gradient', angle: 270, softness: 0.3, offset: 0.1,
    firstColor: '#ff3399', secondColor: '#ff99cc',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  offset: {
    name: 'Offset',
    cellSize: 12, shapeType: 'rectangle', arrangeShapes: 'backward',
    shapeSizeX: 2.0, shapeSizeY: 1.5, rotation: 15, strokeWeight: 1.5,
    fillType: 'gradient', angle: 180, softness: 0.01, offset: -0.5,
    firstColor: '#ffffff', secondColor: '#000000',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  blueBoy: {
    name: 'Blue Boy',
    cellSize: 12, shapeType: 'circle', arrangeShapes: 'backward',
    shapeSizeX: 2.2, shapeSizeY: 2.2, rotation: 0, strokeWeight: 1.5,
    fillType: 'gradient', angle: 225, softness: 0.2, offset: 0,
    firstColor: '#0066ff', secondColor: '#00ccff',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  rainyDays: {
    name: 'Rainy Days',
    cellSize: 6, shapeType: 'line', arrangeShapes: 'backward',
    shapeSizeX: 0.5, shapeSizeY: 2.5, rotation: 80, strokeWeight: 1,
    fillType: 'gradient', angle: 270, softness: 0.3, offset: 0,
    firstColor: '#4488cc', secondColor: '#99bbdd',
    distribution: 'sine', amplify: 3, loopSpeed: 0.8,
  },
  socksWithSandals: {
    name: 'Socks With Sandals',
    cellSize: 10, shapeType: 'triangle', arrangeShapes: 'forward',
    shapeSizeX: 2.5, shapeSizeY: 2.5, rotation: 20, strokeWeight: 1.5,
    fillType: 'gradient', angle: 120, softness: 0.15, offset: 0.1,
    firstColor: '#ff9933', secondColor: '#66cc99',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  theEnd: {
    name: 'The End',
    cellSize: 12, shapeType: 'cross', arrangeShapes: 'backward',
    shapeSizeX: 2.5, shapeSizeY: 2.5, rotation: 0, strokeWeight: 2.5,
    fillType: 'gradient', angle: 270, softness: 0.05, offset: 0.2,
    firstColor: '#ff0000', secondColor: '#330000',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  timeToKickAss: {
    name: 'Time To Kick Ass',
    cellSize: 14, shapeType: 'arrow', arrangeShapes: 'forward',
    shapeSizeX: 2.8, shapeSizeY: 2.0, rotation: 0, strokeWeight: 1.5,
    fillType: 'gradient', angle: 0, softness: 0.1, offset: 0,
    firstColor: '#ff4400', secondColor: '#ffcc00',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  ghostInTheShell: {
    name: 'Ghost In The Shell',
    cellSize: 5, shapeType: 'rectangle', arrangeShapes: 'backward',
    shapeSizeX: 1.2, shapeSizeY: 1.2, rotation: 0, strokeWeight: 1,
    fillType: 'gradient', angle: 180, softness: 0.4, offset: 0,
    firstColor: '#00ff66', secondColor: '#003311',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  whatTheFunk: {
    name: 'What The Funk',
    cellSize: 14, shapeType: 'star', arrangeShapes: 'backward',
    shapeSizeX: 2.5, shapeSizeY: 2.5, rotation: 30, strokeWeight: 1.5,
    fillType: 'gradient', angle: 45, softness: 0.2, offset: 0,
    firstColor: '#ff00ff', secondColor: '#00ffff',
    distribution: 'sine', amplify: 6, loopSpeed: 1.2,
  },
  deadInABottomlessPit: {
    name: 'Dead In A Bottomless Pit',
    cellSize: 10, shapeType: 'diamond', arrangeShapes: 'backward',
    shapeSizeX: 2.2, shapeSizeY: 2.8, rotation: 0, strokeWeight: 1.5,
    fillType: 'gradient', angle: 270, softness: 0.05, offset: 0.3,
    firstColor: '#444444', secondColor: '#000000',
    distribution: 'uniform', amplify: 0, loopSpeed: 0,
  },
  everySunrise: {
    name: 'Every Sunrise',
    cellSize: 14, shapeType: 'circle', arrangeShapes: 'backward',
    shapeSizeX: 2.8, shapeSizeY: 2.8, rotation: 0, strokeWeight: 1.5,
    fillType: 'gradient', angle: 250, softness: 0.25, offset: -0.1,
    firstColor: '#ff6644', secondColor: '#ffcc66',
    distribution: 'uniform', amplify: 3, loopSpeed: 0.3,
  },
  seeYouNextTime: {
    name: 'See You Next Time',
    cellSize: 12, shapeType: 'diamond', arrangeShapes: 'backward',
    shapeSizeX: 2.5, shapeSizeY: 2.5, rotation: 30, strokeWeight: 1.5,
    fillType: 'gradient', angle: 315, softness: 0.15, offset: 0,
    firstColor: '#6644ff', secondColor: '#ff4466',
    distribution: 'sine', amplify: 5, loopSpeed: 0.6,
  },
};

// --- Params ---

const presetOptions = Object.entries(rastrPresets).map(([value, p]) => ({ label: p.name, value }));

export const rastrParams: ControlParam[] = [
  // TEXT
  { key: 'preset', name: 'Preset', type: 'select', options: presetOptions, default: 'hidingInPlainSight', folder: 'TEXT' },
  { key: 'source', name: 'Source', type: 'select', options: [
    { label: 'Text Shape', value: 'text' },
    { label: 'Full Grid', value: 'fill' },
  ], default: 'text', folder: 'TEXT' },
  { key: 'text', name: 'Text', type: 'string', default: 'HIDING\\nIN\\nPLAIN SIGHT', folder: 'TEXT' },
  { key: 'fontSize', name: 'Font Size', type: 'number', min: 20, max: 400, default: 80, folder: 'TEXT' },
  { key: 'fontWeight', name: 'Font Weight', type: 'select', options: [
    { label: 'Thin', value: '100' },
    { label: 'Light', value: '300' },
    { label: 'Regular', value: '400' },
    { label: 'Bold', value: '700' },
    { label: 'Black', value: '900' },
  ], default: '900', folder: 'TEXT' },
  { key: 'cellSize', name: 'Cell Size', type: 'number', min: 3, max: 50, default: 12, folder: 'TEXT' },

  // SHAPE
  { key: 'shapeType', name: 'Shape Type', type: 'select', options: [
    { label: 'Rectangle', value: 'rectangle' },
    { label: 'Circle', value: 'circle' },
    { label: 'Triangle', value: 'triangle' },
    { label: 'Diamond', value: 'diamond' },
    { label: 'Arrow', value: 'arrow' },
    { label: 'Star', value: 'star' },
    { label: 'Cross', value: 'cross' },
    { label: 'Line', value: 'line' },
    { label: 'Dot', value: 'dot' },
  ], default: 'rectangle', folder: 'SHAPE' },
  { key: 'arrangeShapes', name: 'Arrange Shapes', type: 'select', options: [
    { label: 'Backward Order', value: 'backward' },
    { label: 'Forward Order', value: 'forward' },
  ], default: 'backward', folder: 'SHAPE' },
  { key: 'shapeSizeX', name: 'Shape Size (X)', type: 'number', min: 0.1, max: 10, step: 0.05, default: 2.25, folder: 'SHAPE' },
  { key: 'shapeSizeY', name: 'Shape Size (Y)', type: 'number', min: 0.1, max: 10, step: 0.05, default: 1.50, folder: 'SHAPE' },
  { key: 'rotation', name: 'Rotation', type: 'number', min: -180, max: 180, step: 1, default: 35, folder: 'SHAPE' },
  { key: 'strokeWeight', name: 'Stroke Weight', type: 'number', min: 0.5, max: 8, step: 0.5, default: 1.5, folder: 'SHAPE' },

  // COLOR
  { key: 'fillType', name: 'Fill Type', type: 'select', options: [
    { label: 'Gradient', value: 'gradient' },
    { label: 'Solid', value: 'solid' },
  ], default: 'gradient', folder: 'COLOR' },
  { key: 'angle', name: 'Angle', type: 'number', min: 0, max: 360, step: 1, default: 180, folder: 'COLOR' },
  { key: 'softness', name: 'Softness', type: 'number', min: 0, max: 1, step: 0.01, default: 0.01, folder: 'COLOR' },
  { key: 'offset', name: 'Offset', type: 'number', min: -1, max: 1, step: 0.01, default: -0.19, folder: 'COLOR' },
  { key: 'firstColor', name: 'First Color', type: 'color', default: '#ffffff', folder: 'COLOR' },
  { key: 'secondColor', name: 'Second Color', type: 'color', default: '#ffaa00', folder: 'COLOR' },

  // MOTION
  { key: 'distribution', name: 'Distribution', type: 'select', options: [
    { label: 'Uniform', value: 'uniform' },
    { label: 'Noise', value: 'noise' },
    { label: 'Sine', value: 'sine' },
  ], default: 'uniform', folder: 'MOTION' },
  { key: 'amplify', name: 'Amplify', type: 'number', min: 0, max: 100, default: 0, folder: 'MOTION' },
  { key: 'loopSpeed', name: 'Loop Speed', type: 'number', min: 0, max: 10, step: 0.1, default: 0.0, folder: 'MOTION' },
  { key: 'motionPosition', name: 'Position', type: 'number', min: 0, max: 100, default: 0, folder: 'MOTION' },
  { key: 'easeLevel', name: 'Ease Level', type: 'number', min: 0, max: 10, step: 0.1, default: 1, folder: 'MOTION' },
];

// --- Engine ---

export class RastrEngine implements LayerEngine {
  private activePixels: { x: number; y: number }[] = [];
  private lastParamsStr = '';
  private offCanvas: HTMLCanvasElement | null = null;

  setup(_p: p5, _w: number, _h: number, params: Record<string, any>): void {
    if (typeof window !== 'undefined') {
      this.offCanvas = document.createElement('canvas');
      this.updateRastrCache(params, _w, _h);
    }
  }

  dispose(): void {
    if (this.offCanvas) {
      this.offCanvas.remove();
      this.offCanvas = null;
    }
  }

  draw(pg: p5.Graphics, _p: p5, time: number, params: Record<string, any>): void {
    pg.clear();
    const ctx = pg.drawingContext as CanvasRenderingContext2D;

    const cacheKey = `${params.source}_${params.text}_${params.fontSize}_${params.fontWeight}_${params.cellSize}_${pg.width}_${pg.height}`;
    if (this.lastParamsStr !== cacheKey) {
      this.updateRastrCache(params, pg.width, pg.height);
      this.lastParamsStr = cacheKey;
    }

    if (this.activePixels.length === 0) return;

    const phase = time * params.loopSpeed + (params.motionPosition ?? 0) * 0.1;
    const ease: number = params.easeLevel ?? 1;
    const baseW = params.cellSize * params.shapeSizeX;
    const baseH = params.cellSize * params.shapeSizeY;
    const sw: number = params.strokeWeight ?? 1.5;

    // --- Color setup (drawn directly on the 2D context for reliable gradients) ---
    let paint: string | CanvasGradient = params.firstColor;
    if (params.fillType === 'gradient') {
      const rad = (params.angle * Math.PI) / 180;
      const grad = ctx.createLinearGradient(
        pg.width / 2 + Math.cos(rad) * pg.width,
        pg.height / 2 + Math.sin(rad) * pg.height,
        pg.width / 2 - Math.cos(rad) * pg.width,
        pg.height / 2 - Math.sin(rad) * pg.height,
      );
      let stop1 = Math.max(0, Math.min(1, 0.5 + params.offset - params.softness));
      let stop2 = Math.max(0, Math.min(1, 0.5 + params.offset + params.softness));
      if (stop2 <= stop1) stop2 = Math.min(1, stop1 + 0.0001);
      grad.addColorStop(stop1, params.firstColor);
      grad.addColorStop(stop2, params.secondColor);
      paint = grad;
    }

    // --- Sort ---
    const pixelsToDraw = [...this.activePixels];
    if (params.arrangeShapes === 'backward') {
      pixelsToDraw.sort((a, b) => (a.y + a.x) - (b.y + b.x));
    } else {
      pixelsToDraw.sort((a, b) => (b.y + b.x) - (a.y + a.x));
    }

    const rot = (params.rotation * Math.PI) / 180;
    const stroked = params.shapeType === 'cross' || params.shapeType === 'line';
    ctx.save();
    ctx.fillStyle = paint;
    ctx.strokeStyle = paint;
    ctx.lineWidth = sw;

    for (const pt of pixelsToDraw) {
      let offsetX = 0;
      let offsetY = 0;
      if (params.amplify > 0) {
        if (params.distribution === 'sine') {
          offsetY = applyEase(Math.sin(phase * 3 + pt.x * 0.01 + pt.y * 0.01), ease) * params.amplify;
        } else if (params.distribution === 'noise') {
          const seed = Math.sin(phase * 5 + pt.x * 0.05 + pt.y * 0.05) * 43758.5453;
          const raw = (seed - Math.floor(seed)) - 0.5;
          offsetX = applyEase(raw, ease) * params.amplify;
          offsetY = applyEase(raw, ease) * params.amplify;
        } else {
          offsetX = applyEase(Math.sin(phase), ease) * params.amplify * 0.1;
          offsetY = applyEase(Math.cos(phase), ease) * params.amplify * 0.1;
        }
      }

      ctx.save();
      ctx.translate(pt.x + offsetX, pt.y + offsetY);
      ctx.rotate(rot);
      drawShapePath(ctx, params.shapeType, baseW, baseH, params.cellSize);
      if (stroked) ctx.stroke(); else ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private updateRastrCache(params: Record<string, any>, width: number, height: number) {
    // Full-grid mode: fill the whole canvas with shape cells (no text gating).
    if (params.source === 'fill') {
      const cs = Math.max(2, params.cellSize);
      this.activePixels = [];
      for (let y = Math.floor(cs / 2); y < height; y += cs) {
        for (let x = Math.floor(cs / 2); x < width; x += cs) {
          this.activePixels.push({ x, y });
        }
      }
      return;
    }

    if (!this.offCanvas) return;

    const cvs = this.offCanvas;
    cvs.width = width;
    cvs.height = height;

    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, cvs.width, cvs.height);

    const weight = params.fontWeight ?? '900';
    ctx.font = `${weight} ${params.fontSize}px "Google Sans Flex Variable", Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';

    const lines = params.text.split('\\n');
    const lineHeight = params.fontSize * 1.1;
    const totalHeight = (lines.length - 1) * lineHeight;
    let startY = height / 2 - totalHeight / 2;

    for (const line of lines) {
      ctx.fillText(line, width / 2, startY);
      startY += lineHeight;
    }

    const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
    const cellSize = params.cellSize;
    this.activePixels = [];

    for (let y = 0; y < cvs.height; y += cellSize) {
      for (let x = 0; x < cvs.width; x += cellSize) {
        const i = (y * cvs.width + x) * 4;
        if (imgData[i + 3] > 128) {
          this.activePixels.push({ x, y });
        }
      }
    }
  }
}

// --- Helpers ---

function applyEase(value: number, ease: number): number {
  if (ease === 1) return value;
  return Math.sign(value) * Math.pow(Math.abs(value), ease);
}

/** Build a shape path centred at the current origin (no fill/stroke applied). */
function drawShapePath(ctx: CanvasRenderingContext2D, type: string, baseW: number, baseH: number, cellSize: number): void {
  const hw = baseW / 2;
  const hh = baseH / 2;
  ctx.beginPath();
  switch (type) {
    case 'circle':
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(0, -hh); ctx.lineTo(hw, hh); ctx.lineTo(-hw, hh); ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(0, -hh); ctx.lineTo(hw, 0); ctx.lineTo(0, hh); ctx.lineTo(-hw, 0); ctx.closePath();
      break;
    case 'arrow':
      ctx.moveTo(-hw, -hh); ctx.lineTo(hw, 0); ctx.lineTo(-hw, hh); ctx.closePath();
      break;
    case 'star': {
      const ir = Math.min(hw, hh) * 0.38;
      ctx.moveTo(0, -hh); ctx.lineTo(ir, -ir); ctx.lineTo(hw, 0); ctx.lineTo(ir, ir);
      ctx.lineTo(0, hh); ctx.lineTo(-ir, ir); ctx.lineTo(-hw, 0); ctx.lineTo(-ir, -ir); ctx.closePath();
      break;
    }
    case 'cross':
      ctx.moveTo(-hw, 0); ctx.lineTo(hw, 0); ctx.moveTo(0, -hh); ctx.lineTo(0, hh);
      break;
    case 'line':
      ctx.moveTo(-hw, hh); ctx.lineTo(hw, -hh);
      break;
    case 'dot': {
      const r = cellSize * 0.3;
      ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
      break;
    }
    case 'rectangle':
    default:
      ctx.rect(-hw, -hh, baseW, baseH);
      break;
  }
}
