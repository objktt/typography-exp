'use client';

import { useState } from 'react';
import type { Layer, BlendMode, ModSource, ParamModulation } from '@/lib/types';
import { engineRegistry } from '@/lib/engine-registry';
import { MOD_SOURCES, modulatableParams } from '@/lib/modulation';
import { CustomParamsPanel } from './CustomParamsPanel';
import { GiphyGrid, type GifResult } from './GiphyGrid';
import { ModelGrid } from './ModelGrid';
import type { ModelResult } from '@/lib/poly';

interface LayerInspectorProps {
  layer: Layer;
  onParamChange: (layerId: string, key: string, value: any) => void;
  onMetaChange: (layerId: string, meta: { name?: string; opacity?: number; blendMode?: BlendMode }) => void;
  onModChange: (layerId: string, paramKey: string, mod: ParamModulation | null) => void;
}

const blendModes: { label: string; value: BlendMode }[] = [
  { label: 'Normal', value: 'source-over' },
  { label: 'Multiply', value: 'multiply' },
  { label: 'Screen', value: 'screen' },
  { label: 'Overlay', value: 'overlay' },
  { label: 'Darken', value: 'darken' },
  { label: 'Lighten', value: 'lighten' },
  { label: 'Color Dodge', value: 'color-dodge' },
  { label: 'Color Burn', value: 'color-burn' },
  { label: 'Hard Light', value: 'hard-light' },
  { label: 'Soft Light', value: 'soft-light' },
  { label: 'Difference', value: 'difference' },
  { label: 'Exclusion', value: 'exclusion' },
];

export function LayerInspector({ layer, onParamChange, onMetaChange, onModChange }: LayerInspectorProps) {
  const entry = engineRegistry[layer.engineType];

  const handleGifSelect = (gif: GifResult) => {
    onParamChange(layer.id, 'imageSource', gif.mp4Url);
  };

  const handleModelSelect = (m: ModelResult) => {
    onParamChange(layer.id, 'shape', 'model');
    onParamChange(layer.id, 'modelSource', m.glb);
  };

  return (
    <div className="space-y-3">
      {/* Layer Meta */}
      <div className="space-y-1.5">
        <h4 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">
          Layer
        </h4>
        <div className="space-y-1">
          {/* Name */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-400 w-20 shrink-0">Name</label>
            <input
              type="text"
              value={layer.name}
              onChange={(e) => onMetaChange(layer.id, { name: e.target.value })}
              className="flex-1 px-2 py-1 text-xs bg-[#222] border border-[#333] rounded text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Opacity */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-400 w-20 shrink-0">Opacity</label>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={layer.opacity}
                onChange={(e) => onMetaChange(layer.id, { opacity: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-[10px] text-gray-500 w-8 text-right">{Math.round(layer.opacity * 100)}%</span>
            </div>
          </div>

          {/* Blend Mode */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-400 w-20 shrink-0">Blend</label>
            <select
              value={layer.blendMode}
              onChange={(e) => onMetaChange(layer.id, { blendMode: e.target.value as BlendMode })}
              className="flex-1 px-2 py-1 text-xs bg-[#222] border border-[#333] rounded text-white focus:outline-none focus:border-blue-500"
            >
              {blendModes.map((bm) => (
                <option key={bm.value} value={bm.value}>{bm.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* GIF Search for img-dither layers */}
      {layer.engineType === 'img-dither' && (
        <div className="space-y-2">
          <h4 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">GIF Search</h4>
          <GiphyGrid onSelectGif={handleGifSelect} compact />
        </div>
      )}

      {/* 3D model search for object3d layers */}
      {layer.engineType === 'object3d' && (
        <div className="space-y-2">
          <h4 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">3D Model Search</h4>
          <ModelGrid onSelect={handleModelSelect} />
        </div>
      )}

      {/* Engine Params */}
      <div className="space-y-2">
        <h4 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">
          {entry.label} Settings
        </h4>
        <CustomParamsPanel
          params={entry.params}
          values={layer.params}
          onChange={(key, value) => onParamChange(layer.id, key, value)}
        />
      </div>

      <ModulationSection layer={layer} onModChange={onModChange} />
    </div>
  );
}

// Bind numeric params to live inputs (mic / mouse / LFO). Audio sources need
// the Mic toggle in the top bar to be on.
function ModulationSection({ layer, onModChange }: { layer: Layer; onModChange: LayerInspectorProps['onModChange'] }) {
  const candidates = modulatableParams(layer.engineType);
  const mods = layer.modulations ?? {};
  const unbound = candidates.filter((p) => !(p.key in mods));
  const [pick, setPick] = useState('');

  if (candidates.length === 0) return null;

  const nameOf = (key: string) => candidates.find((p) => p.key === key)?.name ?? key;

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Reactivity</h4>

      {Object.entries(mods).map(([key, mod]) => (
        <div key={key} className="space-y-1 p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-300 font-medium">{nameOf(key)}</span>
            <button onClick={() => onModChange(layer.id, key, null)} className="text-gray-600 hover:text-red-400 text-[10px]">✕</button>
          </div>
          <select
            value={mod.source}
            onChange={(e) => onModChange(layer.id, key, { ...mod, source: e.target.value as ModSource })}
            className="w-full px-1.5 py-1 text-[10px] bg-[#222] border border-[#333] rounded text-white focus:outline-none focus:border-blue-500"
          >
            {MOD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-12 shrink-0">Amount</span>
            <input
              type="range" min={-1} max={1} step={0.01} value={mod.amount}
              onChange={(e) => onModChange(layer.id, key, { ...mod, amount: parseFloat(e.target.value) })}
              className="flex-1 h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer accent-purple-500"
            />
            <span className="text-[10px] text-gray-500 w-8 text-right">{Math.round(mod.amount * 100)}%</span>
          </div>
          {mod.source === 'lfo' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-12 shrink-0">Speed</span>
              <input
                type="range" min={0.05} max={4} step={0.05} value={mod.speed ?? 0.25}
                onChange={(e) => onModChange(layer.id, key, { ...mod, speed: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer accent-purple-500"
              />
              <span className="text-[10px] text-gray-500 w-8 text-right">{(mod.speed ?? 0.25).toFixed(2)}Hz</span>
            </div>
          )}
        </div>
      ))}

      {unbound.length > 0 && (
        <div className="flex gap-1">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="flex-1 px-1.5 py-1 text-[10px] bg-[#222] border border-[#333] rounded text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">+ Bind a param to live input…</option>
            {unbound.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!pick) return;
              onModChange(layer.id, pick, { source: 'audioLevel', amount: 0.3 });
              setPick('');
            }}
            disabled={!pick}
            className="px-2 py-1 text-[10px] bg-[#222] border border-[#333] rounded text-gray-300 hover:text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
