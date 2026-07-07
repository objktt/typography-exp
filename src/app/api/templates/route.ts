import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import type { PosterState } from '@/lib/types';

// Cloud-stored poster templates. A template is just a PosterState (pure data),
// so the client can rebuild the engines from it. Templates are shared globally
// across signed-in users (single-user studio tool), each row addressable by its
// short id. All access here requires a Clerk session; only the share-link read
// (GET /api/templates/:id) is public.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireSession(): Promise<NextResponse | null> {
  const { userId } = await auth();
  return userId ? null : new NextResponse('unauthorized', { status: 401 });
}

// GET /api/templates — list all templates (newest first), without the heavy state blob.
export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  const rows = await sql`
    SELECT id, name, layer_count, created_at, thumb
    FROM templates
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      layerCount: r.layer_count as number,
      createdAt: new Date(r.created_at as string).getTime(),
      thumb: (r.thumb as string | null) ?? null,
    })),
  );
}

// POST /api/templates — save (upsert by name) the current design. Body: { name, state }.
export async function POST(req: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;

  let body: { name?: string; state?: PosterState; thumb?: string | null };
  try {
    body = await req.json();
  } catch {
    return new NextResponse('bad json', { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const state = body.state;
  if (!name) return new NextResponse('name required', { status: 400 });
  if (!state || !Array.isArray(state.layers)) {
    return new NextResponse('valid state required', { status: 400 });
  }
  // Thumbnail is optional: a small data-URL image captured from the canvas.
  let thumb: string | null = null;
  if (typeof body.thumb === 'string' && body.thumb.startsWith('data:image/') && body.thumb.length <= 400_000) {
    thumb = body.thumb;
  }

  const layerCount = state.layers.length;
  const rows = await sql`
    INSERT INTO templates (name, state, layer_count, thumb)
    VALUES (${name}, ${JSON.stringify(state)}::jsonb, ${layerCount}, ${thumb})
    ON CONFLICT (name) DO UPDATE
      SET state = EXCLUDED.state,
          layer_count = EXCLUDED.layer_count,
          thumb = COALESCE(EXCLUDED.thumb, templates.thumb),
          updated_at = now()
    RETURNING id, name, layer_count, created_at
  `;
  const r = rows[0];
  return NextResponse.json({
    id: r.id as string,
    name: r.name as string,
    layerCount: r.layer_count as number,
    createdAt: new Date(r.created_at as string).getTime(),
  });
}
