'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PosterState } from '@/lib/types';
import { usePosterState } from '@/hooks/usePosterState';
import { CompositeCanvas, type CompositeCanvasRef } from '@/components/CompositeCanvas';

// Read-only presentation view for share links (/v/<id>): the poster plays
// live, but nothing is editable and nothing touches the viewer's autosave.

export function ShareViewer({ state, name }: { state: PosterState; name: string }) {
  const canvasRef = useRef<CompositeCanvasRef>(null);
  const { state: poster, engineInstances, loadPoster } = usePosterState({ persist: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadPoster({ ...state, selectedLayerId: null });
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvasSize = useMemo(() => {
    const baseSize = 900;
    switch (poster.canvasRatio) {
      case '16:9': return { width: Math.round(baseSize * 16 / 9), height: baseSize };
      case '9:16': return { width: baseSize, height: Math.round(baseSize * 16 / 9) };
      case '4:5': return { width: baseSize, height: Math.round(baseSize * 5 / 4) };
      case '4:3': return { width: Math.round(baseSize * 4 / 3), height: baseSize };
      case '3:4': return { width: baseSize, height: Math.round(baseSize * 4 / 3) };
      default: return { width: baseSize, height: baseSize };
    }
  }, [poster.canvasRatio]);

  return (
    <main className="flex h-screen flex-col bg-[#0d0d0d] text-white font-mono overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-[#222] bg-[#111]">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-bold whitespace-nowrap">antlii</span>
          <span className="text-xs text-gray-500 truncate">{name}</span>
        </div>
        <a
          href="/"
          className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-500 whitespace-nowrap"
        >
          Open in studio
        </a>
      </div>

      <div className="flex-1 min-h-0">
        {loaded && (
          <CompositeCanvas
            key={`${canvasSize.width}x${canvasSize.height}`}
            ref={canvasRef}
            layers={poster.layers}
            engineInstances={engineInstances}
            width={canvasSize.width}
            height={canvasSize.height}
            backgroundColor={poster.backgroundColor}
            playing
          />
        )}
      </div>

      <div className="flex-shrink-0 h-8 flex items-center justify-center text-[10px] text-gray-600 border-t border-[#1c1c1c]">
        Made with antlii · typography studio
      </div>
    </main>
  );
}
