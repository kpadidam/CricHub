export type Extra = 'wd' | 'nb' | 'b' | 'lb';

export type WicketType =
  | 'bowled'
  | 'caught'
  | 'caught-and-bowled'
  | 'lbw'
  | 'run-out'
  | 'stumped'
  | 'hit-wicket'
  | 'obstructing-field'
  | 'hit-ball-twice'
  | 'retired-hurt'
  | 'retired-out';

export type Ball = {
  runs: number;
  extra?: Extra;
  batRuns?: number;
  extraRuns?: number;
  wicket?: boolean;
  wicketType?: WicketType;
  dismissedPlayer?: string;
  fielder?: string;
  runOutEnd?: 'striker' | 'non-striker';
  countsAsBall: boolean;
};

export type BallInput = {
  runs?: number;
  extra?: Extra;
  batRuns?: number;
  extraRuns?: number;
  wicket?: boolean;
  wicketType?: WicketType;
  dismissedPlayer?: string;
  fielder?: string;
  runOutEnd?: 'striker' | 'non-striker';
};

export type Penalties = { wideRuns: 1 | 2; noBallRuns: 1 | 2 };

export type BallDelta = {
  ball: Ball;
  runsDelta: number;
  extrasDelta: number;
  wicketsDelta: number;
  countsAsBall: boolean;
  swapOnRuns: boolean;
  offBatRuns: number;
  bowlerRunsDelta: number;
  batterRunsDelta: number;
  batterFacedDelta: number;
  foursDelta: number;
  sixesDelta: number;
};

const DEFAULT_PENALTIES: Penalties = { wideRuns: 1, noBallRuns: 1 };

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

export function ballToDelta(
  input: BallInput,
  penalties: Penalties = DEFAULT_PENALTIES
): BallDelta {
  const { extra, wicket } = input;
  const legacyRuns = input.runs ?? 0;
  const batRuns = input.batRuns ?? (extra === 'nb' ? legacyRuns : 0);
  const extraRuns = input.extraRuns ?? (extra === 'nb' ? 0 : legacyRuns);

  assertNonNegativeInteger('runs', legacyRuns);
  assertNonNegativeInteger('batRuns', batRuns);
  assertNonNegativeInteger('extraRuns', extraRuns);

  let runsDelta = 0;
  let extrasDelta = 0;
  let countsAsBall = true;
  let offBatRuns = 0;
  let bowlerRunsDelta = 0;
  let batterRunsDelta = 0;
  let batterFacedDelta = 0;

  if (extra === 'wd') {
    const p = penalties.wideRuns;
    runsDelta = extraRuns + p;
    extrasDelta = extraRuns + p;
    countsAsBall = false;
    bowlerRunsDelta = extraRuns + p;
  } else if (extra === 'nb') {
    const p = penalties.noBallRuns;
    runsDelta = p + batRuns + extraRuns;
    extrasDelta = p + extraRuns;
    countsAsBall = false;
    offBatRuns = batRuns;
    bowlerRunsDelta = p + batRuns + extraRuns;
    batterRunsDelta = batRuns;
    batterFacedDelta = batRuns > 0 ? 1 : 0;
  } else if (extra === 'b' || extra === 'lb') {
    runsDelta = extraRuns;
    extrasDelta = extraRuns;
    bowlerRunsDelta = 0;
    batterFacedDelta = 1;
  } else {
    runsDelta = legacyRuns;
    offBatRuns = legacyRuns;
    bowlerRunsDelta = legacyRuns;
    batterRunsDelta = legacyRuns;
    batterFacedDelta = 1;
  }

  const ballRuns =
    extra === 'nb'
      ? batRuns + extraRuns
      : extra === 'wd' || extra === 'b' || extra === 'lb'
        ? extraRuns
        : legacyRuns;

  const ball: Ball = {
    runs: ballRuns,
    countsAsBall,
    ...(extra ? { extra } : {}),
    ...(extra === 'nb' ? { batRuns, extraRuns } : {}),
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
    swapOnRuns: ballRuns % 2 === 1,
    offBatRuns,
    bowlerRunsDelta,
    batterRunsDelta,
    batterFacedDelta,
    foursDelta: offBatRuns === 4 ? 1 : 0,
    sixesDelta: offBatRuns === 6 ? 1 : 0,
  };
}
