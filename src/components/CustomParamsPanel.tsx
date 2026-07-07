'use client';

import { useState } from 'react';
import type { ControlParam } from '@/lib/types';

interface CustomParamsPanelProps {
  params: ControlParam[];
  values: any;
  onChange: (key: string, value: any) => void;
}

export function CustomParamsPanel({ params, values, onChange }: CustomParamsPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = params.reduce((acc, param) => {
    const folder = param.folder || 'General';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(param);
    return acc;
  }, {} as Record<string, ControlParam[]>);

  const renderInput = (param: ControlParam) => {
    const value = values[param.key] ?? param.default;

    switch (param.type) {
      case 'string':
        return param.multiline ? (
          <textarea
            value={value}
            rows={3}
            onChange={(e) => onChange(param.key, e.target.value)}
            placeholder="Enter for a new line"
            className="w-full px-2 py-1 text-xs bg-[#222] border border-[#333] rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-y leading-snug"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(param.key, e.target.value)}
            className="w-full px-2 py-1 text-xs bg-[#222] border border-[#333] rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        );

      case 'number':
        return (
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step || 0.01}
              value={value}
              onChange={(e) => onChange(param.key, parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer accent-blue-500"
            />
            <input
              type="number"
              min={param.min}
              max={param.max}
              step={param.step || 0.01}
              value={value}
              onChange={(e) => onChange(param.key, parseFloat(e.target.value))}
              className="w-14 px-1.5 py-0.5 text-xs bg-[#222] border border-[#333] rounded text-white text-center focus:outline-none focus:border-blue-500"
            />
          </div>
        );

      case 'boolean':
        return (
          <button
            onClick={() => onChange(param.key, !value)}
            className={`w-full py-1 text-xs rounded transition-colors ${
              value ? 'bg-blue-600 text-white' : 'bg-[#222] text-gray-400 hover:bg-[#333]'
            }`}
          >
            {value ? 'ON' : 'OFF'}
          </button>
        );

      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(param.key, e.target.value)}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(param.key, e.target.value)}
              className="flex-1 px-2 py-0.5 text-xs bg-[#222] border border-[#333] rounded text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onChange(param.key, e.target.value)}
            className="w-full px-2 py-1 text-xs bg-[#222] border border-[#333] rounded text-white focus:outline-none focus:border-blue-500"
          >
            {param.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'file':
        return (
          <div className="space-y-1">
            <label className="block">
              <span className="block w-full px-2 py-1.5 text-xs text-center bg-[#2a2a2a] border border-[#3a3a3a] rounded text-gray-200 cursor-pointer hover:bg-[#333] transition-colors">
                {value && String(value).startsWith('blob:') ? 'File loaded — replace…' : 'Choose file…'}
              </span>
              <input
                type="file"
                accept={param.accept}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onChange(param.key, URL.createObjectURL(f));
                }}
              />
            </label>
            <input
              type="text"
              value={value && String(value).startsWith('blob:') ? '' : value}
              onChange={(e) => onChange(param.key, e.target.value)}
              placeholder="or paste a URL"
              className="w-full px-2 py-1 text-xs bg-[#222] border border-[#333] rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([folder, folderParams]) => (
        <div key={folder} className="space-y-1.5">
          <button
            onClick={() => setCollapsed((c) => ({ ...c, [folder]: !c[folder] }))}
            className="flex items-center gap-1 w-full text-left text-[10px] uppercase tracking-wider text-gray-600 font-semibold hover:text-gray-400 transition-colors"
            aria-expanded={!collapsed[folder]}
          >
            <span className="text-[8px]">{collapsed[folder] ? '▸' : '▾'}</span>
            {folder}
          </button>
          {!collapsed[folder] && (
            <div className="space-y-1">
              {folderParams.map((param) => (
                <div key={param.key} className="flex items-center gap-2">
                  <label
                    className="text-[10px] text-gray-400 w-20 shrink-0 truncate cursor-default"
                    title={`${param.name} — double-click to reset to default`}
                    onDoubleClick={() => onChange(param.key, param.default)}
                  >
                    {param.name}
                  </label>
                  <div className="flex-1 min-w-0">
                    {renderInput(param)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
