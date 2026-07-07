'use client';

import { useState, useRef } from 'react';
import type { Layer, EngineType } from '@/lib/types';
import { engineRegistry } from '@/lib/engine-registry';

interface LayerListProps {
  layers: Layer[];
  selectedLayerId: string | null;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddLayer: (type: EngineType) => void;
}

const engineTypes = Object.keys(engineRegistry) as EngineType[];

export function LayerList({
  layers,
  selectedLayerId,
  onSelect,
  onToggleVisibility,
  onRemove,
  onDuplicate,
  onRename,
  onReorder,
  onAddLayer,
}: LayerListProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Display top-first (last in array = top of stack)
  const displayLayers = [...layers].reverse();

  const handleDragStart = (displayIndex: number) => {
    dragItem.current = displayIndex;
  };

  const handleDragEnter = (displayIndex: number) => {
    dragOverItem.current = displayIndex;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      // Convert display indices back to array indices
      const fromArray = layers.length - 1 - dragItem.current;
      const toArray = layers.length - 1 - dragOverItem.current;
      onReorder(fromArray, toArray);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Layers</h3>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="px-2 py-0.5 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            + Add
          </button>
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#222] border border-[#444] rounded shadow-lg z-10 min-w-[120px]">
              {engineTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    onAddLayer(type);
                    setShowAddMenu(false);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[#333] hover:text-white transition-colors"
                >
                  {engineRegistry[type].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {layers.length === 0 ? (
        <div className="text-xs text-gray-600 text-center py-4">No layers yet</div>
      ) : (
        <div className="space-y-0.5">
          {displayLayers.map((layer, displayIndex) => (
            <div
              key={layer.id}
              draggable
              onDragStart={() => handleDragStart(displayIndex)}
              onDragEnter={() => handleDragEnter(displayIndex)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => onSelect(layer.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors select-none ${
                selectedLayerId === layer.id
                  ? 'bg-blue-600/20 border border-blue-600/40'
                  : 'bg-[#1a1a1a] border border-transparent hover:bg-[#222]'
              }`}
            >
              {/* Drag handle */}
              <span className="text-gray-600 text-[10px] cursor-grab">⋮⋮</span>

              {/* Visibility toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(layer.id);
                }}
                className={`text-[10px] w-4 text-center ${
                  layer.visible ? 'text-white' : 'text-gray-600'
                }`}
              >
                {layer.visible ? '●' : '○'}
              </button>

              {/* Layer name — double-click to rename */}
              {renamingId === layer.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => {
                    if (renameValue.trim()) onRename(layer.id, renameValue.trim());
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="flex-1 min-w-0 px-1 py-0.5 text-xs bg-[#222] border border-blue-500 rounded text-white focus:outline-none"
                />
              ) : (
                <span
                  className="flex-1 text-xs text-gray-300 truncate"
                  title={`${layer.name} — double-click to rename`}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(layer.id);
                    setRenameValue(layer.name);
                  }}
                >
                  {layer.name}
                </span>
              )}

              {/* Engine badge */}
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#333] text-gray-500 uppercase">
                {engineRegistry[layer.engineType].label}
              </span>

              {/* Duplicate */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(layer.id);
                }}
                title="Duplicate (⌘D)"
                aria-label="Duplicate layer"
                className="text-gray-600 hover:text-white text-[10px] transition-colors"
              >
                ⧉
              </button>

              {/* Delete */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(layer.id);
                }}
                title="Delete"
                aria-label="Delete layer"
                className="text-gray-600 hover:text-red-400 text-[10px] transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
