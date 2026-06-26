'use client';

import { useState } from 'react';
import { searchModels, type ModelResult } from '@/lib/poly';

interface ModelGridProps {
  onSelect: (model: ModelResult) => void;
}

export function ModelGrid({ onSelect }: ModelGridProps) {
  const [models, setModels] = useState<ModelResult[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setModels(await searchModels(query.trim()));
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg === 'NO_KEY'
        ? 'Add NEXT_PUBLIC_POLY_PIZZA_API_KEY to .env.local and restart the dev server.'
        : 'Search failed. Try again, or download the GLB and upload it instead.');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <form onSubmit={run} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 3D models…"
          className="flex-1 px-2 py-1.5 text-xs bg-[#222] border border-[#333] rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button type="submit" className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500">Go</button>
      </form>

      {error && <div className="text-[10px] text-amber-500 leading-relaxed">{error}</div>}

      <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="col-span-full text-center py-6 text-gray-500 text-xs">Searching…</div>
        ) : models.length === 0 ? (
          <div className="col-span-full text-center py-6 text-gray-600 text-xs">No results yet</div>
        ) : (
          models.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              title={`${m.title} ${m.attribution}`}
              className="relative aspect-square rounded overflow-hidden border border-[#333] hover:border-blue-500 bg-[#1a1a1a]"
            >
              {m.thumbnail
                ? <img src={m.thumbnail} alt={m.title} className="w-full h-full object-cover" loading="lazy" />
                : <span className="absolute inset-0 flex items-center justify-center text-[9px] text-gray-500 p-1 text-center">{m.title}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
