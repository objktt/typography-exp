import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/templates/:id — fetch one template's full state (used by share links).
// Deliberately public: share links (?t=<id>) load the template before the
// recipient signs in, and ids are unguessable.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await sql`SELECT id, name, state FROM templates WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) return new NextResponse('not found', { status: 404 });
  const r = rows[0];
  return NextResponse.json({ id: r.id as string, name: r.name as string, state: r.state });
}

// DELETE /api/templates/:id — remove a template.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('unauthorized', { status: 401 });

  const { id } = await ctx.params;
  await sql`DELETE FROM templates WHERE id = ${id}`;
  return new NextResponse(null, { status: 204 });
}
