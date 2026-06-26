'use client';

import { useState, useEffect } from 'react';
import type { PosterState } from '@/lib/types';
import { listTemplates, saveTemplate, deleteTemplate, getTemplate, type PosterTemplate } from '@/lib/templates';

interface TemplatesPanelProps {
  open: boolean;
  onClose: () => void;
  currentState: PosterState;
  onLoad: (state: PosterState) => void;
}

export function TemplatesPanel({ open, onClose, currentState, onLoad }: TemplatesPanelProps) {
  const [templates, setTemplates] = useState<PosterTemplate[]>([]);
  const [name, setName] = useState('');

  useEffect(() => { if (open) setTemplates(listTemplates()); }, [open]);

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    setTemplates(saveTemplate(name, currentState));
    setName('');
  };

  const handleLoad = (t: PosterTemplate) => {
    const state = getTemplate(t.name);
    if (state) { onLoad(state); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[420px] max-h-[80vh] bg-[#141414] border border-[#333] rounded-lg shadow-2xl p-5 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">Templates</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xs">✕</button>
        </div>

        {/* Save current */}
        <div className="flex gap-2 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Save current design as…"
            className="flex-1 px-2 py-1.5 text-xs bg-[#222] border border-[#333] rounded text-white focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded hover:bg-gray-200"
          >
            Save
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {templates.length === 0 ? (
            <div className="text-xs text-gray-600 text-center py-8">No templates yet. Design a poster and save it.</div>
          ) : (
            templates.map((t) => (
              <div key={t.name} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#1a1a1a] border border-[#2a2a2a]">
                <span className="flex-1 text-xs text-gray-200 truncate">{t.name}</span>
                <span className="text-[9px] text-gray-600">{t.state.layers.length} layers</span>
                <button onClick={() => handleLoad(t)} className="px-2 py-0.5 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-500">Load</button>
                <button
                  onClick={() => setTemplates(deleteTemplate(t.name))}
                  className="text-gray-600 hover:text-red-400 text-[10px]"
                >✕</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
