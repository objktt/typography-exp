'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { PosterState, Layer, EngineType, BlendMode, LayerEngine } from '@/lib/types';
import { engineRegistry, getDefaultParams } from '@/lib/engine-registry';
import { ditherPresets } from '@/lib/dither-utils';
import { rastrPresets } from '@/lib/rastr-engine';

let layerCounter = 0;

function createLayerId(): string {
  return `layer-${++layerCounter}-${Date.now().toString(36)}`;
}

export function usePosterState() {
  const [state, setState] = useState<PosterState>({
    canvasRatio: '1:1',
    backgroundColor: '#1a1a1a',
    layers: [],
    selectedLayerId: null,
  });

  const engineInstances = useRef<Map<string, LayerEngine>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const engine of engineInstances.current.values()) {
        engine.dispose?.();
      }
      engineInstances.current.clear();
    };
  }, []);

  const addLayer = useCallback((engineType: EngineType): string => {
    const id = createLayerId();
    const entry = engineRegistry[engineType];
    const engine = entry.createEngine();
    engineInstances.current.set(id, engine);

    const layer: Layer = {
      id,
      name: entry.defaultName,
      engineType,
      visible: true,
      opacity: 1,
      blendMode: 'source-over',
      params: getDefaultParams(engineType),
    };

    setState(prev => ({
      ...prev,
      layers: [...prev.layers, layer],
      selectedLayerId: id,
    }));

    return id;
  }, []);

  const removeLayer = useCallback((layerId: string) => {
    const engine = engineInstances.current.get(layerId);
    if (engine) {
      engine.dispose?.();
      engineInstances.current.delete(layerId);
    }

    setState(prev => {
      const newLayers = prev.layers.filter(l => l.id !== layerId);
      const newSelected = prev.selectedLayerId === layerId
        ? (newLayers.length > 0 ? newLayers[newLayers.length - 1].id : null)
        : prev.selectedLayerId;
      return { ...prev, layers: newLayers, selectedLayerId: newSelected };
    });
  }, []);

  const reorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newLayers = [...prev.layers];
      const [moved] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, moved);
      return { ...prev, layers: newLayers };
    });
  }, []);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setState(prev => ({
      ...prev,
      layers: prev.layers.map(l =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      ),
    }));
  }, []);

  const updateLayerParam = useCallback((layerId: string, key: string, value: any) => {
    setState(prev => {
      const layer = prev.layers.find(l => l.id === layerId);
      if (!layer) return prev;

      // Handle dither preset expansion
      const isDitherEngine = layer.engineType === 'dither' || layer.engineType === 'img-dither';
      if (isDitherEngine && key === 'preset' && value && ditherPresets[value]) {
        const preset = ditherPresets[value];
        return {
          ...prev,
          layers: prev.layers.map(l =>
            l.id === layerId
              ? {
                  ...l,
                  params: {
                    ...l.params,
                    preset: value,
                    ditherType: preset.ditherType,
                    foregroundColor: preset.foregroundColor,
                    backgroundColor: preset.backgroundColor,
                    threshold: preset.threshold,
                    pixelSize: preset.pixelSize,
                    invert: preset.invert,
                    contrast: preset.contrast,
                    brightness: preset.brightness,
                    colorMode: preset.colorMode,
                    ditherScale: preset.ditherScale,
                    posterization: preset.posterization,
                    saturation: preset.saturation,
                  },
                }
              : l
          ),
        };
      }

      // Handle rastr preset expansion
      if (layer.engineType === 'rastr' && key === 'preset' && value && rastrPresets[value]) {
        const preset = rastrPresets[value];
        return {
          ...prev,
          layers: prev.layers.map(l =>
            l.id === layerId
              ? {
                  ...l,
                  params: {
                    ...l.params,
                    preset: value,
                    cellSize: preset.cellSize,
                    shapeType: preset.shapeType,
                    arrangeShapes: preset.arrangeShapes,
                    shapeSizeX: preset.shapeSizeX,
                    shapeSizeY: preset.shapeSizeY,
                    rotation: preset.rotation,
                    strokeWeight: preset.strokeWeight,
                    fillType: preset.fillType,
                    angle: preset.angle,
                    softness: preset.softness,
                    offset: preset.offset,
                    firstColor: preset.firstColor,
                    secondColor: preset.secondColor,
                    distribution: preset.distribution,
                    amplify: preset.amplify,
                    loopSpeed: preset.loopSpeed,
                  },
                }
              : l
          ),
        };
      }

      return {
        ...prev,
        layers: prev.layers.map(l =>
          l.id === layerId ? { ...l, params: { ...l.params, [key]: value } } : l
        ),
      };
    });
  }, []);

  const updateLayerMeta = useCallback((layerId: string, meta: { name?: string; opacity?: number; blendMode?: BlendMode }) => {
    setState(prev => ({
      ...prev,
      layers: prev.layers.map(l =>
        l.id === layerId ? { ...l, ...meta } : l
      ),
    }));
  }, []);

  const selectLayer = useCallback((layerId: string | null) => {
    setState(prev => ({ ...prev, selectedLayerId: layerId }));
  }, []);

  // Replace the whole poster (e.g. from the generator). Rebuilds engine instances.
  const loadPoster = useCallback((poster: PosterState) => {
    for (const engine of engineInstances.current.values()) engine.dispose?.();
    engineInstances.current.clear();
    for (const layer of poster.layers) {
      const entry = engineRegistry[layer.engineType];
      if (entry) engineInstances.current.set(layer.id, entry.createEngine());
    }
    setState(poster);
  }, []);

  const updateCanvas = useCallback((updates: { canvasRatio?: string; backgroundColor?: string }) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId) ?? null;

  return {
    state,
    engineInstances: engineInstances.current,
    selectedLayer,
    addLayer,
    removeLayer,
    reorderLayers,
    toggleLayerVisibility,
    updateLayerParam,
    updateLayerMeta,
    selectLayer,
    updateCanvas,
    loadPoster,
  };
}
