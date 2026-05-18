// Data model per PRD section 5.

export type Extra = 'wd' | 'nb' | 'b' | 'lb';

export type WicketType =
  | 'bowled'
  | 'caught'
  | 'caught-and-bowled'
  | 'lbw'
  | 'run-out'
  | 'stumped'
  | 'hit-wicket'
  | 'retired-hurt'
  | 'retired-out'
  | 'obstructing-field'
  | 'hit-ball-twice';

export type BatterStatus = 'active' | 'out' | 'retired-hurt' | 'retired-out';

export type Ball = {
  runs: number;
  extra?: Extra;
  wicket?: boolean;
  wicketType?: WicketType;
  dismissedPlayer?: string;
  fielder?: string;
  runOutEnd?: 'striker' | 'non-striker';
  commentary?: string;
  countsAsBall: boolean;
  batRuns?: number;
};

export type FallOfWicket = {
  wicketNumber: number;
  runs: number;
  oversBalls: number;
  batter: string;
  over: string; // e.g. "4.2"
};

export type TeamSide = 'A' | 'B';

export type BatterStat = {
  name: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  // `out` is kept for backwards-compat with existing UI reads. It is set to
  // true whenever `status` is `'out'` or `'retired-out'`.
  out: boolean;
  status: BatterStatus;
  howOut?: string;
};

export type BowlerStat = {
  name: string;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
};

export type Innings = {
  battingTeam: TeamSide;
  runs: number;
  wickets: number;
  ballsBowled: number;
  extras: number;
  balls: Ball[];
  striker?: string;
  nonStriker?: string;
  bowler?: string;
  target?: number;
  batters: BatterStat[];
  bowlers: BowlerStat[];
  // Authoritative replacement for the old boolean `awaitingNewBatter`.
  // Set to whichever slot is empty after a wicket / retirement; cleared
  // when that slot is filled. Frontend should PATCH /players for that slot.
  awaitingNewBatterFor?: 'striker' | 'non-striker';
  // Backwards-compat alias. Mirrors `!!awaitingNewBatterFor`. Read-only —
  // never set this directly; always set `awaitingNewBatterFor`.
  awaitingNewBatter?: boolean;
  awaitingNewBowler?: boolean;
  fallOfWickets: FallOfWicket[];
  freeHitActive?: boolean;
};

export type Toss = {
  winner: TeamSide;
  elected: 'bat' | 'bowl';
};

export type MatchStatus = 'live' | 'innings-break' | 'finished';

export type MatchFormat = 'T5' | 'T10' | 'T20' | 'ODI' | 'custom';

export type MatchRules = {
  wideRuns: 1 | 2;
  noBallRuns: 1 | 2;
  maxOversPerBowler: number;
  powerplayOvers: number;
};

export type Match = {
  id: string;
  teamA: string;
  teamB: string;
  oversLimit: number;
  playersA: string[];
  playersB: string[];
  toss: Toss;
  innings: [Innings] | [Innings, Innings];
  status: MatchStatus;
  result?: string;
  venue?: string;
  matchFormat?: MatchFormat;
  rules: MatchRules;
  createdAt: number;
  updatedAt: number;
};

export type BallInput = {
  runs: number;
  extra?: Extra;
  wicket?: boolean;
  wicketType?: WicketType;
  dismissedPlayer?: string;
  fielder?: string;
  runOutEnd?: 'striker' | 'non-striker';
  // On `extra: 'nb'`, bat-off runs credited to the batter. When undefined,
  // defaults to `runs` (backwards-compat fallback). When defined, `runs`
  // represents byes/leg-byes on the no-ball (added to extras, not batter).
  batRuns?: number;
};
