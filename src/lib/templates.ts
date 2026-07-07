import type { PosterState } from './types';

// ---------------------------------------------------------------------------
// Poster templates — save a finished design under a name and reload it later.
// Stored server-side in Neon (Postgres) via /api/templates, so templates persist
// across devices and can be shared by URL. A template is just a PosterState
// (pure data), so loadPoster() can rebuild the engines from it.
// ---------------------------------------------------------------------------

export interface TemplateMeta {
  id: string;
  name: string;
  layerCount: number;
  createdAt: number;
  thumb: string | null;
}

/** List all saved templates (metadata only, newest first). */
export async function listTemplates(): Promise<TemplateMeta[]> {
  const res = await fetch('/api/templates', { cache: 'no-store' });
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  return res.json();
}

/** Save (or overwrite by name) the current design. Returns the saved metadata. */
export async function saveTemplate(name: string, state: PosterState, thumb?: string | null): Promise<TemplateMeta> {
  const res = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, state, thumb: thumb ?? undefined }),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  return res.json();
}

/** Delete a template by id. */
export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
}

/** Fetch a single template's full PosterState by id (used by Load + share links). */
export async function getTemplate(id: string): Promise<PosterState | null> {
  const res = await fetch(`/api/templates/${id}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get failed: ${res.status}`);
  const data = (await res.json()) as { state: PosterState };
  return data.state;
}

/** Shareable URL — a public read-only viewer that plays the poster live. */
export function shareUrl(id: string): string {
  if (typeof window === 'undefined') return `/v/${id}`;
  return `${window.location.origin}/v/${id}`;
}
