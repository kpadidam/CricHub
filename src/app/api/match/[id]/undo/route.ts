import { undoLastBall } from '@/lib/engine';
import { store } from '@/lib/store';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const match = await store.get(id);
  if (!match) return Response.json({ error: 'Not found' }, { status: 404 });

  try {
    const updated = undoLastBall(match);
    await store.set(id, updated);
    return Response.json(updated);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
