/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Layer, ModSource, ParamModulation } from './types';
import { engineRegistry } from './engine-registry';

// ---------------------------------------------------------------------------
// Modulation — binds live input signals (mic audio, mouse, LFO) to numeric
// layer params. Signals are sampled once per frame in the render loop and
// applied on top of the layer's base params, so the stored PosterState never
// changes while reacting (templates/undo stay clean).
//
//   effective = clamp(base + signal * amount * (paramMax - paramMin))
//
// audioLevel/audioBass/audioTreble and mouseX/mouseY are unipolar 0..1
// (silence / left / top = base value). lfo is a bipolar sine (-1..1) at
// `speed` Hz, oscillating around the base value.
// ---------------------------------------------------------------------------

export const MOD_SOURCES: { value: ModSource; label: string }[] = [
  { value: 'audioLevel', label: 'Audio · Level' },
  { value: 'audioBass', label: 'Audio · Bass' },
  { value: 'audioTreble', label: 'Audio · Treble' },
  { value: 'mouseX', label: 'Mouse X' },
  { value: 'mouseY', label: 'Mouse Y' },
  { value: 'lfo', label: 'LFO (sine)' },
];

export interface ModSignals {
  audioLevel: number;
  audioBass: number;
  audioTreble: number;
  mouseX: number;
  mouseY: number;
}

// --- Mouse (no permission needed; lazy global listener) ----------------------

let mouseX = 0.5;
let mouseY = 0.5;
let mouseListenerAttached = false;

function ensureMouseListener(): void {
  if (mouseListenerAttached || typeof window === 'undefined') return;
  mouseListenerAttached = true;
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX / window.innerWidth;
    mouseY = e.clientY / window.innerHeight;
  }, { passive: true });
}

// --- Microphone (user-gesture gated) -----------------------------------------

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let micStream: MediaStream | null = null;
let freqData: Uint8Array | null = null;

export function isAudioEnabled(): boolean {
  return analyser !== null;
}

/** Start mic capture. Call from a click handler (browser gesture requirement). */
export async function enableAudio(): Promise<boolean> {
  if (analyser) return true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    src.connect(analyser);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    return true;
  } catch {
    disableAudio();
    return false;
  }
}

export function disableAudio(): void {
  micStream?.getTracks().forEach((t) => t.stop());
  audioCtx?.close().catch(() => {});
  micStream = null;
  audioCtx = null;
  analyser = null;
  freqData = null;
}

function readAudio(): { level: number; bass: number; treble: number } {
  if (!analyser || !freqData) return { level: 0, bass: 0, treble: 0 };
  analyser.getByteFrequencyData(freqData as Uint8Array<ArrayBuffer>);
  const n = freqData.length; // 256 bins ≈ 0..24kHz
  const avg = (from: number, to: number) => {
    let sum = 0;
    for (let i = from; i < to; i++) sum += freqData![i];
    return sum / ((to - from) * 255);
  };
  return {
    level: avg(0, n),
    bass: avg(0, Math.floor(n * 0.06)),      // ~0–1.4kHz low end
    treble: avg(Math.floor(n * 0.25), n),    // ~6kHz+
  };
}

// --- Per-frame sampling + application ----------------------------------------

/** Sample all live signals once per frame. */
export function getModSignals(): ModSignals {
  ensureMouseListener();
  const a = readAudio();
  return { audioLevel: a.level, audioBass: a.bass, audioTreble: a.treble, mouseX, mouseY };
}

function signalValue(mod: ParamModulation, signals: ModSignals, time: number): number {
  if (mod.source === 'lfo') return Math.sin(2 * Math.PI * (mod.speed ?? 0.25) * time);
  return signals[mod.source] ?? 0;
}

/**
 * Compute the effective params for a layer this frame. Only numeric params
 * with a defined min/max in the engine's ControlParam list can be modulated;
 * everything else passes through. Returns the base object untouched when the
 * layer has no bindings (no per-frame allocation in the common case).
 */
export function applyModulations(
  layer: Layer,
  signals: ModSignals,
  time: number,
): Record<string, any> {
  const mods = layer.modulations;
  if (!mods) return layer.params;
  const keys = Object.keys(mods);
  if (keys.length === 0) return layer.params;

  const defs = engineRegistry[layer.engineType]?.params;
  if (!defs) return layer.params;

  const out = { ...layer.params };
  for (const key of keys) {
    const def = defs.find((d) => d.key === key);
    if (!def || def.type !== 'number' || def.min === undefined || def.max === undefined) continue;
    const base = typeof out[key] === 'number' ? out[key] : def.default;
    const mod = mods[key];
    const v = base + signalValue(mod, signals, time) * mod.amount * (def.max - def.min);
    out[key] = Math.min(def.max, Math.max(def.min, v));
  }
  return out;
}

/** Numeric, range-bounded params of an engine — the modulate-able ones. */
export function modulatableParams(engineType: Layer['engineType']) {
  return engineRegistry[engineType].params.filter(
    (p) => p.type === 'number' && p.min !== undefined && p.max !== undefined,
  );
}
