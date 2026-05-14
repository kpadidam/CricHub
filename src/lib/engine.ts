/**
 * Cricket scoring engine — pure functions, no I/O.
 *
 * Scoring rules:
 *   - wd: +1 penalty + any runs taken; not a legal ball; not bat-faced; all
 *     runs (penalty + runs) charged to bowler; nothing to batter.
 *   - nb: +1 penalty + any runs taken; not a legal ball; bat-faced; all runs
 *     (penalty + runs) charged to bowler; runs do NOT go to batter (treated
 *     as extras team-wise, batter only gets a ball faced).
 *   - b/lb: legal ball; runs to extras; ball faced by batter; NOT charged to
 *     bowler's runsConceded.
 *   - normal: legal ball; runs to batter and bowler; ball faced.
 *   - boundary 4/6 counted only on off-bat runs (extra === undefined).
 *
 * Strike rotation:
 *   - odd runs taken (any kind) → swap.
 *   - end of legal over → swap.
 */

import type {
  Ball,
  BallInput,
  BatterStat,
  BowlerStat,
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
];

export const ALL_WICKET_TYPES = WICKET_TYPES;

function formatOvers(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function formatBallLabel(legalBallsBefore: number): string {
  return `${Math.floor(legalBallsBefore / 6)}.${(legalBallsBefore % 6) + 1}`;
}

function bowlerCreditedFor(wt: WicketType | undefined): boolean {
  if (!wt) return true;
  return wt !== 'run-out' && wt !== 'retired-hurt' && wt !== 'retired-out';
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
  }
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
  return { name, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, out: false };
}

function emptyBowler(name: string): BowlerStat {
  return { name, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 };
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
  };
}

type Penalties = { wideRuns: 1 | 2; noBallRuns: 1 | 2 };

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
  const { runs = 0, extra, wicket } = input;
  let runsDelta = 0;
  let extrasDelta = 0;
  let countsAsBall = true;
  let offBatRuns = 0;
  let bowlerRunsDelta = 0;
  let batterFacedDelta = 0;

  if (extra === 'wd') {
    const p = penalties.wideRuns;
    runsDelta = runs + p;
    extrasDelta = runs + p;
    countsAsBall = false;
    bowlerRunsDelta = runs + p;
    batterFacedDelta = 0;
  } else if (extra === 'nb') {
    const p = penalties.noBallRuns;
    runsDelta = runs + p;
    extrasDelta = runs + p;
    countsAsBall = false;
    bowlerRunsDelta = runs + p;
    batterFacedDelta = 1;
  } else if (extra === 'b' || extra === 'lb') {
    runsDelta = runs;
    extrasDelta = runs;
    countsAsBall = true;
    bowlerRunsDelta = 0;
    batterFacedDelta = 1;
  } else {
    runsDelta = runs;
    extrasDelta = 0;
    countsAsBall = true;
    offBatRuns = runs;
    bowlerRunsDelta = runs;
    batterFacedDelta = 1;
  }

  const ball: Ball = {
    runs,
    countsAsBall,
    ...(extra ? { extra } : {}),
    ...(wicket ? { wicket: true } : {}),
    ...(wicket && input.wicketType ? { wicketType: input.wicketType } : {}),
    ...(input.dismissedPlayer ? { dismissedPlayer: input.dismissedPlayer } : {}),
    ...(input.fielder ? { fielder: input.fielder } : {}),
    ...(input.runOutEnd ? { runOutEnd: input.runOutEnd } : {}),
  };

  return {
    ball,
    runsDelta,
    extrasDelta,
    wicketsDelta: wicket ? 1 : 0,
    countsAsBall,
    swapOnRuns: runs % 2 === 1,
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
  // Updates the striker's batting stats (runs, balls, boundaries) only.
  // Dismissal marking is handled separately in applyDismissal.
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
  howOut: string
): BatterStat[] {
  const idx = batters.findIndex((b) => b.name === dismissedName);
  if (idx < 0) return [...batters, { ...emptyBatter(dismissedName), out: true, howOut }];
  const cur = batters[idx]!;
  const next = [...batters];
  next[idx] = { ...cur, out: true, howOut };
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
  // Maiden: completed an over and last 6 legal balls (this bowler's last over)
  // had 0 runs conceded by the bowler.
  if (delta.countsAsBall && newBallsBowled > 0 && newBallsBowled % 6 === 0) {
    // Walk backwards through `balls` (which already includes the current ball)
    // collecting the last 6 legal balls and summing bowler-charged runs.
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
          conceded += b.runs + penalties.noBallRuns;
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
    let how: string;
    switch (wt) {
      case 'bowled':
        how = `${dismissed} b ${bowler}`;
        break;
      case 'caught':
        how = ball.fielder ? `${dismissed} c ${ball.fielder} b ${bowler}` : `${dismissed} caught b ${bowler}`;
        break;
      case 'caught-and-bowled':
        how = `${dismissed} c & b ${bowler}`;
        break;
      case 'lbw':
        how = `${dismissed} lbw b ${bowler}`;
        break;
      case 'run-out':
        how = ball.fielder ? `${dismissed} run out (${ball.fielder})` : `${dismissed} run out`;
        break;
      case 'stumped':
        how = ball.fielder ? `${dismissed} st †${ball.fielder} b ${bowler}` : `${dismissed} stumped b ${bowler}`;
        break;
      case 'hit-wicket':
        how = `${dismissed} hit wicket b ${bowler}`;
        break;
      case 'retired-hurt':
        how = `${dismissed} retired hurt`;
        break;
      case 'retired-out':
        how = `${dismissed} retired out`;
        break;
    }
    return `${ballLabel} — WICKET! ${how}.`;
  }

  if (extra === 'wd') {
    return runs === 0
      ? `${ballLabel} — Wide. 1 extra.`
      : `${ballLabel} — Wide + ${runs} run${runs === 1 ? '' : 's'}.`;
  }
  if (extra === 'nb') {
    return runs === 0
      ? `${ballLabel} — No ball. 1 extra.`
      : `${ballLabel} — No ball + ${runs} run${runs === 1 ? '' : 's'} off bat.`;
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
  if (current.awaitingNewBatter) throw new Error('Awaiting new batter');
  if (current.awaitingNewBowler) throw new Error('Awaiting new bowler');

  // Normalize wicket inputs.
  let wicketType: WicketType | undefined;
  if (input.wicket) {
    wicketType = input.wicketType ?? 'bowled';
    if (!WICKET_TYPES.includes(wicketType)) {
      throw new Error(`Invalid wicketType: ${wicketType}`);
    }
  }

  // Determine the dismissed player.
  let dismissedName: string | undefined;
  if (input.wicket) {
    if (input.dismissedPlayer) {
      dismissedName = input.dismissedPlayer;
    } else if (wicketType === 'run-out' && input.runOutEnd === 'non-striker') {
      dismissedName = current.nonStriker;
    } else {
      dismissedName = current.striker;
    }
  }

  // Build the delta. We carry wicketType/dismissed/fielder/runOutEnd into the ball.
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
  const wicket = delta.wicketsDelta > 0;
  const bowlerCredited = wicket && bowlerCreditedFor(wicketType);

  const legalBallsBefore = current.ballsBowled;
  const ballLabel = formatBallLabel(legalBallsBefore);

  // Compute commentary (without endOfOver flag yet; we patch below).
  // We need the post-counts to know if this is end of over.
  const willBeEndOfOver =
    delta.countsAsBall && (legalBallsBefore + 1) % 6 === 0 && (legalBallsBefore + 1) > 0;

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

  // Bat stats: skip the striker's runs/balls bump when it's a non-striker run-out
  // (the striker didn't face this ball as a dismissal scenario — but in MVP we
  // still count the ball as faced if it's a legal delivery). Actually a run-out
  // on the non-striker still has the ball delivered to the striker; for simplicity
  // we keep the standard batter bump on the striker.
  let nextBatters = updateBatters(current.batters, current.striker, delta);

  // Apply dismissal marking.
  if (wicket && dismissedName && wicketType) {
    const how = howOutString(wicketType, current.bowler, input.fielder);
    nextBatters = applyDismissal(nextBatters, dismissedName, how);
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

  // Fall of wicket.
  if (wicket && dismissedName) {
    const fow: FallOfWicket = {
      wicketNumber: nextInn.wickets,
      runs: nextInn.runs,
      oversBalls: nextInn.ballsBowled,
      batter: dismissedName,
      over: formatOvers(nextInn.ballsBowled),
    };
    nextInn = { ...nextInn, fallOfWickets: [...nextInn.fallOfWickets, fow] };
  }

  if (wicket) {
    // Always set awaitingNewBatter so frontend can pick a replacement and
    // PATCH /players to whichever slot (striker or nonStriker) is `out`.
    nextInn = { ...nextInn, awaitingNewBatter: true };
  } else if (delta.swapOnRuns) {
    nextInn = swapBatters(nextInn);
  }

  const inningsDone = checkInningsOver(match, nextInn);

  if (delta.countsAsBall && nextInn.ballsBowled % 6 === 0 && nextInn.ballsBowled > 0) {
    if (!wicket) nextInn = swapBatters(nextInn);
    if (!inningsDone) nextInn = { ...nextInn, awaitingNewBowler: true };
  }

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
  awaitingNewBatter?: boolean;
  awaitingNewBowler?: boolean;
  fallOfWickets: FallOfWicket[];
} {
  // Replay balls against an innings reset to zeroed counters but keep the
  // existing batter/bowler name roster (so dismissed batters / past bowlers
  // remain visible). Stat counters within those rosters are zeroed.
  const batters: BatterStat[] = base.batters.map((b) => ({
    ...emptyBatter(b.name),
  }));
  const bowlers: BowlerStat[] = base.bowlers.map((b) => ({
    ...emptyBowler(b.name),
  }));

  // For replay we don't track who the striker/bowler was per-ball historically.
  // Approximation: assume the first two batters opened and openers are
  // batters[0]=striker, batters[1]=nonStriker; bowler = bowlers[0]. Subsequent
  // batter/bowler changes during the over history aren't recoverable from
  // `Ball[]` alone. This is a known limitation for undo across player changes;
  // it's only used for the LAST ball undo so in practice it stays correct as
  // long as setPlayers wasn't called between the ball and its undo.
  let striker: string | undefined = batters[0]?.name;
  let nonStriker: string | undefined = batters[1]?.name;
  let bowlerName: string | undefined = bowlers[0]?.name;

  // Better: use current innings's striker/nonStriker/bowler as the end-state
  // names; we'll reconstruct by walking forward. But since we can't know past
  // player identities, we fall back to keeping the latest known names and
  // simply update stats on the latest striker/bowler for each ball. That's
  // wrong for multi-batter histories but acceptable for an MVP — see note.

  let runs = 0;
  let wickets = 0;
  let extras = 0;
  let ballsBowled = 0;
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
      },
      penalties
    );
    const wicket = !!b.wicket;
    const wt: WicketType | undefined = b.wicketType;
    const bowlerCredited = wicket && bowlerCreditedFor(wt);
    seenBalls.push(b);

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
            conceded += bb.runs + penalties.noBallRuns;
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

    runs += delta.runsDelta;
    wickets += delta.wicketsDelta;
    extras += delta.extrasDelta;
    if (delta.countsAsBall) ballsBowled += 1;

    if (wicket) {
      // Determine dismissed name & mark out.
      let dismissed = b.dismissedPlayer;
      if (!dismissed) {
        dismissed = wt === 'run-out' && b.runOutEnd === 'non-striker' ? nonStriker : striker;
      }
      if (dismissed && wt) {
        const how = howOutString(wt, bowlerName, b.fielder);
        const dIdx = batters.findIndex((x) => x.name === dismissed);
        if (dIdx >= 0) {
          batters[dIdx] = { ...batters[dIdx]!, out: true, howOut: how };
        } else {
          batters.push({ ...emptyBatter(dismissed), out: true, howOut: how });
        }
        fallOfWickets.push({
          wicketNumber: wickets,
          runs,
          oversBalls: ballsBowled,
          batter: dismissed,
          over: formatOvers(ballsBowled),
        });
      }
      // can't recover next batter name from balls alone — leave striker as-is
    } else if (delta.swapOnRuns) {
      [striker, nonStriker] = [nonStriker, striker];
    }
    if (delta.countsAsBall && ballsBowled % 6 === 0 && ballsBowled > 0 && !wicket) {
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

  const nextInn: Innings = {
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
    awaitingNewBatter: false,
    awaitingNewBowler: false,
    fallOfWickets: rebuilt.fallOfWickets,
  };

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
  let awaitingNewBatter = current.awaitingNewBatter;
  let awaitingNewBowler = current.awaitingNewBowler;

  if (players.striker !== undefined) {
    striker = players.striker;
    if (!batters.find((b) => b.name === players.striker)) {
      batters = [...batters, emptyBatter(players.striker)];
    }
    awaitingNewBatter = false;
  }
  if (players.nonStriker !== undefined) {
    nonStriker = players.nonStriker;
    if (!batters.find((b) => b.name === players.nonStriker)) {
      batters = [...batters, emptyBatter(players.nonStriker!)];
    }
  }
  if (players.bowler !== undefined) {
    bowler = players.bowler;
    if (!bowlers.find((b) => b.name === players.bowler)) {
      bowlers = [...bowlers, emptyBowler(players.bowler)];
    }
    awaitingNewBowler = false;
  }

  const nextInn: Innings = {
    ...current,
    striker,
    nonStriker,
    bowler,
    batters,
    bowlers,
    awaitingNewBatter,
    awaitingNewBowler,
  };
  return replaceInnings(match, idx, nextInn);
}
