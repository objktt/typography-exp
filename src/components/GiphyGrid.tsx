'use client';

import { useState, useEffect, memo } from 'react';
import type { GifResult } from '@/lib/giphy';

export type { GifResult };

interface GiphyGridProps {
  onSelectGif: (gif: GifResult) => void;
  selectedGif?: GifResult | null;
  compact?: boolean;
}

export const GiphyGrid = memo(function GiphyGrid({ onSelectGif, selectedGif, compact = false }: GiphyGridProps) {
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTrending, setIsTrending] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchGifs = async (query: string | undefined, resetOffset = true) => {
    setLoading(true);
    try {
      const { searchGifs, getTrendingGifs } = await import('@/lib/giphy');
      const currentOffset = resetOffset ? 0 : offset;
      const results = query
        ? await searchGifs(query, 40, currentOffset)
        : await getTrendingGifs(40);

      if (resetOffset) {
        setGifs(results);
        setOffset(0);
      } else {
        setGifs(prev => [...prev, ...results]);
        setOffset(currentOffset + 40);
      }
      setIsTrending(!query);
    } catch (error) {
      console.error('Failed to fetch gifs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGifs(undefined);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGifs(searchQuery || undefined, true);
  };

  const handleLoadMore = () => {
    fetchGifs(searchQuery || undefined, false);
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search GIFs..."
          className="flex-1 px-3 py-2 text-sm bg-[#222] border border-[#333] rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          🔍
        </button>
      </form>

      {isTrending && (
        <div className="text-xs text-gray-500">
          Trending GIFs
        </div>
      )}

      {/* GIF Grid */}
      <div className={`${compact ? 'grid grid-cols-3 gap-1' : 'grid grid-cols-2 gap-2'} max-h-${compact ? '200' : '400'}px overflow-y-auto`}>
        {loading && gifs.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500 text-sm">
            Loading...
          </div>
        ) : gifs.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500 text-sm">
            No GIFs found
          </div>
        ) : (
          <>
            {gifs.map((gif, idx) => (
              <button
                key={`${gif.id}-${idx}`}
                onClick={() => onSelectGif(gif)}
                className={`relative aspect-video rounded overflow-hidden border-2 transition-all ${
                  selectedGif?.id === gif.id
                    ? 'border-blue-500 ring-2 ring-blue-500/50'
                    : 'border-[#333] hover:border-gray-500'
                }`}
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {selectedGif?.id === gif.id && (
                  <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
              </button>
            ))}
            {loading && gifs.length > 0 && (
              <div className="col-span-full text-center py-4 text-gray-500 text-xs">
                Loading more...
              </div>
            )}
          </>
        )}
      </div>

      {/* Load More Button */}
      {!loading && gifs.length > 0 && (
        <button
          onClick={handleLoadMore}
          className="w-full py-2 text-xs bg-[#222] text-gray-400 rounded hover:bg-[#333] hover:text-white transition-colors"
        >
          Load More GIFs
        </button>
      )}
    </div>
  );
});
