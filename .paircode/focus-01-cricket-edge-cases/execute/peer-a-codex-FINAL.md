<!-- peer_id: peer-a-codex -->

# Peer A Prototype Report

## Code written

- `.paircode/sandbox/peer-a-codex/validateWicket.ts`
  - Standalone `validateWicketForDelivery(extra, wicketType, freeHitActive)` reference implementation.
  - Enforces no-ball/free-hit, wide, bye, and leg-bye dismissal allow-lists.
- `.paircode/sandbox/peer-a-codex/ballToDelta-nb.ts`
  - Standalone `ballToDelta(input, penalties)` variant with `batRuns` and `extraRuns` split for no-balls.
  - Keeps no-ball penalty and rare no-ball byes in extras, credits bat runs to batter, charges all no-ball runs to bowler, marks batter faced when no-ball bat runs exist, and counts no-ball 4/6 off-bat boundaries.

## Edge cases caught beyond the short plan text

- `freeHitActive=true` is intentionally stricter than `extra='wd'`; stumped and hit-wicket are rejected on a free-hit wide even though they are normally valid on a wide.
- `freeHitActive=true` with no extra still rejects bowled, caught, lbw, stumped, and hit-wicket.
- No-ball `extraRuns` are charged to bowler and extras but not batter or balls faced, while no-ball `batRuns` are charged to batter and bowler but not extras.
- The no-ball prototype preserves backwards compatibility: if `extra='nb'` and no `batRuns` is passed, legacy `runs` is treated as `batRuns`.
- Negative or fractional run inputs throw early instead of silently corrupting score deltas.

## Alpha should double-check

- Whether the final `Ball.runs` field should store total runs excluding penalty, as this prototype does, or continue storing the UI-entered legacy value for render compatibility.
- Whether PR1 should persist `batRuns` and `extraRuns` on `Ball`, or compute deltas only and leave persisted schema smaller.
- Whether no-ball deliveries with only penalty or byes should count as a ball faced in the app's chosen scoring convention; this prototype follows the requested mapping by tying balls faced to `batRuns`.
- Whether retired-hurt should bypass `wicketsDelta` in the production delta path; this prototype leaves wicket counting to the caller because the requested helper was focused on no-ball attribution.
