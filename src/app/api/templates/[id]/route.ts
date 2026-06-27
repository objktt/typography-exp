import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/templates/:id — fetch one template's full state (used by share links).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await sql`SELECT id, name, state FROM templates WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) return new NextResponse('not found', { status: 404 });
  const r = rows[0];
  return NextResponse.json({ id: r.id as string, name: r.name as string, state: r.state });
}

// DELETE /api/templates/:id — remove a template.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await sql`DELETE FROM templates WHERE id = ${id}`;
  return new NextResponse(null, { status: 204 });
}
