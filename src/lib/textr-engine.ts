import type p5 from 'p5';
import type { ControlParam, LayerEngine } from './types';

export const textrParams: ControlParam[] = [
  // TEXT
  { key: 'text', name: 'Text Field', type: 'string', default: 'UP AND DOWN', folder: 'TEXT' },
  { key: 'textColor', name: 'Text Color', type: 'color', default: '#ffffff', folder: 'TEXT' },
  { key: 'fontSize', name: 'Font Size', type: 'number', min: 10, max: 200, default: 31, folder: 'TEXT' },
  { key: 'interval', name: 'Interval', type: 'number', min: 0, max: 50, default: 7.0, folder: 'TEXT' },

  // CONTENT
  { key: 'layoutType', name: 'Layout Type', type: 'select', options: [{ label: 'Vertical Direction', value: 'vertical' }, { label: 'Horizontal Direction', value: 'horizontal' }], default: 'vertical', folder: 'CONTENT' },
  { key: 'rowAmount', name: 'Row Amount', type: 'number', min: 1, max: 200, default: 90, folder: 'CONTENT' },
  { key: 'arrangeType', name: 'Arrange Type', type: 'select', options: [{ label: 'Split by Letter', value: 'letter' }, { label: 'Split by Word', value: 'word' }], default: 'letter', folder: 'CONTENT' },
  { key: 'columnMargins', name: 'Column Margins', type: 'number', min: 0, max: 5, step: 0.01, default: 0.93, folder: 'CONTENT' },
  { key: 'collisionCheck', name: 'Collision Check', type: 'boolean', default: true, folder: 'CONTENT' },
  { key: 'collisionSpace', name: 'Collision Space', type: 'number', min: 0, max: 10, step: 0.1, default: 1.0, folder: 'CONTENT' },

  // MOTION
  { key: 'scrollingSpeed', name: 'Scrolling Speed', type: 'number', min: -100, max: 100, step: 1, default: 0, folder: 'MOTION' },
  { key: 'baseMode', name: 'Base Mode', type: 'select', options: [{ label: 'Noise', value: 'noise' }, { label: 'Field', value: 'field' }, { label: 'Cylinder', value: 'cylinder' }, { label: 'Cascade', value: 'cascade' }], default: 'noise', folder: 'MOTION' },
  { key: 'amplitudeMode', name: 'Amplitude Mode', type: 'select', options: [{ label: 'Easing To Side (0 -> 1)', value: 'easing_to_side' }], default: 'easing_to_side', folder: 'MOTION' },
  { key: 'easingType1', name: 'Easing Type 1', type: 'select', options: [{ label: 'Circ Out', value: 'circOut' }], default: 'circOut', folder: 'MOTION' },
  { key: 'amplitude', name: 'Amplitude', type: 'number', min: 0, max: 200, default: 29, folder: 'MOTION' },
  { key: 'easingType2', name: 'Easing Type 2', type: 'select', options: [{ label: 'Circ In', value: 'circIn' }], default: 'circIn', folder: 'MOTION' },
  { key: 'frequencyX', name: 'Freq X', type: 'number', min: 0.1, max: 5, step: 0.01, default: 1.00, folder: 'MOTION' },
  { key: 'frequencyY', name: 'Freq Y', type: 'number', min: 0.1, max: 5, step: 0.01, default: 1.00, folder: 'MOTION' },
  { key: 'motionSpeed', name: 'Motion Speed', type: 'number', min: 0, max: 2, step: 0.01, default: 0.04, folder: 'MOTION' },
  { key: 'noiseSeed', name: 'Noise Seed', type: 'number', min: 0, max: 1000, default: 248, step: 1, folder: 'MOTION' }
];

function sinEngine(t: number, x: number, xLen: number, y: number, yLen: number, speed: number, slope: number) {
  const vx = xLen === 0 ? 0 : (x / xLen) * Math.PI * 2;
  const vy = yLen === 0 ? 0 : (y / yLen) * Math.PI * 2;
  const phase = vx + vy + t * speed * Math.PI;
  return Math.sin(phase) * slope;
}

function perspProject(x: number, y: number, z: number, fov: number, cx: number, cy: number) {
  const depth = Math.max(0.1, fov + z);
  const scale = fov / depth;
  return {
    x: (x - cx) * scale + cx,
    y: (y - cy) * scale + cy,
    s: scale
  };
}

function gridPos(i: number, cols: number, xSpace: number, ySpace: number) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  return { x: col * xSpace, y: row * ySpace };
}

export class TextrEngine implements LayerEngine {
  private p5Ref: p5 | null = null;

  setup(p: p5, _w: number, _h: number, _params: Record<string, any>): void {
    this.p5Ref = p;
  }

  dispose(): void {
    this.p5Ref = null;
  }

  draw(pg: p5.Graphics, p: p5, time: number, params: Record<string, any>): void {
    pg.clear();

    const chars = params.text.split(params.arrangeType === 'word' ? ' ' : '');
    if (chars.length === 0) return;

    pg.fill(params.textColor);
    pg.noStroke();
    pg.textAlign(pg.CENTER, pg.CENTER);
    pg.textFont('"Google Sans Flex Variable", sans-serif');
    pg.textStyle(pg.BOLD);
    pg.textSize(params.fontSize);

    const mode = params.baseMode;

    if (mode === 'field') {
      this.renderField(pg, p, time, params, chars);
    } else if (mode === 'cylinder') {
      this.renderCylinder(pg, p, time, params, chars);
    } else if (mode === 'cascade') {
      this.renderCascade(pg, time, params, chars);
    } else if (mode === 'noise') {
      this.renderNoise(pg, p, time, params, chars);
    }
  }

  private renderField(pg: p5.Graphics, _p: p5, t: number, pr: Record<string, any>, chars: string[]) {
    const cols = chars.length;
    const rows = pr.rowAmount;
    const total = cols * rows;

    const xSpace = pr.fontSize * pr.columnMargins;
    const ySpace = pr.fontSize + pr.interval;
    const cx = pg.width / 2;
    const cy = pg.height / 2;
    const gridW = (cols - 1) * xSpace;
    const gridH = (rows - 1) * ySpace;
    const ox = cx - gridW / 2;
    const oy = cy - gridH / 2 + (t * pr.scrollingSpeed) % ySpace;
    const fov = 600;

    for (let i = 0; i < total; i++) {
      const ch = chars[i % cols];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const gp = gridPos(i, cols, xSpace, ySpace);

      const dx = sinEngine(t, col, pr.frequencyX, row, pr.frequencyY * 0.7, pr.motionSpeed, 1) * (pr.amplitude * 0.5);
      const dy = sinEngine(t, row, pr.frequencyY * 0.8, col, pr.frequencyX, pr.motionSpeed * 0.9, 1) * (pr.amplitude * 0.5);
      const dz = sinEngine(t, col, pr.frequencyX * 1.2, row, pr.frequencyY * 0.5, pr.motionSpeed * 0.7, 1) * pr.amplitude;

      const wx = ox + gp.x + dx;
      const wy = oy + gp.y + dy;
      const proj = perspProject(wx, wy, dz * 3, fov, cx, cy);

      const dzNext = sinEngine(t, col + 1, pr.frequencyX * 1.2, row, pr.frequencyY * 0.5, pr.motionSpeed * 0.7, 1) * pr.amplitude;
      const rot = Math.atan2(dzNext - dz, xSpace) * 0.5;

      pg.push();
      const alpha = Math.max(30, Math.min(255, proj.s * 255));
      (pg.drawingContext as CanvasRenderingContext2D).globalAlpha = alpha / 255;

      pg.translate(proj.x, proj.y);
      pg.rotate(rot);
      pg.scale(proj.s);
      pg.text(ch, 0, 0);
      pg.pop();
    }
  }

  private renderCylinder(pg: p5.Graphics, _p: p5, t: number, pr: Record<string, any>, chars: string[]) {
    const cols = chars.length;
    const rows = pr.rowAmount;
    const total = cols * rows;

    const ySpace = pr.fontSize + pr.interval;
    const cx = pg.width / 2;
    const cy = pg.height / 2;
    const gridH = (rows - 1) * ySpace;
    const oy = cy - gridH / 2 + (t * pr.scrollingSpeed) % ySpace;
    const fov = 600;
    const angleStep = (2 * Math.PI) / cols;
    const radius = Math.max(100, cols * pr.fontSize * 0.3 * pr.columnMargins);

    const items: { ch: string; wx: number; wy: number; wz: number }[] = [];
    for (let i = 0; i < total; i++) {
      const ch = chars[i % cols];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const angle = col * angleStep + t * pr.motionSpeed;
      const cylX = Math.cos(angle) * radius;
      const cylZ = Math.sin(angle) * radius;

      const dy = sinEngine(t, row, pr.frequencyY * 0.8, col, pr.frequencyX, pr.motionSpeed * 0.9, 1) * (pr.amplitude * 0.5);
      const dz = sinEngine(t, col, pr.frequencyX * 1.2, row, pr.frequencyY * 0.5, pr.motionSpeed * 0.7, 1) * pr.amplitude;

      items.push({ ch, wx: cx + cylX, wy: oy + row * ySpace + dy, wz: cylZ + dz * 3 });
    }

    items.sort((a, b) => a.wz - b.wz);

    for (const item of items) {
      const proj = perspProject(item.wx, item.wy, item.wz, fov, cx, cy);
      if (proj.s < 0.1) continue;

      pg.push();
      const alpha = Math.max(25, Math.min(255, proj.s * 1.2 * 255));
      (pg.drawingContext as CanvasRenderingContext2D).globalAlpha = alpha / 255;

      pg.translate(proj.x, proj.y);
      pg.scale(proj.s);
      pg.text(item.ch, 0, 0);
      pg.pop();
    }
  }

  private renderCascade(pg: p5.Graphics, t: number, pr: Record<string, any>, chars: string[]) {
    const cols = chars.length;
    const rows = pr.rowAmount;
    const total = cols * rows;

    const xSpace = pr.fontSize * pr.columnMargins;
    const ySpace = pr.fontSize + pr.interval;
    const cx = pg.width / 2;
    const cy = pg.height / 2;
    const gridW = (cols - 1) * xSpace;
    const gridH = (rows - 1) * ySpace;
    const ox = cx - gridW / 2;
    const oy = cy - gridH / 2 + (t * pr.scrollingSpeed) % ySpace;
    const fov = 600;

    for (let i = 0; i < total; i++) {
      const ch = chars[i % cols];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const gp = gridPos(i, cols, xSpace, ySpace);

      const flowOffset = (row * 0.3 + col * 0.1) * pr.frequencyX;
      const dy = sinEngine(t, row, pr.frequencyY * 0.6, col, pr.frequencyX * 0.2, pr.motionSpeed, 1) * (pr.amplitude * 0.5)
        + Math.sin(t * pr.motionSpeed * 2 + flowOffset) * pr.amplitude * 0.3;

      const dx = sinEngine(t, col, pr.frequencyX * 1.5, row, pr.frequencyY * 0.3, pr.motionSpeed * 0.4, 1) * (pr.amplitude * 0.5);
      const dz = sinEngine(t, col, pr.frequencyX, row, pr.frequencyY * 0.8, pr.motionSpeed * 0.5, 1) * pr.amplitude;

      const wx = ox + gp.x + dx;
      const wy = oy + gp.y + dy;
      const proj = perspProject(wx, wy, dz * 3, fov, cx, cy);

      pg.push();
      const alpha = Math.max(38, Math.min(255, proj.s * 255));
      (pg.drawingContext as CanvasRenderingContext2D).globalAlpha = alpha / 255;

      pg.translate(proj.x, proj.y);
      pg.scale(proj.s);
      pg.text(ch, 0, 0);
      pg.pop();
    }
  }

  private renderNoise(pg: p5.Graphics, p: p5, t: number, pr: Record<string, any>, chars: string[]) {
    p.noiseSeed(pr.noiseSeed);

    const cols = chars.length;
    const rows = pr.rowAmount;
    const total = cols * rows;

    const xSpace = pr.fontSize * pr.columnMargins;
    const ySpace = pr.fontSize + pr.interval;
    const cx = pg.width / 2;
    const cy = pg.height / 2;
    const gridW = (cols - 1) * xSpace;
    const gridH = (rows - 1) * ySpace;
    const ox = cx - gridW / 2;
    const oy = cy - gridH / 2 + (t * pr.scrollingSpeed) % ySpace;
    const fov = 600;

    for (let i = 0; i < total; i++) {
      const ch = chars[i % cols];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const gp = gridPos(i, cols, xSpace, ySpace);

      const nx = p.noise(col * pr.frequencyX * 0.1, row * pr.frequencyY * 0.1, t * pr.motionSpeed) - 0.5;
      const ny = p.noise(col * pr.frequencyX * 0.1 + 100, row * pr.frequencyY * 0.1 + 100, t * pr.motionSpeed) - 0.5;
      const nz = p.noise(col * pr.frequencyX * 0.1 + 200, row * pr.frequencyY * 0.1 + 200, t * pr.motionSpeed) - 0.5;

      const dx = nx * pr.amplitude * 2;
      const dy = ny * pr.amplitude * 2;
      const dz = nz * pr.amplitude * 4;

      const wx = ox + gp.x + dx;
      const wy = oy + gp.y + dy;
      const proj = perspProject(wx, wy, dz * 3, fov, cx, cy);

      pg.push();
      const alpha = Math.max(30, Math.min(255, proj.s * 255));
      (pg.drawingContext as CanvasRenderingContext2D).globalAlpha = alpha / 255;

      pg.translate(proj.x, proj.y);
      pg.scale(proj.s);
      pg.text(ch, 0, 0);
      pg.pop();
    }
  }
}
