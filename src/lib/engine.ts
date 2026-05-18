/**
 * Cricket scoring engine — pure functions, no I/O.
 *
 * Scoring rules:
 *   - wd: +1 penalty + any runs taken; not a legal ball; not bat-faced; all
 *     runs (penalty + runs) charged to bowler; nothing to batter.
 *   - nb: +1 penalty; not a legal ball; bat-faced. `batRuns` (or `runs` as
 *     fallback) are bat-off runs credited to the batter; remaining `runs`
 *     (when `batRuns` is explicitly provided) are byes/leg-byes added to
 *     extras only.
 *   - b/lb: legal ball; runs to extras; ball faced by batter; NOT charged to
 *     bowler's runsConceded.
 *   - normal: legal ball; runs to batter and bowler; ball faced.
 *   - boundary 4/6 counted only on off-bat runs (extra === undefined).
 *
 * Strike rotation:
 *   - odd runs taken (any kind) → swap.
 *   - end of legal over → swap (regardless of wicket on that ball).
 */

import type {
  Ball,
  BallInput,
  BatterStat,
  BatterStatus,
  BowlerStat,
  Extra,
  FallOfWicket,
  Innings,
  Match,
  TeamSide,
  WicketType,
} from './types';

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

export const ALL_WICKET_TYPES = WICKET_TYPES;

// Wicket types that do not consume a delivery (no ball-count, no faced ball,
// no bowler ball). retired-hurt additionally doesn't count as a wicket.
const NON_DELIVERY_WICKETS: WicketType[] = ['retired-hurt', 'retired-out'];

function isNonDelivery(wt: WicketType | undefined): boolean {
  return wt !== undefined && NON_DELIVERY_WICKETS.includes(wt);
}

function formatOvers(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function formatBallLabel(legalBallsBefore: number): string {
  return `${Math.floor(legalBallsBefore / 6)}.${(legalBallsBefore % 6) + 1}`;
}

function bowlerCreditedFor(wt: WicketType | undefined): boolean {
  if (!wt) return true;
  return (
    wt !== 'run-out' &&
    wt !== 'retired-hurt' &&
    wt !== 'retired-out' &&
    wt !== 'obstructing-field' &&
    wt !== 'hit-ball-twice'
  );
}

export function validateWicketForDelivery(
  extra: Extra | undefined,
  wicketType: WicketType | undefined,
  freeHitActive: boolean
): { valid: boolean; reason?: string } {
  if (!wicketType) return { valid: true };

  // retired-hurt / retired-out are non-delivery events: no extra context required.
  if (isNonDelivery(wicketType)) return { valid: true };

  const runOutLike: WicketType[] = ['run-out', 'obstructing-field', 'hit-ball-twice'];

  if (freeHitActive || extra === 'nb') {
    if (!runOutLike.includes(wicketType)) {
      return {
        valid: false,
        reason: `Dismissal '${wicketType}' not allowed on ${extra === 'nb' ? 'no-ball' : 'free hit'}`,
      };
    }
    return { valid: true };
  }

  if (extra === 'wd') {
    const allowed: WicketType[] = ['run-out', 'stumped', 'obstructing-field', 'hit-wicket'];
    if (!allowed.includes(wicketType)) {
      return { valid: false, reason: `Dismissal '${wicketType}' not allowed on wide` };
    }
    return { valid: true };
  }

  if (extra === 'b' || extra === 'lb') {
    if (!runOutLike.includes(wicketType)) {
      return { valid: false, reason: `Dismissal '${wicketType}' not allowed on ${extra}` };
    }
    return { valid: true };
  }

  return { valid: true };
}

function howOutString(
  wt: WicketType,
  bowler: string | undefined,
  fielder: string | undefined
): string {
  const b = bowler ?? '';
  const f = fielder ?? '';
  switch (wt) {
    case 'bowled':
      return `b ${b}`.trim();
    case 'caught':
      return f ? `c ${f} b ${b}`.trim() : `c b ${b}`.trim();
    case 'caught-and-bowled':
      return `c & b ${b}`.trim();
    case 'lbw':
      return `lbw b ${b}`.trim();
    case 'run-out':
      return f ? `run out (${f})` : 'run out';
    case 'stumped':
      return f ? `st †${f} b ${b}`.trim() : `st b ${b}`.trim();
    case 'hit-wicket':
      return `hit wicket b ${b}`.trim();
    case 'retired-hurt':
      return 'retired hurt';
    case 'retired-out':
      return 'retired out';
    case 'obstructing-field':
      return 'obstructing the field';
    case 'hit-ball-twice':
      return 'hit the ball twice';
  }
}

function statusFromWicket(wt: WicketType): BatterStatus {
  if (wt === 'retired-hurt') return 'retired-hurt';
  if (wt === 'retired-out') return 'retired-out';
  return 'out';
}

function currentInningsIndex(match: Match): 0 | 1 {
  return match.innings.length === 2 ? 1 : 0;
}

function getCurrent(match: Match): Innings {
  return match.innings[currentInningsIndex(match)] as Innings;
}

function replaceInnings(match: Match, idx: 0 | 1, innings: Innings): Match {
  const next = [...match.innings] as Match['innings'];
  next[idx] = innings;
  return { ...match, innings: next, updatedAt: Date.now() };
}

function swapBatters(inn: Innings): Innings {
  return { ...inn, striker: inn.nonStriker, nonStriker: inn.striker };
}

function emptyBatter(name: string): BatterStat {
  return { name, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, out: false, status: 'active' };
}

function emptyBowler(name: string): BowlerStat {
  return { name, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 };
}

// Keep the boolean `awaitingNewBatter` field in sync with the authoritative
// slot field. Frontend back-compat reads still rely on the boolean.
function syncAwaitingFlag(inn: Innings): Innings {
  return { ...inn, awaitingNewBatter: !!inn.awaitingNewBatterFor };
}

export function initInnings(
  team: TeamSide,
  openers: { striker: string; nonStriker: string; bowler: string }
): Innings {
  return {
    battingTeam: team,
    runs: 0,
    wickets: 0,
    ballsBowled: 0,
    extras: 0,
    balls: [],
    striker: openers.striker,
    nonStriker: openers.nonStriker,
    bowler: openers.bowler,
    batters: [emptyBatter(openers.striker), emptyBatter(openers.nonStriker)],
    bowlers: [emptyBowler(openers.bowler)],
    fallOfWickets: [],
    freeHitActive: false,
  };
}

type Penalties = { wideRuns: 0 | 1 | 2; noBallRuns: 1 | 2 };

const DEFAULT_PENALTIES: Penalties = { wideRuns: 1, noBallRuns: 1 };

function ballToDelta(
  input: BallInput,
  penalties: Penalties = DEFAULT_PENALTIES
): {
  ball: Ball;
  runsDelta: number;
  extrasDelta: number;
  wicketsDelta: number;
  countsAsBall: boolean;
  swapOnRuns: boolean;
  offBatRuns: number;
  bowlerRunsDelta: number;
  batterFacedDelta: number;
} {
  const { runs = 0, extra, wicket, wicketType } = input;

  // Non-delivery wicket events (retired-hurt / retired-out): no stats touched.
  if (wicket && isNonDelivery(wicketType)) {
    const ball: Ball = {
      runs: 0,
      countsAsBall: false,
      wicket: true,
      ...(wicketType ? { wicketType } : {}),
      ...(input.dismissedPlayer ? { dismissedPlayer: input.dismissedPlayer } : {}),
    };
    return {
      ball,
      runsDelta: 0,
      extrasDelta: 0,
      // retired-hurt does NOT add to wicket tally; retired-out does.
      wicketsDelta: wicketType === 'retired-out' ? 1 : 0,
      countsAsBall: false,
      swapOnRuns: false,
      offBatRuns: 0,
      bowlerRunsDelta: 0,
      batterFacedDelta: 0,
    };
  }

  let runsDelta = 0;
  let extrasDelta = 0;
  let countsAsBall = true;
  let offBatRuns = 0;
  let bowlerRunsDelta = 0;
  let batterFacedDelta = 0;
  let swapOnRuns = false;

  if (extra === 'wd') {
    const p = penalties.wideRuns;
    runsDelta = runs + p;
    extrasDelta = runs + p;
    countsAsBall = false;
    bowlerRunsDelta = runs + p;
    batterFacedDelta = 0;
    swapOnRuns = runs % 2 === 1;
  } else if (extra === 'nb') {
    const p = penalties.noBallRuns;
    // batRuns: explicit bat-off runs on a no-ball. If not provided, default to
    // `runs` (backwards-compat: pre-split, `runs` was bat-off runs).
    const batRuns = input.batRuns !== undefined ? input.batRuns : runs;
    // When batRuns is explicit, `runs` is treated as byes/leg-byes on top.
    const byesOnNb = input.batRuns !== undefined ? runs : 0;
    runsDelta = p + batRuns + byesOnNb;
    // The bat-off portion isn't an "extra"; only the penalty + byes are.
    extrasDelta = p + byesOnNb;
    countsAsBall = false;
    bowlerRunsDelta = p + batRuns;
    batterFacedDelta = 1;
    offBatRuns = batRuns;
    swapOnRuns = (batRuns + byesOnNb) % 2 === 1;
  } else if (extra === 'b' || extra === 'lb') {
    runsDelta = runs;
    extrasDelta = runs;
    countsAsBall = true;
    bowlerRunsDelta = 0;
    batterFacedDelta = 1;
    swapOnRuns = runs % 2 === 1;
  } else {
    runsDelta = runs;
    extrasDelta = 0;
    countsAsBall = true;
    offBatRuns = runs;
    bowlerRunsDelta = runs;
    batterFacedDelta = 1;
    swapOnRuns = runs % 2 === 1;
  }

  const ball: Ball = {
    runs,
    countsAsBall,
    ...(extra ? { extra } : {}),
    ...(wicket ? { wicket: true } : {}),
    ...(wicket && wicketType ? { wicketType } : {}),
    ...(input.dismissedPlayer ? { dismissedPlayer: input.dismissedPlayer } : {}),
    ...(input.fielder ? { fielder: input.fielder } : {}),
    ...(input.runOutEnd ? { runOutEnd: input.runOutEnd } : {}),
    ...(input.batRuns !== undefined ? { batRuns: input.batRuns } : {}),
  };

  return {
    ball,
    runsDelta,
    extrasDelta,
    wicketsDelta: wicket ? 1 : 0,
    countsAsBall,
    swapOnRuns,
    offBatRuns,
    bowlerRunsDelta,
    batterFacedDelta,
  };
}

function squadSize(match: Match, side: TeamSide): number {
  return (side === 'A' ? match.playersA : match.playersB).length;
}

function maxWickets(match: Match, side: TeamSide): number {
  // Innings ends one before all are dismissed (last man needs a partner).
  return Math.max(1, squadSize(match, side) - 1);
}

function checkInningsOver(match: Match, inn: Innings): boolean {
  return inn.wickets >= maxWickets(match, inn.battingTeam) || inn.ballsBowled >= match.oversLimit * 6;
}

function teamName(match: Match, side: TeamSide): string {
  return side === 'A' ? match.teamA : match.teamB;
}

function finalizeIfFinished(match: Match): Match {
  if (currentInningsIndex(match) !== 1) return match;
  const inn1 = match.innings[0]!;
  const inn2 = match.innings[1]!;
  const target = inn2.target ?? inn1.runs + 1;

  if (inn2.runs >= target) {
    const winnerSide = inn2.battingTeam;
    const wicketsInHand = maxWickets(match, inn2.battingTeam) - inn2.wickets;
    return {
      ...match,
      status: 'finished',
      result: `${teamName(match, winnerSide)} won by ${wicketsInHand} wicket${wicketsInHand === 1 ? '' : 's'}`,
      updatedAt: Date.now(),
    };
  }

  if (checkInningsOver(match, inn2)) {
    if (inn2.runs === inn1.runs) {
      return { ...match, status: 'finished', result: 'Match tied', updatedAt: Date.now() };
    }
    const winnerSide = inn1.battingTeam;
    const margin = inn1.runs - inn2.runs;
    return {
      ...match,
      status: 'finished',
      result: `${teamName(match, winnerSide)} won by ${margin} run${margin === 1 ? '' : 's'}`,
      updatedAt: Date.now(),
    };
  }
  return match;
}

function updateBatters(
  batters: BatterStat[],
  strikerName: string | undefined,
  delta: ReturnType<typeof ballToDelta>
): BatterStat[] {
  if (!strikerName) return batters;
  const idx = batters.findIndex((b) => b.name === strikerName);
  if (idx < 0) return batters;
  const cur = batters[idx]!;
  const isBoundary4 = delta.offBatRuns === 4 && delta.ball.extra === undefined;
  const isBoundary6 = delta.offBatRuns === 6 && delta.ball.extra === undefined;
  const updated: BatterStat = {
    ...cur,
    runs: cur.runs + delta.offBatRuns,
    ballsFaced: cur.ballsFaced + delta.batterFacedDelta,
    fours: cur.fours + (isBoundary4 ? 1 : 0),
    sixes: cur.sixes + (isBoundary6 ? 1 : 0),
  };
  const next = [...batters];
  next[idx] = updated;
  return next;
}

function applyDismissal(
  batters: BatterStat[],
  dismissedName: string,
  status: BatterStatus,
  howOut: string
): BatterStat[] {
  const outFlag = status === 'out' || status === 'retired-out';
  const idx = batters.findIndex((b) => b.name === dismissedName);
  if (idx < 0)
    return [
      ...batters,
      { ...emptyBatter(dismissedName), out: outFlag, status, howOut },
    ];
  const cur = batters[idx]!;
  const next = [...batters];
  next[idx] = { ...cur, out: outFlag, status, howOut };
  return next;
}

function updateBowlers(
  bowlers: BowlerStat[],
  bowlerName: string | undefined,
  delta: ReturnType<typeof ballToDelta>,
  wicketCreditedToBowler: boolean,
  balls: Ball[],
  penalties: Penalties = DEFAULT_PENALTIES
): BowlerStat[] {
  if (!bowlerName) return bowlers;
  const idx = bowlers.findIndex((b) => b.name === bowlerName);
  if (idx < 0) return bowlers;
  const cur = bowlers[idx]!;
  const newBallsBowled = cur.ballsBowled + (delta.countsAsBall ? 1 : 0);
  let maidens = cur.maidens;
  if (delta.countsAsBall && newBallsBowled > 0 && newBallsBowled % 6 === 0) {
    let legalSeen = 0;
    let conceded = 0;
    for (let i = balls.length - 1; i >= 0 && legalSeen < 6; i--) {
      const b = balls[i]!;
      if (b.countsAsBall) {
        legalSeen++;
        if (b.extra !== 'b' && b.extra !== 'lb') {
          conceded +=
            b.extra === 'wd'
              ? b.runs + penalties.wideRuns
              : b.extra === 'nb'
                ? b.runs + penalties.noBallRuns
                : b.runs;
        }
      } else {
        if (b.extra === 'wd') {
          conceded += b.runs + penalties.wideRuns;
        } else if (b.extra === 'nb') {
          // On nb: bowler is charged penalty + bat-off runs (not byes).
          const batRuns = b.batRuns !== undefined ? b.batRuns : b.runs;
          conceded += batRuns + penalties.noBallRuns;
        }
      }
    }
    if (conceded === 0) maidens = cur.maidens + 1;
  }
  const updated: BowlerStat = {
    ...cur,
    ballsBowled: newBallsBowled,
    runsConceded: cur.runsConceded + delta.bowlerRunsDelta,
    wickets: cur.wickets + (wicketCreditedToBowler ? 1 : 0),
    maidens,
  };
  const next = [...bowlers];
  next[idx] = updated;
  return next;
}

function dismissalPhrase(
  wt: WicketType,
  dismissed: string,
  bowler: string,
  fielder: string | undefined
): string {
  switch (wt) {
    case 'bowled':
      return `${dismissed} b ${bowler}`;
    case 'caught':
      return fielder ? `${dismissed} c ${fielder} b ${bowler}` : `${dismissed} caught b ${bowler}`;
    case 'caught-and-bowled':
      return `${dismissed} c & b ${bowler}`;
    case 'lbw':
      return `${dismissed} lbw b ${bowler}`;
    case 'run-out':
      return fielder ? `${dismissed} run out (${fielder})` : `${dismissed} run out`;
    case 'stumped':
      return fielder ? `${dismissed} st †${fielder} b ${bowler}` : `${dismissed} stumped b ${bowler}`;
    case 'hit-wicket':
      return `${dismissed} hit wicket b ${bowler}`;
    case 'retired-hurt':
      return `${dismissed} retired hurt`;
    case 'retired-out':
      return `${dismissed} retired out`;
    case 'obstructing-field':
      return `${dismissed} obstructing the field`;
    case 'hit-ball-twice':
      return `${dismissed} hit the ball twice`;
  }
}

function buildCommentary(
  ball: Ball,
  ballLabel: string,
  strikerName: string | undefined,
  bowlerName: string | undefined,
  dismissedName: string | undefined,
  endOfOver: boolean
): string {
  const striker = strikerName ?? 'Batter';
  const bowler = bowlerName ?? 'Bowler';
  const runs = ball.runs;
  const extra = ball.extra;

  if (ball.wicket) {
    const wt = ball.wicketType ?? 'bowled';
    const dismissed = dismissedName ?? striker;
    const how = dismissalPhrase(wt, dismissed, bowler, ball.fielder);

    // Compose extras context onto the wicket line.
    let extraSuffix = '';
    if (extra === 'nb') {
      const batRuns = ball.batRuns !== undefined ? ball.batRuns : ball.runs;
      const byesOnNb = ball.batRuns !== undefined ? ball.runs : 0;
      const total = batRuns + byesOnNb;
      extraSuffix = total > 0 ? ` on no-ball + ${total}` : ` on no-ball`;
    } else if (extra === 'wd') {
      extraSuffix = runs > 0 ? ` on wide + ${runs}` : ` on wide`;
    } else if (extra === 'b') {
      extraSuffix = runs > 0 ? ` on bye + ${runs}` : ` on bye`;
    } else if (extra === 'lb') {
      extraSuffix = runs > 0 ? ` on leg-bye + ${runs}` : ` on leg-bye`;
    }
    return `${ballLabel} — WICKET! ${how}${extraSuffix}.`;
  }

  if (extra === 'wd') {
    return runs === 0
      ? `${ballLabel} — Wide. 1 extra.`
      : `${ballLabel} — Wide + ${runs} run${runs === 1 ? '' : 's'}.`;
  }
  if (extra === 'nb') {
    const batRuns = ball.batRuns !== undefined ? ball.batRuns : ball.runs;
    const byesOnNb = ball.batRuns !== undefined ? ball.runs : 0;
    if (batRuns === 0 && byesOnNb === 0) return `${ballLabel} — No ball. 1 extra.`;
    const parts: string[] = [];
    if (batRuns > 0) parts.push(`${batRuns} run${batRuns === 1 ? '' : 's'} off bat`);
    if (byesOnNb > 0) parts.push(`${byesOnNb} bye${byesOnNb === 1 ? '' : 's'}`);
    return `${ballLabel} — No ball + ${parts.join(' + ')}.`;
  }
  if (extra === 'b') {
    return `${ballLabel} — Bye. ${runs} run${runs === 1 ? '' : 's'}.`;
  }
  if (extra === 'lb') {
    return `${ballLabel} — Leg bye. ${runs} run${runs === 1 ? '' : 's'}.`;
  }

  let core: string;
  if (runs === 0) core = `Dot ball.`;
  else if (runs === 4) core = `${striker} hits FOUR.`;
  else if (runs === 6) core = `${striker} hits SIX.`;
  else if (runs === 1) core = `Single.`;
  else if (runs === 2) core = `${striker} takes 2.`;
  else if (runs === 3) core = `${striker} takes 3.`;
  else core = `${runs} runs.`;

  if (endOfOver) return `${ballLabel} — ${core} End of over.`;
  return `${ballLabel} — ${core}`;
}

export function applyBall(match: Match, input: BallInput): Match {
  if (match.status === 'finished') throw new Error('Match is finished');
  if (match.status === 'innings-break') throw new Error('Innings break — start innings 2 first');

  const idx = currentInningsIndex(match);
  const current = getCurrent(match);
  if (current.awaitingNewBatterFor) throw new Error('Awaiting new batter');
  if (current.awaitingNewBowler) throw new Error('Awaiting new bowler');

  // Normalize wicket inputs.
  let wicketType: WicketType | undefined;
  if (input.wicket) {
    wicketType = input.wicketType ?? 'bowled';
    if (!WICKET_TYPES.includes(wicketType)) {
      throw new Error(`Invalid wicketType: ${wicketType}`);
    }
    const validation = validateWicketForDelivery(
      input.extra,
      wicketType,
      !!current.freeHitActive
    );
    if (!validation.valid) {
      throw new Error(validation.reason ?? 'Invalid dismissal for this delivery');
    }
  }

  // Determine the dismissed player.
  let dismissedName: string | undefined;
  let dismissedSlot: 'striker' | 'non-striker' | undefined;
  if (input.wicket) {
    if (input.dismissedPlayer) {
      dismissedName = input.dismissedPlayer;
      if (dismissedName === current.striker) dismissedSlot = 'striker';
      else if (dismissedName === current.nonStriker) dismissedSlot = 'non-striker';
    } else if (wicketType === 'run-out' && input.runOutEnd === 'non-striker') {
      dismissedName = current.nonStriker;
      dismissedSlot = 'non-striker';
    } else {
      dismissedName = current.striker;
      dismissedSlot = 'striker';
    }
  }

  const normalizedInput: BallInput = {
    ...input,
    ...(wicketType ? { wicketType } : {}),
    ...(dismissedName ? { dismissedPlayer: dismissedName } : {}),
  };
  const penalties: Penalties = {
    wideRuns: match.rules.wideRuns,
    noBallRuns: match.rules.noBallRuns,
  };
  const delta = ballToDelta(normalizedInput, penalties);
  const wicket = !!input.wicket;
  const wicketCountsTowardTally = delta.wicketsDelta > 0;
  const bowlerCredited = wicket && bowlerCreditedFor(wicketType);

  const legalBallsBefore = current.ballsBowled;
  const ballLabel = formatBallLabel(legalBallsBefore);

  const willBeEndOfOver =
    delta.countsAsBall && (legalBallsBefore + 1) % 6 === 0 && legalBallsBefore + 1 > 0;

  const commentary = buildCommentary(
    delta.ball,
    ballLabel,
    current.striker,
    current.bowler,
    dismissedName,
    !wicket && willBeEndOfOver
  );
  const ballWithCommentary: Ball = { ...delta.ball, commentary };

  const nextBalls = [...current.balls, ballWithCommentary];

  // Batter stat bump: only credit the on-strike batter for genuine deliveries.
  // For non-delivery wickets (retired-hurt / retired-out) skip the stat update.
  let nextBatters = current.batters;
  if (!(wicket && isNonDelivery(wicketType))) {
    // For run-out of non-striker, the striker still faced the legal ball — keep
    // the standard updateBatters on the striker.
    nextBatters = updateBatters(current.batters, current.striker, delta);
  }

  // Apply dismissal marking.
  if (wicket && dismissedName && wicketType) {
    const how = howOutString(wicketType, current.bowler, input.fielder);
    nextBatters = applyDismissal(nextBatters, dismissedName, statusFromWicket(wicketType), how);
  }

  const nextBowlers = updateBowlers(
    current.bowlers,
    current.bowler,
    delta,
    bowlerCredited,
    nextBalls,
    penalties
  );

  let nextInn: Innings = {
    ...current,
    runs: current.runs + delta.runsDelta,
    wickets: current.wickets + delta.wicketsDelta,
    extras: current.extras + delta.extrasDelta,
    ballsBowled: current.ballsBowled + (delta.countsAsBall ? 1 : 0),
    balls: nextBalls,
    batters: nextBatters,
    bowlers: nextBowlers,
  };

  // Fall of wicket — only for wickets that count toward the tally.
  if (wicket && wicketCountsTowardTally && dismissedName) {
    const fow: FallOfWicket = {
      wicketNumber: nextInn.wickets,
      runs: nextInn.runs,
      oversBalls: nextInn.ballsBowled,
      batter: dismissedName,
      over: formatOvers(nextInn.ballsBowled),
    };
    nextInn = { ...nextInn, fallOfWickets: [...nextInn.fallOfWickets, fow] };
  }

  // Strike rotation / awaitingNewBatterFor assignment.
  if (wicket) {
    if (dismissedSlot) {
      nextInn = { ...nextInn, awaitingNewBatterFor: dismissedSlot };
    } else {
      nextInn = { ...nextInn, awaitingNewBatterFor: 'striker' };
    }
    // Even on a wicket, if runs were taken (run-out scenarios), apply the swap.
    if (delta.swapOnRuns) {
      // Swap the surviving batter to the OTHER end (the dismissed slot stays
      // empty, awaiting replacement).
      nextInn = swapBatters(nextInn);
      // The vacant slot moved with the swap — recompute which slot is awaiting.
      const after = nextInn;
      if (after.striker === dismissedName) {
        nextInn = { ...nextInn, awaitingNewBatterFor: 'striker' };
      } else if (after.nonStriker === dismissedName) {
        nextInn = { ...nextInn, awaitingNewBatterFor: 'non-striker' };
      }
    }
  } else if (delta.swapOnRuns) {
    nextInn = swapBatters(nextInn);
  }

  // Free-hit state machine.
  // - nb: arm free hit for the next ball.
  // - legal ball that isn't a no-ball: consume.
  // - wd / non-counting events: preserve current state.
  if (input.extra === 'nb') {
    nextInn = { ...nextInn, freeHitActive: true };
  } else if (delta.countsAsBall) {
    nextInn = { ...nextInn, freeHitActive: false };
  }

  const inningsDone = checkInningsOver(match, nextInn);

  // End-of-over swap — always, regardless of wicket on the last ball.
  if (delta.countsAsBall && nextInn.ballsBowled % 6 === 0 && nextInn.ballsBowled > 0) {
    // If the over ended on a wicket: swap so the surviving batter moves to
    // strike, leaving the vacant slot at non-striker (or whichever side the
    // dismissed player was on after the swap).
    nextInn = swapBatters(nextInn);
    if (wicket && dismissedName) {
      if (nextInn.striker === dismissedName) {
        nextInn = { ...nextInn, awaitingNewBatterFor: 'striker' };
      } else if (nextInn.nonStriker === dismissedName) {
        nextInn = { ...nextInn, awaitingNewBatterFor: 'non-striker' };
      }
    }
    if (!inningsDone) nextInn = { ...nextInn, awaitingNewBowler: true };
  }

  if (inningsDone) {
    nextInn = {
      ...nextInn,
      awaitingNewBatterFor: undefined,
      awaitingNewBowler: false,
    };
  }

  nextInn = syncAwaitingFlag(nextInn);

  let nextMatch = replaceInnings(match, idx, nextInn);

  if (idx === 0) {
    if (inningsDone) {
      nextMatch = { ...nextMatch, status: 'innings-break', updatedAt: Date.now() };
    }
  } else {
    nextMatch = finalizeIfFinished(nextMatch);
  }

  return nextMatch;
}

function rebuildStats(
  base: Innings,
  balls: Ball[],
  penalties: Penalties = DEFAULT_PENALTIES
): {
  runs: number;
  wickets: number;
  extras: number;
  ballsBowled: number;
  batters: BatterStat[];
  bowlers: BowlerStat[];
  striker?: string;
  nonStriker?: string;
  bowler?: string;
  awaitingNewBatterFor?: 'striker' | 'non-striker';
  awaitingNewBowler?: boolean;
  fallOfWickets: FallOfWicket[];
  freeHitActive: boolean;
} {
  const batters: BatterStat[] = base.batters.map((b) => ({ ...emptyBatter(b.name) }));
  const bowlers: BowlerStat[] = base.bowlers.map((b) => ({ ...emptyBowler(b.name) }));

  let striker: string | undefined = batters[0]?.name;
  let nonStriker: string | undefined = batters[1]?.name;
  const bowlerName: string | undefined = bowlers[0]?.name;

  let runs = 0;
  let wickets = 0;
  let extras = 0;
  let ballsBowled = 0;
  let freeHitActive = false;
  const seenBalls: Ball[] = [];
  const fallOfWickets: FallOfWicket[] = [];

  for (const b of balls) {
    const delta = ballToDelta(
      {
        runs: b.runs,
        extra: b.extra,
        wicket: b.wicket,
        wicketType: b.wicketType,
        dismissedPlayer: b.dismissedPlayer,
        fielder: b.fielder,
        runOutEnd: b.runOutEnd,
        batRuns: b.batRuns,
      },
      penalties
    );
    const wicket = !!b.wicket;
    const wt: WicketType | undefined = b.wicketType;
    const nonDelivery = wicket && isNonDelivery(wt);
    const bowlerCredited = wicket && bowlerCreditedFor(wt);
    seenBalls.push(b);

    if (!nonDelivery) {
      const sIdx = striker ? batters.findIndex((x) => x.name === striker) : -1;
      if (sIdx >= 0) {
        const cur = batters[sIdx]!;
        const isBoundary4 = delta.offBatRuns === 4 && b.extra === undefined;
        const isBoundary6 = delta.offBatRuns === 6 && b.extra === undefined;
        batters[sIdx] = {
          ...cur,
          runs: cur.runs + delta.offBatRuns,
          ballsFaced: cur.ballsFaced + delta.batterFacedDelta,
          fours: cur.fours + (isBoundary4 ? 1 : 0),
          sixes: cur.sixes + (isBoundary6 ? 1 : 0),
        };
      }

      const bIdx = bowlerName ? bowlers.findIndex((x) => x.name === bowlerName) : -1;
      if (bIdx >= 0) {
        const cur = bowlers[bIdx]!;
        const newBallsBowled = cur.ballsBowled + (delta.countsAsBall ? 1 : 0);
        let maidens = cur.maidens;
        if (delta.countsAsBall && newBallsBowled > 0 && newBallsBowled % 6 === 0) {
          let legalSeen = 0;
          let conceded = 0;
          for (let i = seenBalls.length - 1; i >= 0 && legalSeen < 6; i--) {
            const bb = seenBalls[i]!;
            if (bb.countsAsBall) {
              legalSeen++;
              if (bb.extra !== 'b' && bb.extra !== 'lb') {
                conceded +=
                  bb.extra === 'wd'
                    ? bb.runs + penalties.wideRuns
                    : bb.extra === 'nb'
                      ? bb.runs + penalties.noBallRuns
                      : bb.runs;
              }
            } else if (bb.extra === 'wd') {
              conceded += bb.runs + penalties.wideRuns;
            } else if (bb.extra === 'nb') {
              const batRuns = bb.batRuns !== undefined ? bb.batRuns : bb.runs;
              conceded += batRuns + penalties.noBallRuns;
            }
          }
          if (conceded === 0) maidens = cur.maidens + 1;
        }
        bowlers[bIdx] = {
          ...cur,
          ballsBowled: newBallsBowled,
          runsConceded: cur.runsConceded + delta.bowlerRunsDelta,
          wickets: cur.wickets + (bowlerCredited ? 1 : 0),
          maidens,
        };
      }
    }

    runs += delta.runsDelta;
    wickets += delta.wicketsDelta;
    extras += delta.extrasDelta;
    if (delta.countsAsBall) ballsBowled += 1;

    if (wicket) {
      let dismissed = b.dismissedPlayer;
      if (!dismissed) {
        dismissed = wt === 'run-out' && b.runOutEnd === 'non-striker' ? nonStriker : striker;
      }
      if (dismissed && wt) {
        const how = howOutString(wt, bowlerName, b.fielder);
        const status = statusFromWicket(wt);
        const outFlag = status === 'out' || status === 'retired-out';
        const dIdx = batters.findIndex((x) => x.name === dismissed);
        if (dIdx >= 0) {
          batters[dIdx] = { ...batters[dIdx]!, out: outFlag, status, howOut: how };
        } else {
          batters.push({ ...emptyBatter(dismissed), out: outFlag, status, howOut: how });
        }
        if (delta.wicketsDelta > 0) {
          fallOfWickets.push({
            wicketNumber: wickets,
            runs,
            oversBalls: ballsBowled,
            batter: dismissed,
            over: formatOvers(ballsBowled),
          });
        }
      }
      if (delta.swapOnRuns) {
        [striker, nonStriker] = [nonStriker, striker];
      }
    } else if (delta.swapOnRuns) {
      [striker, nonStriker] = [nonStriker, striker];
    }

    // Update freeHitActive per-ball (same state machine as applyBall).
    if (b.extra === 'nb') {
      freeHitActive = true;
    } else if (delta.countsAsBall) {
      freeHitActive = false;
    }

    if (delta.countsAsBall && ballsBowled % 6 === 0 && ballsBowled > 0) {
      [striker, nonStriker] = [nonStriker, striker];
    }
  }

  return {
    runs,
    wickets,
    extras,
    ballsBowled,
    batters,
    bowlers,
    striker,
    nonStriker,
    bowler: bowlerName,
    fallOfWickets,
    freeHitActive,
  };
}

export function undoLastBall(match: Match): Match {
  const idx = currentInningsIndex(match);
  const current = getCurrent(match);
  if (current.balls.length === 0) return match;

  const newBalls = current.balls.slice(0, -1);
  const penalties: Penalties = {
    wideRuns: match.rules.wideRuns,
    noBallRuns: match.rules.noBallRuns,
  };
  const rebuilt = rebuildStats(current, newBalls, penalties);

  let nextInn: Innings = {
    ...current,
    runs: rebuilt.runs,
    wickets: rebuilt.wickets,
    extras: rebuilt.extras,
    ballsBowled: rebuilt.ballsBowled,
    balls: newBalls,
    batters: rebuilt.batters,
    bowlers: rebuilt.bowlers,
    striker: rebuilt.striker ?? current.striker,
    nonStriker: rebuilt.nonStriker ?? current.nonStriker,
    bowler: rebuilt.bowler ?? current.bowler,
    awaitingNewBatterFor: undefined,
    awaitingNewBowler: false,
    fallOfWickets: rebuilt.fallOfWickets,
    freeHitActive: rebuilt.freeHitActive,
  };
  nextInn = syncAwaitingFlag(nextInn);

  let nextMatch = replaceInnings(match, idx, nextInn);
  if (nextMatch.status !== 'live') {
    nextMatch = { ...nextMatch, status: 'live', result: undefined, updatedAt: Date.now() };
  }
  return nextMatch;
}

function rosterFor(match: Match, side: TeamSide): string[] {
  return side === 'A' ? match.playersA : match.playersB;
}

export function closeInnings(
  match: Match,
  openers: { striker: string; nonStriker: string; bowler: string }
): Match {
  if (match.innings.length === 2) throw new Error('Innings 2 already started');
  const inn1 = match.innings[0];
  const battingTeam: TeamSide = inn1.battingTeam === 'A' ? 'B' : 'A';
  const bowlingTeam: TeamSide = battingTeam === 'A' ? 'B' : 'A';
  const batRoster = rosterFor(match, battingTeam);
  const bowlRoster = rosterFor(match, bowlingTeam);
  if (!batRoster.includes(openers.striker)) throw new Error('striker not in batting roster');
  if (!batRoster.includes(openers.nonStriker)) throw new Error('nonStriker not in batting roster');
  if (!bowlRoster.includes(openers.bowler)) throw new Error('bowler not in bowling roster');
  const inn2 = initInnings(battingTeam, openers);
  inn2.target = inn1.runs + 1;
  return {
    ...match,
    innings: [inn1, inn2],
    status: 'live',
    updatedAt: Date.now(),
  };
}

export function setPlayers(
  match: Match,
  players: { striker?: string; nonStriker?: string; bowler?: string }
): Match {
  const idx = currentInningsIndex(match);
  const current = getCurrent(match);
  const battingTeam = current.battingTeam;
  const bowlingTeam: TeamSide = battingTeam === 'A' ? 'B' : 'A';
  const batRoster = rosterFor(match, battingTeam);
  const bowlRoster = rosterFor(match, bowlingTeam);
  if (players.striker !== undefined && !batRoster.includes(players.striker))
    throw new Error('striker not in batting roster');
  if (players.nonStriker !== undefined && !batRoster.includes(players.nonStriker))
    throw new Error('nonStriker not in batting roster');
  if (players.bowler !== undefined && !bowlRoster.includes(players.bowler))
    throw new Error('bowler not in bowling roster');
  let batters = current.batters;
  let bowlers = current.bowlers;
  let striker = current.striker;
  let nonStriker = current.nonStriker;
  let bowler = current.bowler;
  let awaitingNewBatterFor = current.awaitingNewBatterFor;
  let awaitingNewBowler = current.awaitingNewBowler;

  if (players.striker !== undefined) {
    striker = players.striker;
    if (!batters.find((b) => b.name === players.striker)) {
      batters = [...batters, emptyBatter(players.striker)];
    }
    if (awaitingNewBatterFor === 'striker') awaitingNewBatterFor = undefined;
  }
  if (players.nonStriker !== undefined) {
    nonStriker = players.nonStriker;
    if (!batters.find((b) => b.name === players.nonStriker)) {
      batters = [...batters, emptyBatter(players.nonStriker!)];
    }
    if (awaitingNewBatterFor === 'non-striker') awaitingNewBatterFor = undefined;
  }
  if (players.bowler !== undefined) {
    bowler = players.bowler;
    if (!bowlers.find((b) => b.name === players.bowler)) {
      bowlers = [...bowlers, emptyBowler(players.bowler)];
    }
    awaitingNewBowler = false;
  }

  let nextInn: Innings = {
    ...current,
    striker,
    nonStriker,
    bowler,
    batters,
    bowlers,
    awaitingNewBatterFor,
    awaitingNewBowler,
  };
  nextInn = syncAwaitingFlag(nextInn);
  return replaceInnings(match, idx, nextInn);
}
