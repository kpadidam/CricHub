import { applyBall } from '@/lib/engine';
import { store } from '@/lib/store';
import type { BallInput, Extra, WicketType } from '@/lib/types';

const EXTRAS: Extra[] = ['wd', 'nb', 'b', 'lb'];
const WICKET_TYPES: WicketType[] = [
  'bowled',
  'caught',
  'caught-and-bowled',
  'lbw',
  'run-out',
  'stumped',
  'hit-wicket',
  'retired-hurt',
  'retired-out',
  'obstructing-field',
  'hit-ball-twice',
];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const match = await store.get(id);
  if (!match) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: BallInput;
  try {
    body = (await req.json()) as BallInput;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { runs, extra, wicket, wicketType, dismissedPlayer, fielder, runOutEnd, batRuns } =
    body ?? ({} as BallInput);
  if (typeof runs !== 'number' || runs < 0 || !Number.isInteger(runs))
    return Response.json({ error: 'runs must be a non-negative integer' }, { status: 400 });
  if (extra !== undefined && !EXTRAS.includes(extra))
    return Response.json({ error: 'extra must be wd|nb|b|lb' }, { status: 400 });
  if (wicket !== undefined && typeof wicket !== 'boolean')
    return Response.json({ error: 'wicket must be boolean' }, { status: 400 });

  if (wicket) {
    if (wicketType !== undefined) {
      if (typeof wicketType !== 'string' || !WICKET_TYPES.includes(wicketType as WicketType))
        return Response.json({ error: 'wicketType invalid' }, { status: 400 });
    }
  }

  if (runOutEnd !== undefined && runOutEnd !== 'striker' && runOutEnd !== 'non-striker')
    return Response.json({ error: 'runOutEnd must be striker|non-striker' }, { status: 400 });

  if (batRuns !== undefined) {
    if (typeof batRuns !== 'number' || batRuns < 0 || !Number.isInteger(batRuns))
      return Response.json({ error: 'batRuns must be a non-negative integer' }, { status: 400 });
    if (extra !== 'nb')
      return Response.json({ error: 'batRuns only valid with extra=nb' }, { status: 400 });
  }

  // Roster lookups for player validation.
  const currentInn = match.innings[match.innings.length - 1]!;
  const battingTeam = currentInn.battingTeam;
  const batRoster = battingTeam === 'A' ? match.playersA : match.playersB;
  const bowlRoster = battingTeam === 'A' ? match.playersB : match.playersA;

  if (dismissedPlayer !== undefined) {
    if (typeof dismissedPlayer !== 'string' || !dismissedPlayer.trim())
      return Response.json({ error: 'dismissedPlayer must be non-empty string' }, { status: 400 });
    if (!batRoster.includes(dismissedPlayer))
      return Response.json({ error: 'dismissedPlayer not in batting roster' }, { status: 400 });
  }
  if (fielder !== undefined) {
    if (typeof fielder !== 'string' || !fielder.trim())
      return Response.json({ error: 'fielder must be non-empty string' }, { status: 400 });
    if (!bowlRoster.includes(fielder))
      return Response.json({ error: 'fielder not in bowling roster' }, { status: 400 });
  }

  try {
    const updated = applyBall(match, {
      runs,
      extra,
      wicket,
      wicketType,
      dismissedPlayer,
      fielder,
      runOutEnd,
      batRuns,
    });
    await store.set(id, updated);
    return Response.json(updated);
  } catch (e) {
    const msg = (e as Error).message ?? 'Engine error';
    // Engine validation errors (bad dismissal for delivery, etc.) → 400.
    const isValidation =
      /^Invalid wicketType/.test(msg) ||
      /not allowed on /.test(msg) ||
      /Awaiting new /.test(msg) ||
      /Innings break/.test(msg) ||
      /Match is finished/.test(msg) ||
      /Invalid dismissal/.test(msg);
    return Response.json({ error: msg }, { status: isValidation ? 400 : 500 });
  }
}
