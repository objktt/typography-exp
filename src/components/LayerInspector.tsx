'use client';

import type { Layer, BlendMode } from '@/lib/types';
import { engineRegistry } from '@/lib/engine-registry';
import { CustomParamsPanel } from './CustomParamsPanel';
import { GiphyGrid, type GifResult } from './GiphyGrid';
import { ModelGrid } from './ModelGrid';
import type { ModelResult } from '@/lib/poly';

interface LayerInspectorProps {
  layer: Layer;
  onParamChange: (layerId: string, key: string, value: any) => void;
  onMetaChange: (layerId: string, meta: { name?: string; opacity?: number; blendMode?: BlendMode }) => void;
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

export function LayerInspector({ layer, onParamChange, onMetaChange }: LayerInspectorProps) {
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
    </div>
  );
}
