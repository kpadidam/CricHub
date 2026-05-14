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
  | 'retired-out';

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
  out: boolean;
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
  awaitingNewBatter?: boolean;
  awaitingNewBowler?: boolean;
  fallOfWickets: FallOfWicket[];
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
};
