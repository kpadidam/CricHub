<!-- peer_id: peer-a-codex -->
<!-- cli: codex -->
<!-- model: (default) -->
<!-- duration_s: 120.7 -->
<!-- ok: True -->

# P0 Implementation Plan

## PR 1: Engine Schema, Validation, And Retired Status

**Goal:** Stop corrupt scoring at the engine/API layer before expanding UI paths.

**Scope:**
- [src/lib/types.ts](/Users/karthikpadidam/Desktop/project/crichub/src/lib/types.ts)
- [src/lib/engine.ts](/Users/karthikpadidam/Desktop/project/crichub/src/lib/engine.ts)
- [src/app/api/match/[id]/ball/route.ts](/Users/karthikpadidam/Desktop/project/crichub/src/app/api/match/[id]/ball/route.ts)
- Add engine regression tests, ideally `src/lib/engine.test.ts` plus `npm test`

**Implementation steps:**
1. Extend `WicketType` with `obstructing-field` and `hit-ball-twice`; update `WICKET_TYPES`, `howOutString`, and commentary switch cases.
2. Add `status?: 'active' | 'out' | 'retired-hurt' | 'retired-out'` to `BatterStat` while keeping existing `out: boolean` for compatibility.
3. Change retired-hurt handling so it marks batter status as `retired-hurt`, does not increment `wickets`, does not add fall-of-wicket, does not credit bowler, and does not count as a ball faced.
4. Keep retired-out as wicket-counting, but mark status as `retired-out`.
5. Add additive `BallInput` fields: `batRuns?: number`, `extraRuns?: number`. Keep `runs` as legacy total/input fallback.
6. In `ballToDelta`, normalize runs:
   - normal: `batRuns = input.batRuns ?? input.runs`
   - `b/lb/wd`: `extraRuns = input.extraRuns ?? input.runs`
   - `nb`: `batRuns = input.batRuns ?? input.runs`, `extraRuns = input.extraRuns ?? 0`, total = no-ball penalty + batRuns + extraRuns
7. Store normalized `batRuns` and `extraRuns` on `Ball` additively so old `runs` can remain the display/legacy value during transition.
8. Add `validateWicketForDelivery(extra, wicketType, freeHitActive?)` in `engine.ts`.
9. Gate invalid combos:
   - no-ball: only `run-out`, `obstructing-field`, `hit-ball-twice`
   - wide: only `run-out`, `stumped`, `obstructing-field`
   - bye/leg-bye: only non-bowler dismissals that can coexist with extras, primarily `run-out`, `obstructing-field`, `hit-ball-twice`
   - free hit rules are added in PR 2, but structure the helper now.
10. Update API route validation to accept new wicket types and `batRuns`/`extraRuns`.
11. Return 400 from the API for engine validation errors, not 500.

**Risks:**
- Existing stored balls only have `runs`; normalization must preserve old behavior.
- Retired-hurt status can break roster exclusion if UI still only checks `out`.

**Success criteria/tests:**
- `retired-hurt` leaves `innings.wickets`, `fallOfWickets`, bowler wickets, and striker balls faced unchanged.
- `retired-out` still increments team wickets.
- `nb + caught`, `nb + bowled`, `wd + caught`, `b + bowled`, `lb + lbw` are rejected.
- `nb + run-out`, `wd + stumped`, `wd + run-out`, `b/lb + run-out` are accepted.
- No-ball off-bat `batRuns: 4` produces team +5, batter +4, extras +1, bowler conceded +5.
- Run `npm run lint`, `npm run build`, and new engine tests.

---

## PR 2: Batter Slot Tracking, Free Hit, And Over-End State

**Goal:** Make state transitions correct for run-outs, free hits, and end-of-over wickets.

**Scope:**
- [src/lib/types.ts](/Users/karthikpadidam/Desktop/project/crichub/src/lib/types.ts)
- [src/lib/engine.ts](/Users/karthikpadidam/Desktop/project/crichub/src/lib/engine.ts)
- [src/app/api/match/[id]/players/route.ts](/Users/karthikpadidam/Desktop/project/crichub/src/app/api/match/[id]/players/route.ts)
- [src/app/score/[id]/page.tsx](/Users/karthikpadidam/Desktop/project/crichub/src/app/score/[id]/page.tsx)
- [src/components/WicketModal.tsx](/Users/karthikpadidam/Desktop/project/crichub/src/components/WicketModal.tsx)

**Implementation steps:**
1. Add `awaitingNewBatterFor?: 'striker' | 'non-striker'` to `Innings`; keep `awaitingNewBatter` as derived/backward-compatible flag.
2. For dismissals, determine the dismissed slot by matching `dismissedPlayer` against current `striker`/`nonStriker`; fall back to current behavior only when omitted.
3. On wicket, set `awaitingNewBatterFor` to the dismissed slot instead of assuming striker.
4. Update `setPlayers` so replacing the required slot clears `awaitingNewBatter` and `awaitingNewBatterFor`; replacing the wrong slot should not clear it.
5. Update the score page new-batter prompt to patch `{ striker: name }` or `{ nonStriker: name }` based on `awaitingNewBatterFor`.
6. Change `WicketModal` run-out UI from “striker/non-striker end” to current batter names; submit `dismissedPlayer` directly. Keep `runOutEnd` only as legacy metadata if useful.
7. Add `freeHitActive?: boolean` to `Innings`.
8. In `applyBall`, capture `wasFreeHit = current.freeHitActive`; validate wicket type using PR 1 helper.
9. State machine:
   - any no-ball sets `freeHitActive = true`
   - wide/no-ball while already free-hit keeps it true
   - first legal non-no-ball delivery consumes it after validation
10. Show a compact `FREE HIT` badge in scorer UI when active.
11. Fix last-ball-over wicket swap: apply normal odd-run swap first, apply end-of-over swap even when wicket occurs, then keep the dismissed slot empty via `awaitingNewBatterFor`.
12. If `checkInningsOver` is true, clear `awaitingNewBatter`, `awaitingNewBatterFor`, and `awaitingNewBowler` so finished/innings-break states do not prompt stale modals.

**Risks:**
- Slot logic is the most fragile area; old `runOutEnd` and new `dismissedPlayer` may conflict.
- End-of-over wicket behavior needs tests for bowled, run-out with odd runs, and wicket on innings final ball.

**Success criteria/tests:**
- Run-out modal displays names, not end labels.
- Run-out of non-striker prompts replacement into non-striker slot.
- No-ball sets free hit; wide/no-ball does not consume it; legal ball consumes it.
- On free hit, `caught`, `bowled`, `lbw`, `stumped`, `hit-wicket` are rejected.
- Wicket on final legal ball of over still rotates ends and prompts for the correct vacant slot.
- Wicket on final ball of innings/target chase does not show new batter prompt.
- Run `npm run lint`, `npm run build`, and engine tests.

---

## PR 3: Scorer UX For Extras, Wicket Combos, And Rendering

**Goal:** Expose the corrected engine behavior in the scorer and make ball displays honest.

**Scope:**
- [src/app/score/[id]/page.tsx](/Users/karthikpadidam/Desktop/project/crichub/src/app/score/[id]/page.tsx)
- [src/components/ExtrasPanel.tsx](/Users/karthikpadidam/Desktop/project/crichub/src/components/ExtrasPanel.tsx)
- [src/components/WicketModal.tsx](/Users/karthikpadidam/Desktop/project/crichub/src/components/WicketModal.tsx)
- [src/components/BallPill.tsx](/Users/karthikpadidam/Desktop/project/crichub/src/components/BallPill.tsx)
- [src/app/m/[id]/page.tsx](/Users/karthikpadidam/Desktop/project/crichub/src/app/m/[id]/page.tsx)
- [src/lib/engine.ts](/Users/karthikpadidam/Desktop/project/crichub/src/lib/engine.ts)

**Implementation steps:**
1. Replace `armedExtra: 'wd' | 'nb'` with a small delivery composer state: `{ extra?: 'wd'|'nb'|'b'|'lb'; batRuns?: number; extraRuns?: number }`.
2. Add scorer buttons for `Bye` and `Leg Bye`.
3. For no-ball, let scorer choose off-bat runs separately from optional extra runs; submit `{ extra: 'nb', batRuns, extraRuns }`.
4. For wide/bye/leg-bye, submit `{ extra, extraRuns }`.
5. Let the Wicket button open `WicketModal` with current composed extra context, so it can submit combined deliveries like `wd + stumped`, `nb + run-out`, `lb + run-out`.
6. Pass `extra`, `freeHitActive`, striker/non-striker names, and legal dismissal list into `WicketModal`; disable illegal options with short labels.
7. Keep direct run buttons for common normal balls unchanged.
8. Fix `BallPill` rendering:
   - wicket + extra should render composite text like `NB+W`, `WD+W`, `1B+W`
   - wide/no-ball extra run labels should not subtract 1 from `b.runs`
   - prefer normalized `batRuns`/`extraRuns` when present
9. Add a shared helper such as `ballTotalRuns(ball, rules)` or `displayRunsForBall(ball, rules)` and use it for “This Over” totals in scorer and public match page.
10. Update `buildCommentary` so wicket + extras mentions both the dismissal and runs/extras; no-ball off-bat commentary matches the new `batRuns` split.

**Risks:**
- Too much scorer UI in one pass can become cluttered; keep composer compact and reuse `ExtrasPanel`.
- Public page totals need the same helper as scorer to avoid diverging again.

**Success criteria/tests:**
- Scorer can enter bye and leg-bye without using the API manually.
- Scorer can enter `wd + stumped`, `wd + run-out`, `nb + run-out`, `b/lb + run-out`.
- Scorer cannot select illegal wicket types for current extra/free-hit context.
- `WD + 1 run` displays as `1WD`, not `WD`; `WD + 2` displays as `2WD`.
- This-over totals include wide/no-ball penalties and all extra runs.
- Commentary for no-ball off-bat gives batter runs correctly.
- Run `npm run lint`, `npm run build`, engine tests, and manual scorer smoke test.

---

## Explicit V2 Deferrals

Defer these out of the P0 batch: overthrows, absent-hurt, edit-ball, super-over, and full non-delivery/mankad modeling. For v1, overthrows remain “enter the total runs manually,” and run-out remains delivery-based unless already representable by current flow.
