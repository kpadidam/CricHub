import { initInnings } from '@/lib/engine';
import { store } from '@/lib/store';
import type { Match, MatchFormat, MatchRules, TeamSide } from '@/lib/types';

type CreateBody = {
  teamA: string;
  teamB: string;
  oversLimit: number;
  playersA: string[];
  playersB: string[];
  toss: { winner: TeamSide; elected: 'bat' | 'bowl' };
  openers: { striker: string; nonStriker: string; bowler: string };
  venue?: string;
  matchFormat?: MatchFormat;
  rules?: Partial<MatchRules>;
};

const VALID_FORMATS: MatchFormat[] = ['T5', 'T10', 'T20', 'ODI', 'custom'];

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function defaultRules(oversLimit: number): MatchRules {
  const maxHalf = Math.max(1, Math.floor(oversLimit / 2));
  return {
    wideRuns: 1,
    noBallRuns: 1,
    maxOversPerBowler: Math.max(1, Math.ceil(oversLimit / 5)),
    powerplayOvers: clamp(Math.round(oversLimit * 0.3), 1, maxHalf),
  };
}

export async function POST(req: Request): Promise<Response> {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return bad('Invalid JSON');
  }

  const { teamA, teamB, oversLimit, toss, playersA, playersB, openers, venue, matchFormat, rules } =
    body ?? ({} as CreateBody);
  if (!teamA || !teamB) return bad('teamA and teamB required');
  if (typeof oversLimit !== 'number' || oversLimit <= 0) return bad('oversLimit must be > 0');
  if (!toss || (toss.winner !== 'A' && toss.winner !== 'B')) return bad('toss.winner required');
  if (toss.elected !== 'bat' && toss.elected !== 'bowl') return bad('toss.elected required');
  if (!Array.isArray(playersA) || playersA.length < 2) return bad('playersA must have >= 2 names');
  if (!Array.isArray(playersB) || playersB.length < 2) return bad('playersB must have >= 2 names');
  if (playersA.some((n) => typeof n !== 'string' || !n.trim())) return bad('playersA invalid');
  if (playersB.some((n) => typeof n !== 'string' || !n.trim())) return bad('playersB invalid');
  if (!openers || !openers.striker || !openers.nonStriker || !openers.bowler)
    return bad('openers.{striker,nonStriker,bowler} required');

  if (venue !== undefined && typeof venue !== 'string') return bad('venue must be a string');
  if (matchFormat !== undefined && !VALID_FORMATS.includes(matchFormat))
    return bad('matchFormat must be one of T5|T10|T20|ODI|custom');

  const base = defaultRules(oversLimit);
  const finalRules: MatchRules = { ...base };
  if (rules) {
    if (rules.wideRuns !== undefined) {
      if (rules.wideRuns !== 1 && rules.wideRuns !== 2) return bad('rules.wideRuns must be 1 or 2');
      finalRules.wideRuns = rules.wideRuns;
    }
    if (rules.noBallRuns !== undefined) {
      if (rules.noBallRuns !== 1 && rules.noBallRuns !== 2)
        return bad('rules.noBallRuns must be 1 or 2');
      finalRules.noBallRuns = rules.noBallRuns;
    }
    if (rules.maxOversPerBowler !== undefined) {
      const v = rules.maxOversPerBowler;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > oversLimit)
        return bad(`rules.maxOversPerBowler must be in [1, ${oversLimit}]`);
      finalRules.maxOversPerBowler = v;
    }
    if (rules.powerplayOvers !== undefined) {
      const v = rules.powerplayOvers;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > oversLimit)
        return bad(`rules.powerplayOvers must be in [1, ${oversLimit}]`);
      finalRules.powerplayOvers = v;
    }
  }

  const battingTeam: TeamSide =
    toss.elected === 'bat' ? toss.winner : toss.winner === 'A' ? 'B' : 'A';
  const bowlingTeam: TeamSide = battingTeam === 'A' ? 'B' : 'A';
  const batRoster = battingTeam === 'A' ? playersA : playersB;
  const bowlRoster = bowlingTeam === 'A' ? playersA : playersB;

  if (!batRoster.includes(openers.striker)) return bad('striker not in batting roster');
  if (!batRoster.includes(openers.nonStriker)) return bad('nonStriker not in batting roster');
  if (openers.striker === openers.nonStriker) return bad('striker and nonStriker must differ');
  if (!bowlRoster.includes(openers.bowler)) return bad('bowler not in bowling roster');

  const innings1 = initInnings(battingTeam, openers);

  const now = Date.now();
  const created = await store.create({
    teamA,
    teamB,
    oversLimit,
    playersA,
    playersB,
    toss,
    innings: [innings1],
    status: 'live',
    ...(venue && venue.trim() ? { venue: venue.trim() } : {}),
    ...(matchFormat ? { matchFormat } : {}),
    rules: finalRules,
    createdAt: now,
    updatedAt: now,
  } as Omit<Match, 'id'>);

  return Response.json({ id: created.id, match: created }, { status: 201 });
}
