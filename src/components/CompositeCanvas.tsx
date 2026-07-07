'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import type p5 from 'p5';
import type { Layer, LayerEngine } from '@/lib/types';
import { getModSignals, applyModulations } from '@/lib/modulation';

export interface CompositeCanvasRef {
  exportAsImage: (filename?: string, scale?: number) => void;
  /** Downscaled snapshot of the current frame as a data URL (template thumbnails). */
  captureThumbnail: (maxWidth?: number) => string | null;
  exportAsVideo: (filename?: string, seconds?: number, fps?: number) => void;
}

interface CompositeCanvasProps {
  layers: Layer[];
  engineInstances: Map<string, LayerEngine>;
  width: number;
  height: number;
  backgroundColor: string;
  playing: boolean;
  selectedLayer?: Layer | null;
  onUpdateParam?: (layerId: string, key: string, value: any) => void;
  onSelectLayer?: (layerId: string | null) => void;
  showGrid?: boolean;
  snapEnabled?: boolean;
  gridDivs?: number;
}

function isPositioned(l?: Layer | null): boolean {
  return !!l && (l.engineType === 'img-dither' ||
    (l.params?.posX !== undefined && l.params?.posY !== undefined));
}

const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3];

export const CompositeCanvas = forwardRef<CompositeCanvasRef, CompositeCanvasProps>(
  function CompositeCanvas({ layers, engineInstances, width, height, backgroundColor, playing, selectedLayer, onUpdateParam, onSelectLayer, showGrid = false, snapEnabled = false, gridDivs = 12 }, ref) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasWrapRef = useRef<HTMLDivElement>(null);
    const p5Instance = useRef<p5 | null>(null);
    const buffersRef = useRef<Map<string, p5.Graphics>>(new Map());
    const layersRef = useRef(layers);
    const engineInstancesRef = useRef(engineInstances);
    const bgRef = useRef(backgroundColor);

    const [zoom, setZoom] = useState<number | null>(null);
    const [fitScale, setFitScale] = useState(1);
    const fitScaleRef = useRef(1);
    fitScaleRef.current = fitScale;
    const activeScaleRef = useRef(1);

    const playingRef = useRef(playing);
    const frozenTimeRef = useRef(0);
    const timeOffsetRef = useRef(0);

    // Selection outline: cached opaque-bounding-box of the selected layer's
    // buffer (recomputed at a low rate — full pixel reads are not per-frame).
    const selBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
    const selBoxAtRef = useRef(0);
    const selBoxForRef = useRef<string | null>(null);
    /** Suppress UI overlays (selection box) while exporting/capturing. */
    const hideOverlayRef = useRef(false);

    useEffect(() => { layersRef.current = layers; }, [layers]);
    useEffect(() => { engineInstancesRef.current = engineInstances; }, [engineInstances]);
    useEffect(() => { bgRef.current = backgroundColor; }, [backgroundColor]);
    useEffect(() => {
      const wasPlaying = playingRef.current;
      playingRef.current = playing;
      const p = p5Instance.current;
      if (!p) return;
      if (playing && !wasPlaying) {
        // Resuming: adjust offset so time continues from where it froze
        timeOffsetRef.current = p.millis() / 1000 - frozenTimeRef.current;
      } else if (!playing && wasPlaying) {
        // Pausing: capture current effective time
        frozenTimeRef.current = p.millis() / 1000 - timeOffsetRef.current;
      }
    }, [playing]);

    const computeFitScale = useCallback(() => {
      if (!wrapperRef.current) return;
      const pad = 40;
      const areaW = wrapperRef.current.clientWidth - pad * 2;
      const areaH = wrapperRef.current.clientHeight - pad * 2;
      if (areaW <= 0 || areaH <= 0) return;
      setFitScale(Math.min(1, areaW / width, areaH / height));
    }, [width, height]);

    useEffect(() => {
      computeFitScale();
      const ro = new ResizeObserver(computeFitScale);
      if (wrapperRef.current) ro.observe(wrapperRef.current);
      return () => ro.disconnect();
    }, [computeFitScale]);

    useEffect(() => {
      setZoom(null);
      // Reset stale scroll position so canvas stays visible after ratio change
      requestAnimationFrame(() => {
        if (wrapperRef.current) {
          wrapperRef.current.scrollLeft = 0;
          wrapperRef.current.scrollTop = 0;
        }
      });
    }, [width, height]);

    const activeScale = zoom ?? fitScale;
    activeScaleRef.current = activeScale;
    const displayW = Math.round(width * activeScale);
    const displayH = Math.round(height * activeScale);
    const zoomPct = Math.round(activeScale * 100);

    const zoomIn = () => {
      const next = ZOOM_STEPS.find(s => s > activeScale + 0.001);
      setZoom(next ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]);
    };
    const zoomOut = () => {
      const prev = [...ZOOM_STEPS].reverse().find(s => s < activeScale - 0.001);
      setZoom(prev ?? ZOOM_STEPS[0]);
    };
    const zoomFit = () => setZoom(null);

    // --- Image drag for img-dither layers ---
    const selectedLayerRef = useRef(selectedLayer);
    selectedLayerRef.current = selectedLayer;
    const onUpdateParamRef = useRef(onUpdateParam);
    onUpdateParamRef.current = onUpdateParam;
    const onSelectLayerRef = useRef(onSelectLayer);
    onSelectLayerRef.current = onSelectLayer;
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0, paramX: 0, paramY: 0 });
    const dragLayerRef = useRef<string | null>(null);
    const dragModeRef = useRef<'move' | 'rotate'>('move');
    const movedRef = useRef(false);

    const snapRef = useRef(snapEnabled);
    snapRef.current = snapEnabled;
    const gridDivsRef = useRef(gridDivs);
    gridDivsRef.current = gridDivs;

    const canDrag = isPositioned(selectedLayer);

    useEffect(() => {
      if (!canvasWrapRef.current || isDraggingRef.current) return;
      canvasWrapRef.current.style.cursor = canDrag ? 'grab' : 'pointer';
    }, [canDrag]);

    useEffect(() => {
      const el = canvasWrapRef.current;
      if (!el) return;

      // Pick the topmost visible layer hit at logical canvas coords (x,y).
      // Buffers may be high-DPI (pixelDensity > 1), so map into the buffer's
      // real pixel space. Falls back to the layer's opaque bounding box so
      // clicking near (not exactly on) thin text still selects it.
      const hitTest = (x: number, y: number): string | null => {
        if (x < 0 || y < 0 || x >= width || y >= height) return null;
        const order = layersRef.current;
        for (let i = order.length - 1; i >= 0; i--) {
          const l = order[i];
          if (!l.visible) continue;
          const buf = buffersRef.current.get(l.id);
          if (!buf) continue;
          const ctx = buf.drawingContext as CanvasRenderingContext2D;
          const cw = ctx.canvas.width;
          const ch = ctx.canvas.height;
          const px = Math.floor((x / width) * cw);
          const py = Math.floor((y / height) * ch);
          if (px < 0 || py < 0 || px >= cw || py >= ch) continue;
          try {
            const data = ctx.getImageData(0, 0, cw, ch).data;
            if (data[(py * cw + px) * 4 + 3] > 10) return l.id; // exact hit
            // forgiving bounding-box hit
            let minX = cw, minY = ch, maxX = -1, maxY = -1;
            const step = 2;
            for (let yy = 0; yy < ch; yy += step) {
              const row = yy * cw;
              for (let xx = 0; xx < cw; xx += step) {
                if (data[(row + xx) * 4 + 3] > 20) {
                  if (xx < minX) minX = xx;
                  if (xx > maxX) maxX = xx;
                  if (yy < minY) minY = yy;
                  if (yy > maxY) maxY = yy;
                }
              }
            }
            const m = Math.round((cw / width) * 8); // ~8 logical px margin
            if (maxX >= 0 && px >= minX - m && px <= maxX + m && py >= minY - m && py <= maxY + m) return l.id;
          } catch { /* tainted buffer — skip */ }
        }
        return null;
      };

      const handlePointerDown = (e: PointerEvent) => {
        // Cmd/Ctrl held + a 3D layer selected → orbit it, anywhere on canvas.
        const sel = selectedLayerRef.current;
        if ((e.metaKey || e.ctrlKey) && sel?.engineType === 'object3d') {
          dragModeRef.current = 'rotate';
          dragLayerRef.current = sel.id;
          isDraggingRef.current = true;
          dragStartRef.current = { x: e.clientX, y: e.clientY, paramX: sel.params.rotY ?? 0, paramY: sel.params.rotX ?? 0 };
          el.setPointerCapture(e.pointerId);
          el.style.cursor = 'grabbing';
          e.preventDefault();
          return;
        }

        // Otherwise: hit-test to select the layer under the cursor, then move/pan.
        const rect = el.getBoundingClientRect();
        const cx = Math.floor(((e.clientX - rect.left) / rect.width) * width);
        const cy = Math.floor(((e.clientY - rect.top) / rect.height) * height);
        const hitId = hitTest(cx, cy);
        onSelectLayerRef.current?.(hitId);

        const layer = hitId ? layersRef.current.find((l) => l.id === hitId) ?? null : null;
        dragLayerRef.current = isPositioned(layer) ? hitId : null;
        if (!isPositioned(layer)) return;

        dragModeRef.current = 'move';
        movedRef.current = false;
        isDraggingRef.current = true;
        const isImg = layer!.engineType === 'img-dither';
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          paramX: isImg ? (layer!.params.imageX ?? 0) : (layer!.params.posX ?? 0.5),
          paramY: isImg ? (layer!.params.imageY ?? 0) : (layer!.params.posY ?? 0.5),
        };
        el.setPointerCapture(e.pointerId);
        el.style.cursor = 'grabbing';
        e.preventDefault();
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (!isDraggingRef.current) return;
        const layer = layersRef.current.find((l) => l.id === dragLayerRef.current) ?? null;
        const update = onUpdateParamRef.current;
        if (!layer || !update) return;

        // Cmd/Ctrl-drag on a 3D layer: orbit (rotate Y from dx, X from dy).
        if (dragModeRef.current === 'rotate') {
          const wrap = (v: number) => (((v + 180) % 360) + 360) % 360 - 180;
          const dx = e.clientX - dragStartRef.current.x;
          const dy = e.clientY - dragStartRef.current.y;
          update(layer.id, 'rotY', Math.round(wrap(dragStartRef.current.paramX + dx * 0.4)));
          update(layer.id, 'rotX', Math.round(wrap(dragStartRef.current.paramY + dy * 0.4)));
          return;
        }

        // Threshold: a plain click (barely any movement) only selects, no move.
        const ddx = e.clientX - dragStartRef.current.x;
        const ddy = e.clientY - dragStartRef.current.y;
        if (!movedRef.current && Math.hypot(ddx, ddy) < 4) return;
        movedRef.current = true;

        // Image layers: pan in pixels relative to grab point (snap optional).
        if (layer.engineType === 'img-dither') {
          const scale = activeScaleRef.current;
          let nx = dragStartRef.current.paramX + ddx / scale;
          let ny = dragStartRef.current.paramY + ddy / scale;
          if (snapRef.current) {
            const d = Math.max(1, gridDivsRef.current);
            nx = Math.round(nx / (width / d)) * (width / d);
            ny = Math.round(ny / (height / (d * 2))) * (height / (d * 2));
          }
          update(layer.id, 'imageX', Math.round(nx));
          update(layer.id, 'imageY', Math.round(ny));
          return;
        }

        // Positioned layers (label, logo, 3D…): move RELATIVE to grab point so
        // it never jumps to the cursor; snap to grid when enabled.
        if (layer.params.posX === undefined) return;
        const rect = el.getBoundingClientRect();
        let nx = dragStartRef.current.paramX + ddx / rect.width;
        let ny = dragStartRef.current.paramY + ddy / rect.height;
        nx = Math.max(0, Math.min(1, nx));
        ny = Math.max(0, Math.min(1, ny));
        if (snapRef.current) {
          const d = Math.max(1, gridDivsRef.current);
          nx = Math.round(nx * d) / d;
          ny = Math.round(ny * d * 2) / (d * 2); // rows are 2× denser
        }
        update(layer.id, 'posX', Math.round(nx * 1000) / 1000);
        update(layer.id, 'posY', Math.round(ny * 1000) / 1000);
      };

      const handlePointerUp = () => {
        dragLayerRef.current = null;
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        const layer = selectedLayerRef.current;
        el.style.cursor = isPositioned(layer) ? 'grab' : '';
      };

      el.addEventListener('pointerdown', handlePointerDown);
      el.addEventListener('pointermove', handlePointerMove);
      el.addEventListener('pointerup', handlePointerUp);

      return () => {
        el.removeEventListener('pointerdown', handlePointerDown);
        el.removeEventListener('pointermove', handlePointerMove);
        el.removeEventListener('pointerup', handlePointerUp);
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Pinch-to-zoom: trackpad (Ctrl+wheel) and touch gestures
    useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const handleWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const scaleFactor = Math.pow(1.005, -e.deltaY);
        setZoom(prev => {
          const current = prev ?? fitScaleRef.current;
          return Math.max(0.1, Math.min(3, current * scaleFactor));
        });
      };

      let pinchDist = 0;
      let pinchZoom = 1;

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchDist = Math.sqrt(dx * dx + dy * dy);
          pinchZoom = activeScaleRef.current;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length !== 2 || pinchDist === 0) return;
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        setZoom(Math.max(0.1, Math.min(3, pinchZoom * (dist / pinchDist))));
      };

      const handleTouchEnd = () => { pinchDist = 0; };

      wrapper.addEventListener('wheel', handleWheel, { passive: false });
      wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
      wrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
      wrapper.addEventListener('touchend', handleTouchEnd);

      return () => {
        wrapper.removeEventListener('wheel', handleWheel);
        wrapper.removeEventListener('touchstart', handleTouchStart);
        wrapper.removeEventListener('touchmove', handleTouchMove);
        wrapper.removeEventListener('touchend', handleTouchEnd);
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Apply CSS size to the p5 canvas element so it visually matches zoom
    // (internal resolution stays the same for export quality)
    const displaySizeRef = useRef({ w: displayW, h: displayH });
    displaySizeRef.current = { w: displayW, h: displayH };
    useEffect(() => {
      if (!canvasWrapRef.current) return;
      const canvas = canvasWrapRef.current.querySelector('canvas');
      if (!canvas) return;
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
    }, [displayW, displayH]);

    useImperativeHandle(ref, () => ({
      captureThumbnail: (maxWidth = 360) => {
        hideOverlayRef.current = true;
        p5Instance.current?.redraw();
        const canvas = canvasWrapRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
        if (!canvas || canvas.width === 0) {
          hideOverlayRef.current = false;
          return null;
        }
        const w = Math.min(maxWidth, canvas.width);
        const h = Math.round(w * (canvas.height / canvas.width));
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const ctx = off.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(canvas, 0, 0, w, h);
        let out: string;
        try {
          out = off.toDataURL('image/webp', 0.82);
        } catch {
          out = off.toDataURL('image/jpeg', 0.82);
        }
        hideOverlayRef.current = false;
        return out;
      },
      exportAsImage: (filename = 'poster', scale = 1) => {
        if (p5Instance.current) {
          const p = p5Instance.current;
          const originalDensity = p.pixelDensity();
          hideOverlayRef.current = true;
          p.pixelDensity(scale * window.devicePixelRatio);
          p.redraw();
          setTimeout(() => {
            p.saveCanvas(filename, 'png');
            p.pixelDensity(originalDensity);
            hideOverlayRef.current = false;
            p.redraw();
          }, 50);
        }
      },
      exportAsVideo: (filename = 'poster', seconds = 6, fps = 30) => {
        const canvas = canvasWrapRef.current?.querySelector('canvas') as
          (HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }) | null;
        if (!canvas || !canvas.captureStream || typeof MediaRecorder === 'undefined') {
          console.warn('Video export not supported in this browser.');
          return;
        }
        const stream = canvas.captureStream(fps);
        // Prefer MP4 (Safari + newer Chromium) so it uploads to iPhone /
        // Instagram directly; fall back to WebM otherwise.
        const candidates = [
          'video/mp4;codecs=avc1',
          'video/mp4',
          'video/webm;codecs=vp9',
          'video/webm',
        ];
        const mime = candidates.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';
        const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
        hideOverlayRef.current = true;
        const chunks: BlobPart[] = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          hideOverlayRef.current = false;
          const blob = new Blob(chunks, { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.${ext}`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        rec.start();
        setTimeout(() => rec.stop(), Math.max(1, seconds) * 1000);
      },
    }));

    useEffect(() => {
      if (!canvasWrapRef.current) return;

      let isMounted = true;

      import('p5').then((p5Module) => {
        if (!isMounted || !canvasWrapRef.current) return;

        const P5 = p5Module.default;

        const sketch = (p: p5) => {
          p.setup = () => {
            p.createCanvas(width, height);
            p.frameRate(60);

            for (const layer of layersRef.current) {
              const engine = engineInstancesRef.current.get(layer.id);
              if (engine) engine.setup(p, width, height, layer.params);
            }

            // Always loop — time freezing handles pause
            timeOffsetRef.current = p.millis() / 1000;
          };

          p.draw = () => {
            const rawTime = p.millis() / 1000;
            const time = playingRef.current
              ? rawTime - timeOffsetRef.current
              : frozenTimeRef.current;
            const currentLayers = layersRef.current;
            const instances = engineInstancesRef.current;

            p.background(bgRef.current);

            const activeIds = new Set(currentLayers.map(l => l.id));

            // Remove stale buffers
            for (const [id, buf] of buffersRef.current) {
              if (!activeIds.has(id)) {
                buf.remove();
                buffersRef.current.delete(id);
              }
            }

            // Create missing buffers
            for (const layer of currentLayers) {
              if (!buffersRef.current.has(layer.id)) {
                const pg = p.createGraphics(width, height);
                buffersRef.current.set(layer.id, pg);
                const engine = instances.get(layer.id);
                if (engine) engine.setup(p, width, height, layer.params);
              }
            }

            // Draw & composite each visible layer
            const ctx = p.drawingContext as CanvasRenderingContext2D;
            const signals = getModSignals();
            for (const layer of currentLayers) {
              if (!layer.visible) continue;
              const engine = instances.get(layer.id);
              const pg = buffersRef.current.get(layer.id);
              if (!engine || !pg) continue;

              engine.draw(pg, p, time, applyModulations(layer, signals, time));

              // Use p5's image() for compositing — works across p5 versions
              ctx.save();
              ctx.globalAlpha = layer.opacity;
              ctx.globalCompositeOperation = layer.blendMode;
              p.image(pg, 0, 0);
              ctx.restore();
            }

            // Selection outline — dashed box around the selected layer's
            // painted content so selection is visible on canvas.
            const sel = selectedLayerRef.current;
            if (sel && sel.visible && !hideOverlayRef.current) {
              const selBuf = buffersRef.current.get(sel.id);
              if (selBuf) {
                const now = p.millis();
                if (selBoxForRef.current !== sel.id || now - selBoxAtRef.current > 350) {
                  selBoxForRef.current = sel.id;
                  selBoxAtRef.current = now;
                  try {
                    const bctx = selBuf.drawingContext as CanvasRenderingContext2D;
                    const cw = bctx.canvas.width;
                    const chh = bctx.canvas.height;
                    const data = bctx.getImageData(0, 0, cw, chh).data;
                    let minX = cw, minY = chh, maxX = -1, maxY = -1;
                    const step = 4;
                    for (let yy = 0; yy < chh; yy += step) {
                      const row = yy * cw;
                      for (let xx = 0; xx < cw; xx += step) {
                        if (data[(row + xx) * 4 + 3] > 20) {
                          if (xx < minX) minX = xx;
                          if (xx > maxX) maxX = xx;
                          if (yy < minY) minY = yy;
                          if (yy > maxY) maxY = yy;
                        }
                      }
                    }
                    if (maxX >= 0) {
                      const sx = width / cw;
                      const sy = height / chh;
                      selBoxRef.current = { x: minX * sx, y: minY * sy, w: (maxX - minX) * sx, h: (maxY - minY) * sy };
                    } else {
                      selBoxRef.current = null;
                    }
                  } catch {
                    selBoxRef.current = null;
                  }
                }
                const box = selBoxRef.current;
                if (box) {
                  const lw = Math.max(1, 1.5 / activeScaleRef.current);
                  const m = 4 * lw;
                  ctx.save();
                  ctx.strokeStyle = 'rgba(70,140,255,0.95)';
                  ctx.lineWidth = lw;
                  ctx.setLineDash([5 * lw, 4 * lw]);
                  ctx.strokeRect(box.x - m, box.y - m, box.w + m * 2, box.h + m * 2);
                  ctx.restore();
                }
              }
            } else {
              selBoxForRef.current = null;
              selBoxRef.current = null;
            }
          };
        };

        p5Instance.current = new P5(sketch, canvasWrapRef.current);

        // The CSS-size effect may have run before the canvas element existed
        // (p5 loads async) — apply the current display size once it's in the DOM.
        requestAnimationFrame(() => {
          const canvas = canvasWrapRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
          if (canvas) {
            canvas.style.width = `${displaySizeRef.current.w}px`;
            canvas.style.height = `${displaySizeRef.current.h}px`;
          }
        });
      });

      return () => {
        isMounted = false;
        for (const buf of buffersRef.current.values()) buf.remove();
        buffersRef.current.clear();
        if (p5Instance.current) {
          p5Instance.current.remove();
          p5Instance.current = null;
        }
      };
    }, [width, height]);

    const pad = 40;

    return (
      <div className="relative w-full h-full flex flex-col">
        {/* Scrollable canvas area */}
        <div
          ref={wrapperRef}
          className="flex-1 overflow-auto min-h-0"
        >
          <div
            style={{
              minWidth: '100%',
              minHeight: '100%',
              width: displayW + pad * 2,
              height: displayH + pad * 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              ref={canvasWrapRef}
              style={{
                width: displayW,
                height: displayH,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {showGrid && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    backgroundImage:
                      'linear-gradient(rgba(80,160,255,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(80,160,255,0.28) 1px, transparent 1px)',
                    backgroundSize: `${displayW / Math.max(1, gridDivs)}px ${displayH / Math.max(1, gridDivs * 2)}px`,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#111]/90 border border-[#333] rounded-lg px-2 py-1 backdrop-blur-sm">
          <button onClick={zoomOut} className="px-1.5 py-0.5 text-xs text-gray-400 hover:text-white transition-colors">
            −
          </button>
          <button
            onClick={zoomFit}
            className="px-2 py-0.5 text-[10px] text-gray-300 hover:text-white transition-colors min-w-[44px] text-center"
          >
            {zoomPct}%
          </button>
          <button onClick={zoomIn} className="px-1.5 py-0.5 text-xs text-gray-400 hover:text-white transition-colors">
            +
          </button>
        </div>
      </div>
    );
  }
);
