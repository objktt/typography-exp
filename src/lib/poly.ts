// Poly Pizza 3D model search — goes through our own API routes so the browser
// never hits api.poly.pizza directly (no CORS) and the GLB is streamed through
// our origin (loadable by GLTFLoader). Key lives server-side in .env.local:
//   NEXT_PUBLIC_POLY_PIZZA_API_KEY=...  (or POLY_PIZZA_API_KEY)

export interface ModelResult {
  id: string;
  title: string;
  thumbnail: string;
  glb: string;        // already proxied: /api/models/glb?url=...
  attribution: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function searchModels(query: string): Promise<ModelResult[]> {
  const res = await fetch(`/api/models/search?q=${encodeURIComponent(query)}`);
  if (res.status === 400) throw new Error('NO_KEY');
  if (!res.ok) throw new Error('SEARCH_FAILED');
  const data = await res.json();
  return (data.results ?? []).map((m: any) => ({
    id: m.id,
    title: m.title,
    thumbnail: m.thumbnail,
    attribution: m.attribution ?? '',
    glb: `/api/models/glb?url=${encodeURIComponent(m.glb)}`,
  }));
}
