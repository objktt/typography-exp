import type { PosterState } from './types';

// ---------------------------------------------------------------------------
// Poster templates — save a finished design under a name and reload it later.
// Stored in localStorage; a template is just a PosterState (pure data), so
// loadPoster() can rebuild the engines from it.
// ---------------------------------------------------------------------------

const KEY = 'antlii.templates.v1';

export interface PosterTemplate {
  name: string;
  createdAt: number;
  state: PosterState;
}

function read(): PosterTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PosterTemplate[]) : [];
  } catch {
    return [];
  }
}

function write(list: PosterTemplate[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota */ }
}

function clone(state: PosterState): PosterState {
  const sc = (globalThis as { structuredClone?: <T>(v: T) => T }).structuredClone;
  return sc ? sc(state) : JSON.parse(JSON.stringify(state));
}

export function listTemplates(): PosterTemplate[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

/** Save (or overwrite) a template by name. Returns the updated list. */
export function saveTemplate(name: string, state: PosterState): PosterTemplate[] {
  const trimmed = name.trim();
  if (!trimmed) return listTemplates();
  const list = read().filter((t) => t.name !== trimmed);
  list.push({ name: trimmed, createdAt: Date.now(), state: clone(state) });
  write(list);
  return listTemplates();
}

export function deleteTemplate(name: string): PosterTemplate[] {
  write(read().filter((t) => t.name !== name));
  return listTemplates();
}

export function getTemplate(name: string): PosterState | null {
  const t = read().find((x) => x.name === name);
  return t ? clone(t.state) : null;
}
