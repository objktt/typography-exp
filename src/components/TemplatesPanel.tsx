'use client';

import { useState, useEffect } from 'react';
import type { PosterState } from '@/lib/types';
import {
  listTemplates,
  saveTemplate,
  deleteTemplate,
  getTemplate,
  shareUrl,
  type TemplateMeta,
} from '@/lib/templates';

interface TemplatesPanelProps {
  open: boolean;
  onClose: () => void;
  currentState: PosterState;
  onLoad: (state: PosterState) => void;
  /** Snapshot of the live canvas, saved as the template's thumbnail. */
  getThumbnail?: () => string | null;
}

export function TemplatesPanel({ open, onClose, currentState, onLoad, getThumbnail }: TemplatesPanelProps) {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      setTemplates(await listTemplates());
    } catch {
      setError('Could not load templates.');
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveTemplate(name, currentState, getThumbnail?.() ?? undefined);
      setName('');
      await refresh();
    } catch {
      setError('Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleLoad = async (t: TemplateMeta) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const state = await getTemplate(t.id);
      if (state) {
        onLoad(state);
        onClose();
      } else {
        setError('Template not found.');
      }
    } catch {
      setError('Load failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (t: TemplateMeta) => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteTemplate(t.id);
      await refresh();
    } catch {
      setError('Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async (t: TemplateMeta) => {
    const url = shareUrl(t.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId((c) => (c === t.id ? null : c)), 1500);
    } catch {
      window.prompt('Copy share link:', url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[560px] max-h-[82vh] bg-[#141414] border border-[#333] rounded-lg shadow-2xl p-5 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">Templates <span className="text-[9px] font-normal text-gray-500">· cloud</span></h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xs">✕</button>
        </div>

        {/* Save current */}
        <div className="flex gap-2 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Save current design as…"
            disabled={busy}
            className="flex-1 px-2 py-1.5 text-xs bg-[#222] border border-[#333] rounded text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSave}
            disabled={busy || !name.trim()}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded hover:bg-gray-200 disabled:opacity-40"
          >
            Save
          </button>
        </div>

        {error && <div className="text-[10px] text-red-400 mb-2">{error}</div>}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {templates.length === 0 ? (
            <div className="text-xs text-gray-600 text-center py-8">No templates yet. Design a poster and save it.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {templates.map((t) => (
                <div key={t.id} className="group rounded bg-[#1a1a1a] border border-[#2a2a2a] overflow-hidden hover:border-[#444]">
                  <button
                    onClick={() => handleLoad(t)}
                    disabled={busy}
                    className="block w-full aspect-[4/5] bg-[#0d0d0d] relative disabled:opacity-40"
                    title={`Load "${t.name}"`}
                  >
                    {t.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.thumb} alt={t.name} className="absolute inset-0 w-full h-full object-contain" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] text-gray-600">no preview</span>
                    )}
                  </button>
                  <div className="px-1.5 py-1">
                    <div className="text-[10px] text-gray-200 truncate">{t.name}</div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[8px] text-gray-600">{t.layerCount} layers</span>
                      <span className="flex gap-1.5">
                        <button
                          onClick={() => handleShare(t)}
                          className="text-[9px] text-gray-500 hover:text-white"
                          title="Copy share link"
                        >{copiedId === t.id ? 'copied' : 'share'}</button>
                        <button
                          onClick={() => handleDelete(t)}
                          disabled={busy}
                          className="text-[9px] text-gray-600 hover:text-red-400 disabled:opacity-40"
                        >✕</button>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
