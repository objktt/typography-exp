'use client';

import { useEffect, useRef, useState } from 'react';
import type { PosterState } from '@/lib/types';

// Prompt-to-poster: describe a design in natural language, Claude turns it
// into a full PosterState via /api/generate, and we load it into the studio.

interface AIPromptPanelProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (poster: PosterState) => void;
  /** Undo one step — used by the result bar's Revert action. */
  onRevert: () => void;
  canvasRatio: string;
}

const EXAMPLES = [
  'Brutalist rave poster for DJ NOVA, Friday midnight at Contra Seoul — acid green on black, glitchy energy',
  'Calm Sunday listening session poster, warm cream and terracotta, elegant serif-feeling hierarchy',
  'Y2K chrome poster with a spinning 3D torus, holographic blues, kinetic scrolling type',
  'Swiss-modern exhibition poster: huge red initials, tight grid texture, minimal info block',
];

export function AIPromptPanel({ open, onClose, onGenerate, onRevert, canvasRatio }: AIPromptPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // After a design is applied, a floating bar offers Regenerate / Revert / Keep.
  const [applied, setApplied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  // Abort an in-flight request if the panel unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = async () => {
    if (!prompt.trim() || loading) return;
    setElapsed(0);
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), ratio: canvasRatio }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `Generation failed (${res.status})`);
        setApplied(false);
        return;
      }
      onGenerate(data.state as PosterState);
      setApplied(true); // close the modal, show the result bar over the live canvas
      onClose();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('Network error — is the dev server running?');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    abortRef.current?.abort();
    setLoading(false);
    onClose();
  };

  // Result bar — shown after apply (modal closed) so the design is visible
  // while deciding. Regenerate reuses the same prompt; Revert = one undo.
  if (!open && applied) {
    return (
      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#141414]/95 border border-[#333] rounded-lg shadow-2xl px-3 py-2 backdrop-blur-sm">
        <span className="text-[11px] text-gray-300 pr-1">
          {loading ? `Regenerating… ${elapsed}s` : '✨ AI design applied'}
        </span>
        <button
          onClick={submit}
          disabled={loading}
          className="px-2.5 py-1 text-[11px] bg-[#222] border border-[#333] rounded text-gray-200 hover:bg-[#2a2a2a] disabled:opacity-40"
        >
          Regenerate
        </button>
        <button
          onClick={() => { onRevert(); setApplied(false); }}
          disabled={loading}
          className="px-2.5 py-1 text-[11px] bg-[#222] border border-[#333] rounded text-gray-200 hover:bg-[#2a2a2a] disabled:opacity-40"
        >
          Revert
        </button>
        <button
          onClick={() => setApplied(false)}
          disabled={loading}
          className="px-2.5 py-1 text-[11px] bg-white text-black rounded font-semibold hover:bg-gray-200 disabled:opacity-40"
        >
          ✓ Keep
        </button>
        {error && <span className="text-[10px] text-red-400 max-w-[240px] truncate" title={error}>{error}</span>}
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={close}>
      <div
        className="w-[460px] bg-[#141414] border border-[#333] rounded-lg shadow-2xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">✨ AI Design</h2>
          <button onClick={close} className="text-gray-500 hover:text-white text-xs">✕</button>
        </div>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Describe the poster you want — mood, colors, content, motion. Claude designs it as editable layers you can refine in the studio.
        </p>

        <textarea
          className="w-full h-24 px-2 py-1.5 text-xs bg-[#222] border border-[#333] rounded text-white resize-none focus:outline-none focus:border-blue-500"
          placeholder="e.g. Midnight techno party poster for KIRA, deep blue with electric orange accents, massive spinning 3D initials, scrolling type texture…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
          disabled={loading}
        />

        <div className="flex flex-wrap gap-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              disabled={loading}
              className="px-2 py-1 text-[10px] text-gray-400 bg-[#1e1e1e] border border-[#2e2e2e] rounded hover:text-white hover:bg-[#2a2a2a] text-left"
              title={ex}
            >
              {ex.length > 52 ? `${ex.slice(0, 52)}…` : ex}
            </button>
          ))}
        </div>

        {error && <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>}

        <button
          onClick={submit}
          disabled={loading || !prompt.trim()}
          className={`w-full py-2 text-xs font-semibold rounded transition-colors ${
            loading
              ? 'bg-[#222] text-gray-400 cursor-wait'
              : 'bg-white text-black hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          {loading ? `Designing… ${elapsed}s` : 'Generate design'}
        </button>
        {loading && (
          <p className="text-[10px] text-gray-600 text-center">
            Claude is composing layers — this usually takes 20–60 seconds.
          </p>
        )}
      </div>
    </div>
  );
}
