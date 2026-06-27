import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { PosterState } from '@/lib/types';

// Cloud-stored poster templates. A template is just a PosterState (pure data),
// so the client can rebuild the engines from it. Shared globally (this is a
// single-user studio tool — no auth), each row addressable by its short id.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/templates — list all templates (newest first), without the heavy state blob.
export async function GET() {
  const rows = await sql`
    SELECT id, name, layer_count, created_at
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
    })),
  );
}

// POST /api/templates — save (upsert by name) the current design. Body: { name, state }.
export async function POST(req: NextRequest) {
  let body: { name?: string; state?: PosterState };
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

  const layerCount = state.layers.length;
  const rows = await sql`
    INSERT INTO templates (name, state, layer_count)
    VALUES (${name}, ${JSON.stringify(state)}::jsonb, ${layerCount})
    ON CONFLICT (name) DO UPDATE
      SET state = EXCLUDED.state,
          layer_count = EXCLUDED.layer_count,
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
