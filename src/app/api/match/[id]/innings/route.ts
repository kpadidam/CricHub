import { closeInnings } from '@/lib/engine';
import { store } from '@/lib/store';

type Body = { striker: string; nonStriker: string; bowler: string };

export async function POST(
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
  if (!striker || !nonStriker || !bowler)
    return Response.json({ error: 'striker, nonStriker, bowler required' }, { status: 400 });

  try {
    const updated = closeInnings(match, { striker, nonStriker, bowler });
    await store.set(id, updated);
    return Response.json(updated);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
