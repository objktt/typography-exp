import type p5 from 'p5';

export interface ControlParam {
  key: string;
  name: string;
  type: 'string' | 'number' | 'color' | 'select' | 'boolean' | 'folder' | 'file';
  folder?: string;
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  multiline?: boolean;
  options?: { label: string; value: string | number }[];
  default: any;
}

export type EngineType = 'rastr' | 'textr' | 'dither' | 'img-dither' | 'object3d' | 'label' | 'logo' | 'custom' | 'lottie';

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface LayerEngine {
  setup(p: p5, w: number, h: number, params: Record<string, any>): void;
  draw(pg: p5.Graphics, p: p5, time: number, params: Record<string, any>): void;
  dispose?(): void;
}

/** Live input signals a numeric param can be bound to. */
export type ModSource = 'audioLevel' | 'audioBass' | 'audioTreble' | 'mouseX' | 'mouseY' | 'lfo';

/**
 * Binds one numeric param to a live signal:
 * effective = clamp(base + signal * amount * (paramMax - paramMin)).
 * Audio/mouse signals are 0..1; lfo is a -1..1 sine at `speed` Hz.
 */
export interface ParamModulation {
  source: ModSource;
  amount: number; // -1..1 — fraction of the param's full range
  speed?: number; // lfo only, Hz
}

export interface Layer {
  id: string;
  name: string;
  engineType: EngineType;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  params: Record<string, any>;
  /** Param key → live-input binding. Applied at draw time; base params stay untouched. */
  modulations?: Record<string, ParamModulation>;
}

export interface PosterState {
  canvasRatio: string;
  backgroundColor: string;
  layers: Layer[];
  selectedLayerId: string | null;
}
