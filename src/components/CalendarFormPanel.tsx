'use client';

import { useState } from 'react';

// Builds a calendar entry in the exact format the parser expects, and opens a
// prefilled Google Calendar "create event" link. Keeps the calendar the single
// source of truth while guaranteeing titles parse correctly.
//
// Title conventions:
//   GOOD BOY (@i_was_a_good_boy)
//   PAPAYA (Hogi @__hogi__ & Hender @hender__r)
//   Nanako (JP)

interface CalendarFormPanelProps {
  open: boolean;
  onClose: () => void;
}

const FIELD = 'w-full px-2 py-1.5 text-xs bg-[#222] border border-[#333] rounded text-white focus:outline-none focus:border-blue-500';

const COUNTRY = ['', 'JP', 'US', 'UK', 'DE', 'FR', 'NL', 'TW', 'HK', 'CN', 'AU', 'IT', 'ES', 'SE', 'TH', 'SG', 'ID'];

export function CalendarFormPanel({ open, onClose }: CalendarFormPanelProps) {
  const [kind, setKind] = useState<'listening' | 'party'>('listening');
  const [act, setAct] = useState('');
  const [m1n, setM1n] = useState('');
  const [m1h, setM1h] = useState('');
  const [m2n, setM2n] = useState('');
  const [m2h, setM2h] = useState('');
  const [origin, setOrigin] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const member = (n: string, h: string) => {
    const handle = h.trim() ? `@${h.trim().replace(/^@/, '')}` : '';
    return [n.trim(), handle].filter(Boolean).join(' ');
  };
  const members = [member(m1n, m1h), member(m2n, m2h)].filter(Boolean);
  const parenParts = [members.join(' & '), origin].filter(Boolean);
  const title = kind === 'party'
    ? (act.trim() || 'Party')
    : `${act.trim() || 'DJ'}${parenParts.length ? ` (${parenParts.join(', ')})` : ''}`;

  const fmt = (d: string) => d.replace(/-/g, '');
  const next = (d: string) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(date)}/${fmt(next(date))}&ctz=Asia/Seoul`;

  const copyTitle = async () => {
    try { await navigator.clipboard.writeText(title); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[400px] bg-[#141414] border border-[#333] rounded-lg shadow-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Add to Google Calendar</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xs">✕</button>
        </div>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Builds the title in the format the poster generator parses. Open the link, then pick the
          <span className="text-gray-300"> “오브옉트 디제이 캘린더” </span> calendar before saving.
        </p>

        <div className="flex gap-1 bg-[#0a0a0a] rounded p-0.5">
          {(['listening', 'party'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`flex-1 px-2 py-1 text-xs rounded ${kind === k ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {k === 'listening' ? 'Listening Session' : 'Party'}
            </button>
          ))}
        </div>

        <L label={kind === 'party' ? 'Party name' : 'Act / DJ name'}>
          <input className={FIELD} value={act} onChange={(e) => setAct(e.target.value)} placeholder={kind === 'party' ? '외부 파티' : 'GOOD BOY'} />
        </L>

        {kind === 'listening' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <L label="DJ 1 name"><input className={FIELD} value={m1n} onChange={(e) => setM1n(e.target.value)} placeholder="(optional)" /></L>
              <L label="DJ 1 handle"><input className={FIELD} value={m1h} onChange={(e) => setM1h(e.target.value)} placeholder="i_was_a_good_boy" /></L>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <L label="DJ 2 name"><input className={FIELD} value={m2n} onChange={(e) => setM2n(e.target.value)} placeholder="(if duo)" /></L>
              <L label="DJ 2 handle"><input className={FIELD} value={m2h} onChange={(e) => setM2h(e.target.value)} placeholder="(if duo)" /></L>
            </div>
            <L label="Origin (international)">
              <select className={FIELD} value={origin} onChange={(e) => setOrigin(e.target.value)}>
                {COUNTRY.map((c) => <option key={c} value={c}>{c || 'Korea (none)'}</option>)}
              </select>
            </L>
          </>
        )}

        <L label="Date">
          <input type="date" className={`${FIELD} [color-scheme:dark]`} value={date} onChange={(e) => setDate(e.target.value)} />
        </L>

        {/* Preview */}
        <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2">
          <div className="text-[9px] uppercase tracking-wider text-gray-600 mb-1">Calendar title</div>
          <div className="text-xs text-gray-100 font-mono break-words">{title}</div>
        </div>

        <div className="flex gap-2">
          <button onClick={copyTitle} className="px-3 py-2 text-xs font-medium bg-[#222] text-gray-200 rounded hover:bg-[#333]">
            {copied ? 'Copied ✓' : 'Copy title'}
          </button>
          <a href={gcalUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center px-3 py-2 text-xs font-semibold bg-white text-black rounded hover:bg-gray-200">
            Open in Google Calendar →
          </a>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
