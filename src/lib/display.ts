import type { Ball, MatchRules } from "@/lib/types";

type PenaltyRules = Pick<MatchRules, "wideRuns" | "noBallRuns">;

/**
 * The actual team-runs contributed by this ball: extra penalty + b.runs.
 * Legal balls: penalty=0. Wide/no-ball: penalty from rules (1 or 2).
 * Bye/leg-bye: no penalty, runs counted via b.runs.
 */
export function ballTeamDelta(b: Ball, rules: PenaltyRules): number {
  const runs = b.runs ?? 0;
  // batRuns may exist on no-ball deliveries (off-bat runs on a no-ball).
  // For team total, we add it on top of the penalty.
  const maybe = b as Ball & { batRuns?: number };
  const batRuns = maybe.batRuns ?? 0;
  if (b.extra === "wd") return rules.wideRuns + runs;
  if (b.extra === "nb") return rules.noBallRuns + runs + batRuns;
  return runs;
}

/**
 * Composite ball pill label.
 *  - Wide: `WD`, `1WD`, `2WD`
 *  - No-ball: `Nb`, `1Nb` (off-bat or extras taken)
 *  - Bye/Leg-bye: `B2`, `LB1`
 *  - Wicket: appended with `+W`. Pure wicket → `W`.
 *  - Otherwise: the off-bat run count.
 */
export function displayLabel(b: Ball): string {
  const runs = b.runs ?? 0;
  const maybe = b as Ball & { batRuns?: number };
  const batRuns = maybe.batRuns ?? 0;
  let core = "";

  if (b.extra === "wd") {
    core = runs > 0 ? `${runs}WD` : "WD";
  } else if (b.extra === "nb") {
    const off = batRuns + runs;
    core = off > 0 ? `${off}Nb` : "Nb";
  } else if (b.extra === "b") {
    core = `B${runs}`;
  } else if (b.extra === "lb") {
    core = `LB${runs}`;
  } else {
    core = String(runs);
  }

  if (b.wicket) {
    return core === "0" ? "W" : `${core}+W`;
  }
  return core;
}
