# Alpha v1 — Implementation plan for P0 edge cases

Goal: ship every P0 from research/consensus.md in 3 PRs. Each PR is independently shippable, type-checked, and won't break existing matches.

Store note: in-memory + Upstash Redis. No migrations needed — stored matches are short-lived in dev; the Vercel KV instance can be flushed safely if anyone has stale rows.

---

## PR 1 — Data correctness (no UI flow changes)

**Goal:** fix silent data corruption. Pure engine + types work + small render bugs. No new UI flows; existing UI keeps working.

**Files**
- `src/lib/types.ts`
- `src/lib/engine.ts`
- `src/app/api/match/[id]/ball/route.ts`
- `src/components/BallPill.tsx`
- `src/app/score/[id]/page.tsx` (this-over total calc only)

**Steps**

1. **Extend WicketType**: add `'obstructing-field'`, `'hit-ball-twice'`. Update `ALL_WICKET_TYPES`, `howOutString`, `bowlerCreditedFor` (neither credits bowler).
2. **Add `BatterStatus` enum**: `'active' | 'out' | 'retired-hurt' | 'retired-out'`. Change `BatterStat.out: boolean` → `status: BatterStatus`. For backwards compat keep `out` as a derived getter only where it's read (search for `b.out` usages).
3. **Retired-hurt: not a wicket**. In `applyBall`, when `wicketType === 'retired-hurt'`:
   - set `wicketsDelta = 0`
   - skip `fallOfWickets` push
   - skip `bowler.wickets++`
   - mark batter `status = 'retired-hurt'`
   - DO NOT count as a delivery: `batterFacedDelta = 0`, `ballsBowled` unchanged
   - DO NOT swap strikers; just set the slot's `awaitingNewBatter` so frontend picks a replacement
4. **Retired-out same delivery rules** (`countsAsBall = false`, `batterFacedDelta = 0`) but DO count as a wicket and add FoW.
5. **No-ball off-bat runs split**: add `batRuns?: number` to `BallInput`. Semantics:
   - On `extra: 'nb'`: if `batRuns` provided → those runs go to batter and bowler-conceded; `runs` field becomes "extras runs taken on top of penalty" (default 0, e.g. byes on no-ball).
   - Backwards compat: if `batRuns` not provided AND `extra === 'nb'`, default to assuming `batRuns = runs` (the old broken behavior, but now correctly credited).
   - For `extra: 'wd'`: `batRuns` ignored (you can't hit a wide). Validate.
   - For legal balls: `batRuns` ignored (use `runs`).
6. **Dismissal validation against extra**. New helper `validDismissal(extra, wicketType)`:
   - `extra === 'wd'`: allow only `run-out`, `stumped`, `obstructing-field`, `hit-wicket` (Mankad doesn't apply here)
   - `extra === 'nb'`: allow only `run-out`, `obstructing-field`, `hit-ball-twice`
   - `extra === 'b'|'lb'`: allow `run-out`, `obstructing-field`, `hit-ball-twice` (rare cases)
   - no extra: any
   - Return 400 in `route.ts` if invalid.
7. **Last-ball-of-over swap fix**: remove the `if (!wicket)` guard. Swap on end-of-over regardless. Then the dismissed slot is empty, awaitingNewBatter handles placement.
8. **Stale awaitingNewBatter on innings-end**: in `applyBall`, after computing `inningsDone`, if `inningsDone === true`, clear `awaitingNewBatter` and `awaitingNewBowler`.
9. **BallPill render fix**: don't subtract 1 from `b.runs`. Display the actual `runs` count adjacent to the extra label. Wide+1 = "WD 1", Wide+2 = "WD 2". For wickets with extras, show composite: "W Nb", "W Wd", "W B2".
10. **This-over total fix**: compute per-ball team delta using `wd/nb penalty + b.runs` instead of just `b.runs`. Extract `ballTeamDelta(b, rules)` helper.

**Risks**
- The `BatterStat.out` boolean → `status` enum touches every file that reads `.out`. Need to grep + update.
- `rebuildStats` (in `undoLastBall`) needs to know `retired-hurt` skips ball counts and wickets.

**Success criteria**
- `npx tsc --noEmit` clean.
- New unit-style test in `engine.test.ts`-style scratch file:
  - "no-ball + bat 4" → batter +4, extras +1, ball doesn't count, free-hit state will be set in PR3.
  - "retired-hurt mid-over" → wickets unchanged, ball count unchanged.
  - "wide + caught" → 400 from API.
  - "ball 6 wicket" → striker swapped, new batter goes to vacated slot.

**Shippable in ~45 min.**

---

## PR 2 — Wicket flow rework + run-out by name + bye/leg-bye UI

**Goal:** make the wicket modal a "composite delivery composer". User picks: extra type → dismissal type → dismissed player by name → runs.

**Files**
- `src/lib/types.ts`
- `src/lib/engine.ts`
- `src/components/WicketModal.tsx`
- `src/components/ExtrasPanel.tsx`
- `src/app/score/[id]/page.tsx`

**Steps**

1. **`awaitingNewBatterFor` slot tracking**: replace `awaitingNewBatter: boolean` with `awaitingNewBatterFor?: 'striker' | 'non-striker'`. In `applyBall`, after marking batter `out`, set this to whichever slot now has an `out` player. `setPlayers` consumes it and PATCHes the right slot. Frontend picker reads it and PATCHes accordingly.
2. **`dismissedPlayer` required for run-out** by name. Backend validates name is one of current striker/nonStriker. For other wicket types it auto-fills from striker (or non-striker if `runOutEnd === 'non-striker'`, kept for back-compat but deprecate).
3. **WicketModal rework**:
   - Step 1: "Delivery type" — Legal · Wide · No-ball · Bye · Leg-bye. If user already armed an extra on the keypad, pre-select it.
   - Step 2: "Dismissal type" — show 9 chips, but disable invalid ones based on Step 1's extra (e.g. on no-ball disable bowled/caught/lbw/stumped/hit-wicket).
   - Step 3: "Runs completed" — 0/1/2/3/4/5/6 chips (current shows 0–4; extend to 6 for completeness).
   - Step 4: "Dismissed batter" (run-out only) — two chips with actual NAMES (`Rohit`, `Kohli`).
   - Step 5: "Fielder" (caught / stumped / run-out / obstructing-field).
   - Submit POST `/api/match/[id]/ball` with the full BallInput.
4. **Bye / Leg-bye buttons in scorer keypad**:
   - Below the run grid, add `B`, `LB` buttons (similar to existing Wd/Nb).
   - Tap → arms the extra → user picks 0-6 runs (use `ExtrasPanel`).
   - Tap-wicket-while-armed → opens WicketModal with extra pre-selected.
5. **`ExtrasPanel` extended** to render run choices 0–6, not just 0–4. Used by Wd, Nb, B, Lb arming.
6. **Scorer page**: refactor to a `delivery composer` mental model. State machine:
   - idle → tap extra (Wd/Nb/B/Lb) arms; tap run sends; tap W opens modal with extra context.
   - idle → tap W opens modal with extra=null context.
   - awaiting new batter → modal opens automatically; user picks; PATCH.
   - awaiting new bowler → same.

**Risks**
- This is the biggest UX change. Easy to introduce regression in the keypad. Manual smoke test required.
- The `awaitingNewBatter: boolean` → `awaitingNewBatterFor: string?` is a breaking type change. Search-and-replace all usages.

**Success criteria**
- Run-out 1+1 (cross + dismiss): UI shows two name chips; new batter goes to the dismissed slot; surviving batter is at the OTHER end (engine swap on 1 run already does this).
- Wide + run-out: keypad → tap Wd → tap W → modal Step 1 already Wide, Step 2 only allows run-out / stumped / obstructing-field / hit-wicket. Pick run-out → pick batter name → PATCH succeeds.
- Bye 2: tap B → 2 → ball recorded as bye, batter ballsFaced++, runs to extras, bowler not charged.

**Shippable in ~90 min.**

---

## PR 3 — Free hit

**Goal:** track free-hit state and let the modal enforce dismissal restrictions on free hits.

**Files**
- `src/lib/types.ts`
- `src/lib/engine.ts`
- `src/components/WicketModal.tsx`
- `src/app/score/[id]/page.tsx`

**Steps**

1. **Add `freeHitActive: boolean` to Innings**. Defaults false.
2. **In `applyBall`**:
   - If `extra === 'nb'`: set `nextInn.freeHitActive = true` (regardless of current value).
   - Else if ball was a legal delivery (`countsAsBall === true`): set `nextInn.freeHitActive = false` (consume).
   - Else (wd or b/lb without nb just-bowled): preserve current `freeHitActive`. The Laws say free hit persists across non-counting deliveries (wides) until a legal ball is bowled.
3. **`validDismissal` extension**: when `freeHitActive === true`, only allow `run-out`, `obstructing-field`, `hit-ball-twice`. Block all others. Return 400.
4. **WicketModal**: receive `freeHitActive` prop. When true, disable all dismissals except the three allowed ones, with a small note "FREE HIT — only run-out / obstructing / hit-ball-twice".
5. **Scorer page**: render a small yellow pill above the keypad: "FREE HIT" when `freeHitActive`. Use `--extras-orange` for visibility.
6. **`undoLastBall` / `rebuildStats`**: extend the replay to also recompute `freeHitActive` per ball.

**Risks**
- Replay accuracy. The replay must run through every ball in order and recompute `freeHitActive` correctly.

**Success criteria**
- Bowl Nb → free-hit pill appears. Wd next ball → pill still shows. Legal ball next → pill gone.
- On free hit, tapping W and picking "Bowled" returns 400 with clear message.
- On free hit, run-out works as normal.

**Shippable in ~30 min.**

---

## Stop list (defer to v2)

Per consensus:
- Overthrows (separate composedRuns + overthrowRuns) — L, low daily impact
- Absent hurt — M, rare in local cricket
- Edit-ball — L, needs event sourcing / snapshots, big workstream
- Super over — L, ties are accepted
- Automated crossing rules for new batter end placement — L, user can manually PATCH /players if needed

## Ship order

PR1 → PR2 → PR3, sequentially. Each merges to `main` and Vercel rebuilds. Test the live URL after each.

## What I'd actually parallelise

If we dispatch agents:
- **Agent A: engine + types + API** (PR1 steps 1–8 backend + PR2 backend + PR3 backend)
- **Agent B: UI** (BallPill fixes, WicketModal rework, scorer keypad, FREE HIT pill)

That collapses 3 PRs into 1 ship with parallel work. Recommended.
