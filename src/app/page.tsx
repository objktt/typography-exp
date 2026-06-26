'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { CompositeCanvas, type CompositeCanvasRef } from '@/components/CompositeCanvas';
import { LayerList } from '@/components/LayerList';
import { LayerInspector } from '@/components/LayerInspector';
import { GeneratePanel } from '@/components/GeneratePanel';
import { TemplatesPanel } from '@/components/TemplatesPanel';
import { CalendarFormPanel } from '@/components/CalendarFormPanel';
import { generatePoster, type PosterFormat } from '@/lib/poster-generator';
import { usePosterState } from '@/hooks/usePosterState';

const ratioOptions = [
  { label: '1:1', value: '1:1' },
  { label: '4:5', value: '4:5' },
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
];

export default function Home() {
  const canvasRef = useRef<CompositeCanvasRef>(null);
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(2);
  const [isExporting, setIsExporting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCalForm, setShowCalForm] = useState(false);
  const [gridOn, setGridOn] = useState(false);

  // Preload the poster font so canvas text renders with it (canvas doesn't
  // reliably trigger webfont loading on its own).
  useEffect(() => {
    const f = '"Google Sans Flex Variable"';
    const d = document as Document & { fonts?: { load: (s: string) => Promise<unknown> } };
    if (d.fonts) {
      ['400', '500', '700', '900'].forEach((w) => d.fonts!.load(`${w} 64px ${f}`).catch(() => {}));
    }
  }, []);

  const {
    state,
    engineInstances,
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
  } = usePosterState();

  // Headless render hook: ?gen=<base64 JSON {event, style?, format?}> auto-builds
  // the poster, plays it, and flags window.__POSTER_READY__ for a render script.
  useEffect(() => {
    const gen = new URLSearchParams(window.location.search).get('gen');
    if (!gen) return;
    try {
      const cfg = JSON.parse(decodeURIComponent(escape(atob(gen)))) as {
        event: Parameters<typeof generatePoster>[0];
        style?: string;
        format?: PosterFormat;
      };
      loadPoster(generatePoster(cfg.event, cfg.style, cfg.format ?? 'feed'));
      setPlaying(true);
      const w = window as unknown as { __POSTER_READY__?: boolean };
      setTimeout(() => { w.__POSTER_READY__ = true; }, 2800);
    } catch {
      /* invalid payload */
    }
  }, [loadPoster]);

  // Delete / Backspace removes the selected layer (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (state.selectedLayerId) {
        e.preventDefault();
        removeLayer(state.selectedLayerId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.selectedLayerId, removeLayer]);

  const canvasSize = useMemo(() => {
    const baseSize = 900;
    switch (state.canvasRatio) {
      case '16:9': return { width: Math.round(baseSize * 16 / 9), height: baseSize };
      case '9:16': return { width: baseSize, height: Math.round(baseSize * 16 / 9) };
      case '4:5': return { width: baseSize, height: Math.round(baseSize * 5 / 4) };
      case '4:3': return { width: Math.round(baseSize * 4 / 3), height: baseSize };
      case '3:4': return { width: baseSize, height: Math.round(baseSize * 4 / 3) };
      default: return { width: baseSize, height: baseSize };
    }
  }, [state.canvasRatio]);

  const [isRecording, setIsRecording] = useState(false);
  const [showVideoExport, setShowVideoExport] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState(15);
  const [recordLeft, setRecordLeft] = useState(0);

  const handleExport = () => {
    setIsExporting(true);
    const timestamp = new Date().toISOString().slice(0, 10);
    canvasRef.current?.exportAsImage(`antlii-poster-${timestamp}-${exportScale}x`, exportScale);
    setTimeout(() => setIsExporting(false), 1000);
  };

  const handleExportVideo = (seconds: number) => {
    if (isRecording) return;
    const secs = Math.max(1, Math.min(60, Math.round(seconds)));
    setShowVideoExport(false);
    setPlaying(true);            // ensure motion runs during capture
    setIsRecording(true);
    setRecordLeft(secs);
    const timestamp = new Date().toISOString().slice(0, 10);
    setTimeout(() => {
      canvasRef.current?.exportAsVideo(`antlii-poster-${timestamp}`, secs, 30);
      const iv = setInterval(() => setRecordLeft((s) => (s > 1 ? s - 1 : 0)), 1000);
      setTimeout(() => { clearInterval(iv); setIsRecording(false); }, secs * 1000 + 500);
    }, 120);
  };

  const btnBase = 'inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap focus:outline-none';
  const btnGhost = `${btnBase} bg-[#1e1e1e] text-gray-300 border border-[#2e2e2e] hover:bg-[#2a2a2a] hover:text-white`;
  const btnPrimary = `${btnBase} bg-blue-600 text-white hover:bg-blue-500`;
  const Divider = () => <div className="w-px h-5 bg-[#2e2e2e] shrink-0" />;

  return (
    <main className="flex h-screen flex-col bg-[#1a1a1a] text-white font-mono overflow-hidden">
      {/* Top Bar */}
      <div className="flex-shrink-0 border-b border-[#2e2e2e] bg-[#111]">
        <div className="flex items-center justify-between gap-3 px-4 h-12">
          {/* Left — brand + create actions */}
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-sm font-bold tracking-tight text-white whitespace-nowrap pr-1">
              Objktt <span className="text-gray-500 font-medium">Poster Design</span>
            </h1>
            <Divider />
            <button onClick={() => setShowGenerate(true)} className={btnPrimary}>Generate</button>
            <button onClick={() => setShowTemplates(true)} className={btnGhost}>Templates</button>
            <button onClick={() => setShowCalForm(true)} className={btnGhost}>Calendar</button>
          </div>

          {/* Right — view + export */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGridOn((g) => !g)}
              title="Toggle grid + snap"
              className={gridOn ? `${btnBase} bg-blue-600 text-white` : btnGhost}
            >
              Grid
            </button>
            <button
              onClick={() => setPlaying((p) => !p)}
              className={playing ? `${btnBase} bg-amber-500 text-black hover:bg-amber-400` : btnGhost}
            >
              {playing ? 'Pause' : 'Play'}
            </button>

            <Divider />

            {/* Ratio segmented */}
            <div className="flex items-center gap-0.5 bg-[#0a0a0a] rounded-md p-0.5 h-8">
              {ratioOptions.map((ratio) => (
                <button
                  key={ratio.value}
                  onClick={() => updateCanvas({ canvasRatio: ratio.value })}
                  className={`px-2 h-7 text-xs rounded transition-colors ${
                    state.canvasRatio === ratio.value ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#222]'
                  }`}
                >
                  {ratio.label}
                </button>
              ))}
            </div>

            {/* BG color */}
            <label className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#2e2e2e] bg-[#1e1e1e] cursor-pointer overflow-hidden" title="Background color">
              <input
                type="color"
                value={state.backgroundColor}
                onChange={(e) => updateCanvas({ backgroundColor: e.target.value })}
                className="w-6 h-6 cursor-pointer bg-transparent border-0 p-0"
              />
            </label>

            <Divider />

            {/* Export segmented */}
            <div className="flex items-center gap-0.5 bg-[#0a0a0a] rounded-md p-0.5 h-8">
              {([1, 2, 3] as const).map((scale) => (
                <button
                  key={scale}
                  onClick={() => setExportScale(scale)}
                  className={`px-2 h-7 text-xs rounded transition-colors ${
                    exportScale === scale ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#222]'
                  }`}
                >
                  {scale}x
                </button>
              ))}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className={`px-2.5 h-7 text-xs rounded font-semibold transition-colors ${
                  isExporting ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                {isExporting ? '✓' : 'PNG'}
              </button>
              <button
                onClick={() => setShowVideoExport(true)}
                disabled={isRecording}
                className={`px-2.5 h-7 text-xs rounded font-semibold transition-colors ${
                  isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                {isRecording ? `● ${recordLeft}s` : 'Video'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar — Layers (fixed) */}
        <div className="w-56 flex-shrink-0 border-r border-[#333] bg-[#111] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            <LayerList
              layers={state.layers}
              selectedLayerId={state.selectedLayerId}
              onSelect={selectLayer}
              onToggleVisibility={toggleLayerVisibility}
              onRemove={removeLayer}
              onReorder={reorderLayers}
              onAddLayer={addLayer}
            />
          </div>
          <div className="flex-shrink-0 border-t border-[#333] px-3 py-2 text-[10px] text-gray-600 text-center">
            v2.0.0
          </div>
        </div>

        {/* Center — Canvas work area (scrollable) */}
        <div className="flex-1 min-w-0 bg-[#0a0a0a]">
          <CompositeCanvas
            key={`${canvasSize.width}x${canvasSize.height}`}
            ref={canvasRef}
            layers={state.layers}
            engineInstances={engineInstances}
            width={canvasSize.width}
            height={canvasSize.height}
            backgroundColor={state.backgroundColor}
            playing={playing}
            selectedLayer={selectedLayer}
            onUpdateParam={updateLayerParam}
            onSelectLayer={selectLayer}
            showGrid={gridOn}
            snapEnabled={gridOn}
            gridDivs={12}
          />
        </div>

        {/* Right Sidebar — Inspector (fixed) */}
        <div className="w-72 flex-shrink-0 border-l border-[#333] bg-[#111] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 pb-24">
            {selectedLayer ? (
              <LayerInspector
                layer={selectedLayer}
                onParamChange={updateLayerParam}
                onMetaChange={updateLayerMeta}
              />
            ) : (
              <div className="text-xs text-gray-600 text-center py-8">
                Select a layer to edit
              </div>
            )}
          </div>
        </div>
      </div>

      <GeneratePanel
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onGenerate={loadPoster}
      />

      <TemplatesPanel
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        currentState={state}
        onLoad={loadPoster}
      />

      <CalendarFormPanel
        open={showCalForm}
        onClose={() => setShowCalForm(false)}
      />

      {showVideoExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowVideoExport(false)}>
          <div className="w-[300px] bg-[#141414] border border-[#333] rounded-lg shadow-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Export Video</h2>
              <button onClick={() => setShowVideoExport(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
            </div>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Duration (seconds)</span>
              <input
                type="number"
                min={1}
                max={60}
                value={videoSeconds}
                onChange={(e) => setVideoSeconds(parseInt(e.target.value) || 1)}
                className="w-full px-2 py-1.5 text-sm bg-[#222] border border-[#333] rounded text-white focus:outline-none focus:border-blue-500"
              />
            </label>
            <div className="flex gap-1">
              {[6, 10, 15, 30].map((s) => (
                <button
                  key={s}
                  onClick={() => setVideoSeconds(s)}
                  className={`flex-1 py-1 text-xs rounded ${videoSeconds === s ? 'bg-blue-600 text-white' : 'bg-[#222] text-gray-400 hover:bg-[#333]'}`}
                >
                  {s}s
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 leading-relaxed">Records the live canvas as WebM at 30fps. Playback turns on automatically.</p>
            <button
              onClick={() => handleExportVideo(videoSeconds)}
              className="w-full py-2 text-xs font-semibold bg-white text-black rounded hover:bg-gray-200"
            >
              Record {Math.max(1, Math.min(60, videoSeconds))}s
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
