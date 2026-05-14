import { setPlayers } from '@/lib/engine';
import { store } from '@/lib/store';

type Body = { striker?: string; nonStriker?: string; bowler?: string };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const match = await store.get(id);
  if (!match) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { striker, nonStriker, bowler } = body ?? ({} as Body);
  if (striker === undefined && nonStriker === undefined && bowler === undefined)
    return Response.json({ error: 'provide at least one of striker|nonStriker|bowler' }, { status: 400 });
  if (striker !== undefined && (typeof striker !== 'string' || !striker.trim()))
    return Response.json({ error: 'striker must be non-empty string' }, { status: 400 });
  if (nonStriker !== undefined && (typeof nonStriker !== 'string' || !nonStriker.trim()))
    return Response.json({ error: 'nonStriker must be non-empty string' }, { status: 400 });
  if (bowler !== undefined && (typeof bowler !== 'string' || !bowler.trim()))
    return Response.json({ error: 'bowler must be non-empty string' }, { status: 400 });

  try {
    const updated = setPlayers(match, { striker, nonStriker, bowler });
    await store.set(id, updated);
    return Response.json(updated);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
