import { NextRequest, NextResponse } from 'next/server';

// Server-side Poly Pizza search proxy — avoids browser CORS and keeps the key
// off the client. Returns normalized { results: [{ id, title, thumbnail, glb }] }.

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const key = process.env.POLY_PIZZA_API_KEY || process.env.NEXT_PUBLIC_POLY_PIZZA_API_KEY || '';
  if (!key) return NextResponse.json({ error: 'NO_KEY' }, { status: 400 });
  if (!q) return NextResponse.json({ results: [] });

  try {
    const r = await fetch(`https://api.poly.pizza/v1.1/search/${encodeURIComponent(q)}?Limit=24`, {
      headers: { 'x-auth-token': key },
    });
    if (!r.ok) return NextResponse.json({ error: `poly ${r.status}` }, { status: 502 });
    const data: any = await r.json();
    const items: any[] = data.results ?? data.Results ?? data.models ?? [];
    const results = items
      .map((x) => ({
        id: String(x.ID ?? x.id ?? x.Slug ?? x.Title ?? ''),
        title: x.Title ?? x.title ?? 'Model',
        thumbnail: x.Thumbnail ?? x.thumbnail ?? x.ThumbnailUrl ?? '',
        glb: x.Download ?? x.download ?? x.GLB ?? x.glb ?? x.Url ?? '',
        attribution: x.Attribution ?? x.attribution ?? (x.Creator?.Username ? `by ${x.Creator.Username}` : ''),
      }))
      .filter((m) => m.glb);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }
}
