import type { DetectedEvent } from './poster-generator';

// ---------------------------------------------------------------------------
// Calendar adapter — maps a Google Calendar event (as returned by the
// calendar MCP / API) into the EventInfo the poster generator consumes.
//
// This calendar ("오브옉트 디제이 캘린더") is a dedicated DJ booking calendar,
// so every confirmed entry is treated as a booking. Convention observed:
//   • All-day entries named "ACT (@handle)"  → listening session / DJ set
//   • Timed entries like "외부 파티 / 대관파티" → party
// ---------------------------------------------------------------------------

export interface GCalEventTime {
  date?: string;       // all-day, e.g. "2026-06-13" (may carry a T..Z suffix)
  dateTime?: string;   // timed, ISO 8601 with offset
  timeZone?: string;
}

export interface GCalEvent {
  summary?: string;
  description?: string;
  status?: string;
  htmlLink?: string;
  start?: GCalEventTime;
  end?: GCalEventTime;
}

const TZ = 'Asia/Seoul';
const PARTY_RX = /파티|\bparty\b|\brave\b|\bclub\b/i;

/** Act / DJ name = the text before "(" (where handles live), else whole title. */
function parseAct(summary: string): string {
  const beforeParen = summary.split('(')[0].trim();
  return beforeParen || summary.trim();
}

// Country codes → display names. International DJs get their origin shown.
const ORIGIN_NAMES: Record<string, string> = {
  JP: 'Japan', US: 'USA', GB: 'UK', UK: 'UK', DE: 'Germany', FR: 'France',
  NL: 'Netherlands', KR: 'Korea', TW: 'Taiwan', HK: 'Hong Kong', CN: 'China',
  AU: 'Australia', IT: 'Italy', ES: 'Spain', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', BE: 'Belgium', CA: 'Canada', BR: 'Brazil', MX: 'Mexico',
  TH: 'Thailand', SG: 'Singapore', ID: 'Indonesia', PH: 'Philippines', VN: 'Vietnam',
};

/** Origin country for an international act, parsed from a "(JP)"-style code. */
function parseOrigin(summary: string): string {
  const groups = summary.match(/\(([^)]*)\)/g) || [];
  for (const g of groups) {
    const inner = g.slice(1, -1).replace(/@\S+/g, ' ');
    for (const tok of inner.split(/[\s,&]+/)) {
      const t = tok.trim().toUpperCase();
      if (ORIGIN_NAMES[t]) return ORIGIN_NAMES[t];
    }
  }
  return '';
}

/**
 * Member line-up inside the parentheses, e.g.
 * "PAPAYA (Hogi @__hogi__ & Hender @hender__r)" → "Hogi & Hender".
 * Strips @handles and country codes; returns "" unless 2+ named members.
 */
function parseLineup(summary: string): string {
  const m = summary.match(/\(([^)]*)\)/);
  if (!m) return '';
  const inner = m[1].replace(/@\S+/g, ' ');
  const parts = inner
    .split(/&|,|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !/^[A-Z]{2,3}$/.test(p)); // drop country codes like "JP"
  return parts.length >= 2 ? parts.join(' & ') : '';
}

function isAllDay(t?: GCalEventTime): boolean {
  return !!t?.date && !t?.dateTime;
}

function toDate(t?: GCalEventTime): Date | null {
  if (!t) return null;
  if (t.dateTime) return new Date(t.dateTime);
  if (t.date) {
    // Anchor all-day dates at local noon (Seoul) to avoid timezone roll-over.
    const ymd = t.date.slice(0, 10);
    return new Date(`${ymd}T12:00:00+09:00`);
  }
  return null;
}

/** "SAT 13 JUN" */
function formatDate(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')}`.toUpperCase();
}

/** "19:00" in Seoul time. */
function formatTime(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

/**
 * Convert a Google Calendar event into a DetectedEvent.
 * Returns null for empty / cancelled entries.
 *
 * @param assumeDj  When true (default), every named event is treated as a DJ
 *                  booking — appropriate for the dedicated DJ calendar. Set
 *                  false to require party/session keywords (general calendars).
 */
export function eventFromGoogle(ev: GCalEvent, assumeDj = true): DetectedEvent | null {
  const summary = (ev.summary ?? '').trim();
  if (!summary || ev.status === 'cancelled') return null;

  const isParty = PARTY_RX.test(`${summary} ${ev.description ?? ''}`);
  if (!assumeDj && !isParty && !/listening|리스닝|\bdj\b|set\b/i.test(summary)) return null;

  const start = toDate(ev.start);
  const end = toDate(ev.end);
  const dateText = start ? formatDate(start) : '';

  // Set time. Listening sessions run a fixed slot: 21:00–23:00, but when there
  // are two DJs (two @handles / "&") it starts an hour earlier at 20:00.
  const twoDjs = (summary.match(/@/g) || []).length >= 2 || /&/.test(summary);
  let timeText: string;
  if (!isParty) {
    timeText = twoDjs ? '20:00 – 23:00' : '21:00 – 23:00';
  } else if (start && end && !isAllDay(ev.start)) {
    timeText = `${formatTime(start)} – ${formatTime(end)}`;
  } else {
    timeText = '21:00 – 23:00';
  }

  const act = parseAct(summary);
  const lineup = parseLineup(summary);
  const origin = parseOrigin(summary);

  return {
    kind: isParty ? 'party' : 'listening',
    title: isParty ? summary : 'Listening Session',
    dj: act,
    lineup: lineup || undefined,
    origin: origin || undefined,
    dateText,
    timeText,
  };
}

/** Map a list of calendar events, dropping non-bookings. */
export function eventsFromGoogle(events: GCalEvent[], assumeDj = true): DetectedEvent[] {
  return events
    .map((e) => eventFromGoogle(e, assumeDj))
    .filter((e): e is DetectedEvent => e !== null);
}
