'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback, useEffect } from 'react';
import type { PosterState, Layer, EngineType, BlendMode, LayerEngine, ParamModulation } from '@/lib/types';
import { engineRegistry, getDefaultParams } from '@/lib/engine-registry';
import { ditherPresets } from '@/lib/dither-utils';
import { rastrPresets } from '@/lib/rastr-engine';

let layerCounter = 0;

function createLayerId(): string {
  return `layer-${++layerCounter}-${Date.now().toString(36)}`;
}

const AUTOSAVE_KEY = 'antlii-poster-autosave-v1';
const HISTORY_LIMIT = 60;
/** Mutations closer together than this coalesce into one history entry (slider drags). */
const COALESCE_MS = 400;

export function usePosterState(opts?: { persist?: boolean }) {
  const persist = opts?.persist !== false;
  const [state, setState] = useState<PosterState>({
    canvasRatio: '1:1',
    backgroundColor: '#1a1a1a',
    layers: [],
    selectedLayerId: null,
  });

  const engineInstances = useRef<Map<string, LayerEngine>>(new Map());

  // --- undo / redo ------------------------------------------------------------
  // History pushes happen OUTSIDE setState updaters (updaters must stay pure —
  // React StrictMode double-invokes them). stateRef mirrors the latest state.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  const past = useRef<PosterState[]>([]);
  const future = useRef<PosterState[]>([]);
  const lastPushAt = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /** Create/dispose engine instances so they match a poster's layers. */
  const syncEngines = useCallback((poster: PosterState) => {
    const wanted = new Set(poster.layers.map(l => l.id));
    for (const [id, engine] of engineInstances.current) {
      if (!wanted.has(id)) {
        engine.dispose?.();
        engineInstances.current.delete(id);
      }
    }
    for (const layer of poster.layers) {
      if (!engineInstances.current.has(layer.id)) {
        const entry = engineRegistry[layer.engineType];
        if (entry) engineInstances.current.set(layer.id, entry.createEngine());
      }
    }
  }, []);

  /** Apply a mutation, recording history (coalesced for rapid slider changes). */
  const commit = useCallback((updater: (prev: PosterState) => PosterState) => {
    const now = Date.now();
    if (now - lastPushAt.current > COALESCE_MS) {
      past.current.push(stateRef.current);
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
    }
    lastPushAt.current = now;
    future.current = [];
    setState(updater);
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  /** Force the next commit to start a fresh history entry (discrete actions). */
  const breakCoalescing = () => { lastPushAt.current = 0; };

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(stateRef.current);
    syncEngines(prev);
    breakCoalescing();
    setState(prev);
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
  }, [syncEngines]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(stateRef.current);
    syncEngines(next);
    breakCoalescing();
    setState(next);
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
  }, [syncEngines]);

  // --- autosave ---------------------------------------------------------------
  // Debounced snapshot to localStorage; restored on mount so a refresh or crash
  // never loses work. Skipped when a headless/share param is about to load a
  // different design anyway.
  useEffect(() => {
    if (!persist) return;
    const t = setTimeout(() => {
      try {
        if (stateRef.current.layers.length > 0) {
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(stateRef.current));
        }
      } catch { /* storage full / private mode */ }
    }, 600);
    return () => clearTimeout(t);
  }, [state, persist]);

  useEffect(() => {
    if (!persist) return;
    const q = new URLSearchParams(window.location.search);
    if (q.has('gen') || q.has('t')) return;
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as PosterState;
      if (!Array.isArray(saved.layers) || saved.layers.length === 0) return;
      syncEngines(saved);
      // One-time hydration from storage — must run post-mount (SSR renders the
      // empty default, so a lazy initializer would mismatch on hydration).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(saved);
    } catch { /* corrupt snapshot — start fresh */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const instances = engineInstances.current;
    return () => {
      for (const engine of instances.values()) engine.dispose?.();
      instances.clear();
    };
  }, []);

  // --- mutations ----------------------------------------------------------------

  const addLayer = useCallback((engineType: EngineType): string => {
    const id = createLayerId();
    const entry = engineRegistry[engineType];
    engineInstances.current.set(id, entry.createEngine());

    const layer: Layer = {
      id,
      name: entry.defaultName,
      engineType,
      visible: true,
      opacity: 1,
      blendMode: 'source-over',
      params: getDefaultParams(engineType),
    };

    breakCoalescing();
    commit(prev => ({
      ...prev,
      layers: [...prev.layers, layer],
      selectedLayerId: id,
    }));
    return id;
  }, [commit]);

  const duplicateLayer = useCallback((layerId: string): string | null => {
    const src = stateRef.current.layers.find(l => l.id === layerId);
    if (!src) return null;
    const id = createLayerId();
    const entry = engineRegistry[src.engineType];
    engineInstances.current.set(id, entry.createEngine());
    const clone: Layer = {
      ...src,
      id,
      name: `${src.name} copy`,
      params: { ...src.params },
      modulations: src.modulations ? { ...src.modulations } : undefined,
    };
    breakCoalescing();
    commit(prev => {
      const idx = prev.layers.findIndex(l => l.id === layerId);
      const layers = [...prev.layers];
      layers.splice(idx === -1 ? layers.length : idx + 1, 0, clone);
      return { ...prev, layers, selectedLayerId: id };
    });
    return id;
  }, [commit]);

  const removeLayer = useCallback((layerId: string) => {
    const engine = engineInstances.current.get(layerId);
    if (engine) {
      engine.dispose?.();
      engineInstances.current.delete(layerId);
    }
    breakCoalescing();
    commit(prev => {
      const newLayers = prev.layers.filter(l => l.id !== layerId);
      const newSelected = prev.selectedLayerId === layerId
        ? (newLayers.length > 0 ? newLayers[newLayers.length - 1].id : null)
        : prev.selectedLayerId;
      return { ...prev, layers: newLayers, selectedLayerId: newSelected };
    });
  }, [commit]);

  const reorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    breakCoalescing();
    commit(prev => {
      const newLayers = [...prev.layers];
      const [moved] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, moved);
      return { ...prev, layers: newLayers };
    });
  }, [commit]);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    breakCoalescing();
    commit(prev => ({
      ...prev,
      layers: prev.layers.map(l =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      ),
    }));
  }, [commit]);

  const updateLayerParam = useCallback((layerId: string, key: string, value: any) => {
    commit(prev => {
      const layer = prev.layers.find(l => l.id === layerId);
      if (!layer) return prev;

      // Handle dither preset expansion
      const isDitherEngine = layer.engineType === 'dither' || layer.engineType === 'img-dither';
      if (isDitherEngine && key === 'preset' && value && ditherPresets[value]) {
        const { name: _n, ...presetParams } = ditherPresets[value];
        return {
          ...prev,
          layers: prev.layers.map(l =>
            l.id === layerId ? { ...l, params: { ...l.params, preset: value, ...presetParams } } : l
          ),
        };
      }

      // Handle rastr preset expansion
      if (layer.engineType === 'rastr' && key === 'preset' && value && rastrPresets[value]) {
        const { name: _n, ...presetParams } = rastrPresets[value];
        return {
          ...prev,
          layers: prev.layers.map(l =>
            l.id === layerId ? { ...l, params: { ...l.params, preset: value, ...presetParams } } : l
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
  }, [commit]);

  // Bind (mod != null) or unbind (mod == null) a live input to a numeric param.
  const setLayerModulation = useCallback((layerId: string, paramKey: string, mod: ParamModulation | null) => {
    commit(prev => ({
      ...prev,
      layers: prev.layers.map(l => {
        if (l.id !== layerId) return l;
        const modulations = { ...(l.modulations ?? {}) };
        if (mod) modulations[paramKey] = mod;
        else delete modulations[paramKey];
        return { ...l, modulations };
      }),
    }));
  }, [commit]);

  const updateLayerMeta = useCallback((layerId: string, meta: { name?: string; opacity?: number; blendMode?: BlendMode }) => {
    commit(prev => ({
      ...prev,
      layers: prev.layers.map(l =>
        l.id === layerId ? { ...l, ...meta } : l
      ),
    }));
  }, [commit]);

  const selectLayer = useCallback((layerId: string | null) => {
    // Selection isn't an undoable edit — bypass history.
    setState(prev => ({ ...prev, selectedLayerId: layerId }));
  }, []);

  // Replace the whole poster (generator / template / AI). Undoable, so an
  // accidental overwrite is one cmd+Z away.
  const loadPoster = useCallback((poster: PosterState) => {
    syncEngines(poster);
    breakCoalescing();
    commit(() => poster);
    breakCoalescing();
  }, [commit, syncEngines]);

  const updateCanvas = useCallback((updates: { canvasRatio?: string; backgroundColor?: string }) => {
    commit(prev => ({ ...prev, ...updates }));
  }, [commit]);

  const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId) ?? null;

  return {
    state,
    engineInstances: engineInstances.current,
    selectedLayer,
    canUndo,
    canRedo,
    undo,
    redo,
    addLayer,
    duplicateLayer,
    removeLayer,
    reorderLayers,
    toggleLayerVisibility,
    updateLayerParam,
    updateLayerMeta,
    setLayerModulation,
    selectLayer,
    updateCanvas,
    loadPoster,
  };
}
