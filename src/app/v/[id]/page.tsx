import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import type { PosterState } from '@/lib/types';
import { ShareViewer } from '@/components/ShareViewer';

// Public read-only share view: /v/<id> plays the poster live for anyone with
// the link (ids are unguessable random hex). Editing requires the studio.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getTemplate(id: string): Promise<{ name: string; state: PosterState } | null> {
  const rows = await sql`SELECT name, state FROM templates WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) return null;
  return { name: rows[0].name as string, state: rows[0].state as PosterState };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const tpl = await getTemplate(id);
  return {
    title: tpl ? `${tpl.name} — antlii` : 'antlii · typography studio',
    description: 'A live motion poster made with antlii.',
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tpl = await getTemplate(id);
  if (!tpl) notFound();
  return <ShareViewer state={tpl.state} name={tpl.name} />;
}
