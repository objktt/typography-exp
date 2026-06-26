'use client';

import { useState } from 'react';
import type { PosterState } from '@/lib/types';
import { generatePoster, POSTER_STYLES, type EventInfo, type PosterFormat } from '@/lib/poster-generator';
import calendarEvents from '@/lib/calendar-events.json';

interface CalEvent { date: string; dj: string; title: string; timeText: string; kind: string; lineup?: string; origin?: string }
const EVENTS = calendarEvents as CalEvent[];
const findEvent = (iso: string) => EVENTS.find((e) => e.date === iso);

interface GeneratePanelProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (poster: PosterState) => void;
}

const FIELD = 'w-full px-2 py-1.5 text-xs bg-[#222] border border-[#333] rounded text-white focus:outline-none focus:border-blue-500';

/** ISO date (YYYY-MM-DD) → "SAT 13 JUN". */
function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  const p = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: '2-digit', month: 'short' }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('weekday')} ${g('day')} ${g('month')}`.toUpperCase();
}

export function GeneratePanel({ open, onClose, onGenerate }: GeneratePanelProps) {
  const today = new Date().toISOString().slice(0, 10);
  const initial = EVENTS.find((e) => e.date >= today) ?? EVENTS[EVENTS.length - 1] ?? null;

  const [title, setTitle] = useState(initial?.title ?? 'Listening Session');
  const [dj, setDj] = useState(initial?.dj ?? 'Peggy Gou');
  const [lineup, setLineup] = useState(initial?.lineup ?? '');
  const [origin, setOrigin] = useState(initial?.origin ?? '');
  const [date, setDate] = useState<string>(initial?.date ?? today);
  const [timeText, setTimeText] = useState(initial?.timeText ?? '21:00 – 23:00');
  const [venue, setVenue] = useState('Objktt');
  const [slogan, setSlogan] = useState('Every Object is a Universe in Itself.');
  const [style, setStyle] = useState('auto');
  const [format, setFormat] = useState<PosterFormat>('feed');

  if (!open) return null;

  // Pick a date → auto-fill DJ / title / time from the calendar (if there's an event).
  const onDateChange = (iso: string) => {
    setDate(iso);
    const ev = findEvent(iso);
    if (ev) { setDj(ev.dj); setTitle(ev.title); setTimeText(ev.timeText); setLineup(ev.lineup ?? ''); setOrigin(ev.origin ?? ''); }
  };

  const submit = () => {
    const ev: EventInfo = { title, dj, lineup: lineup || undefined, origin: origin || undefined, dateText: formatDisplayDate(date), timeText, venue: venue || undefined, slogan: slogan || undefined };
    onGenerate(generatePoster(ev, style === 'auto' ? undefined : style, format));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[380px] bg-[#141414] border border-[#333] rounded-lg shadow-2xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Generate Poster</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xs">✕</button>
        </div>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Parsed from a calendar event (DJ · date · time). Style is auto-picked unless you choose one.
        </p>

        <div className="space-y-2">
          <Field label="Event">
            <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="DJ / Artist">
            <input className={FIELD} value={dj} onChange={(e) => setDj(e.target.value)} />
          </Field>
          <Field label="Line-up">
            <input className={FIELD} value={lineup} onChange={(e) => setLineup(e.target.value)} placeholder="e.g. Hogi & Hender (multi-DJ)" />
          </Field>
          <Field label="Origin">
            <input className={FIELD} value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. Japan (international DJ)" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date">
              <input type="date" className={`${FIELD} [color-scheme:dark]`} value={date} onChange={(e) => onDateChange(e.target.value)} />
            </Field>
            <Field label="Time">
              <input className={FIELD} value={timeText} onChange={(e) => setTimeText(e.target.value)} />
            </Field>
          </div>
          <Field label="Venue">
            <input className={FIELD} value={venue} onChange={(e) => setVenue(e.target.value)} />
          </Field>
          <Field label="Slogan">
            <input className={FIELD} value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="brand tagline" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Format">
              <select className={FIELD} value={format} onChange={(e) => setFormat(e.target.value as PosterFormat)}>
                <option value="feed">IG Feed (4:5)</option>
                <option value="story">IG Story (9:16)</option>
              </select>
            </Field>
            <Field label="Style">
              <select className={FIELD} value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="auto">Auto</option>
                {POSTER_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <button
          onClick={submit}
          className="w-full py-2 text-xs font-semibold bg-white text-black rounded hover:bg-gray-200 transition-colors"
        >
          Generate
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
