<!-- peer_id: peer-b-gemini -->
<!-- cli: gemini -->
<!-- model: (default) -->
<!-- duration_s: 65.7 -->
<!-- ok: True -->

This implementation plan addresses the P0 cricket edge cases identified during research, focusing on engine correctness, data integrity, and UI exposure.

### PR #1: Engine Core & Rules (Retired Hurt, No-Ball Runs, Dismissal Validation)
**Goal:** Fix data corruption for retired hurt and no-ball runs; implement mandatory dismissal validation.

**Files to touch:**
- `src/lib/types.ts`
- `src/lib/engine.ts`
- `src/app/api/match/[id]/ball/route.ts`
- `src/components/WicketModal.tsx`

**Steps:**
1.  **Types:** Add `obstructing-field` and `hit-ball-twice` to `WicketType`.
2.  **Retired Hurt:** Update `applyBall` in `engine.ts` to check `wicketType`. If `retired-hurt`, skip `wicketsDelta` increment and skip adding to `fallOfWicket` array. Ensure `ballsFaced` still increments if it was a legal delivery.
3.  **No-Ball Runs:** Refactor `applyBall` no-ball logic. Split `input.runs` into `offBatRuns` (credited to batter) and `extraRuns` (the 1-run penalty). Ensure both contribute to the team total and bowler's runs conceded.
4.  **Dismissal Validation:**
    *   In `engine.ts`, implement a validator:
        *   **No-ball:** Reject if `wicketType` is caught, bowled, lbw, stumped, or hit-wicket.
        *   **Wide:** Reject if `wicketType` is caught, bowled, or lbw.
    *   In `route.ts`, return 400 if validation fails.
5.  **WicketModal:** Add buttons for `obstructing-field` and `hit-ball-twice`. Add "Retired Hurt" as an option.

**Risks:**
- Legacy matches with `retired-hurt` already recorded as wickets will stay as-is (fixable only via manual DB migration, but we assume in-memory/fresh starts for now).

**Success Criteria:**
- Retired-hurt does not increase the wicket count in the header.
- No-ball with 1 run adds 1 to batter score and 1 to extras (total 2).
- API rejects "No-ball + Caught".

---

### PR #2: Run-out Accuracy & Slot Tracking
**Goal:** Ensure the correct batter is removed and the right slot is replaced, especially during crossings or last-ball wickets.

**Files to touch:**
- `src/lib/types.ts`
- `src/lib/engine.ts`
- `src/app/score/[id]/page.tsx`
- `src/components/WicketModal.tsx`

**Steps:**
1.  **Slot Tracking:** Update `Match` / `Innings` type: change `awaitingNewBatter: boolean` to `awaitingNewBatterFor: 'striker' | 'non-striker' | null`.
2.  **Run-out by Name:** Update `WicketModal` for run-outs to show two buttons with the actual names of the `striker` and `nonStriker`. Pass the selected `dismissedPlayer` name to the API.
3.  **Engine Logic:**
    *   In `applyBall`, if `dismissedPlayer` is provided, find which slot (striker/non-striker) matches the name.
    *   Set that slot to `null` in the resulting state.
    *   Set `awaitingNewBatterFor` to the vacated slot.
4.  **Last-ball Swap Fix:** In `engine.ts`, move the `isOverEnd` strike swap logic *outside* of the `if (!wicket)` block. Ensure strike rotation happens even if a wicket falls on ball 6.
5.  **UI Update:** In `page.tsx`, update the `handlePlayerSelect` logic to use `awaitingNewBatterFor` to determine which slot to PATCH when a new batter is selected.

**Risks:**
- If the user provides a `dismissedPlayer` name that doesn't match either current batter (race condition or UI bug), engine must fallback safely or error.

**Success Criteria:**
- Non-striker run-out correctly leaves the `nonStriker` slot empty.
- Last-ball wicket correctly rotates strike for the surviving batter.

---

### PR #3: Scorer UI & Polishing (Free Hit, Extras, Rendering)
**Goal:** Surface missing scoring controls and fix visual bugs in BallPills and commentary.

**Files to touch:**
- `src/lib/types.ts`
- `src/lib/engine.ts`
- `src/app/score/[id]/page.tsx`
- `src/components/BallPill.tsx`
- `src/components/WicketModal.tsx`

**Steps:**
1.  **Free Hit:**
    *   Add `freeHitActive: boolean` to `Innings` state.
    *   In `engine.ts`, set `freeHitActive = true` if current ball is No-ball.
    *   Clear `freeHitActive` only after a legal delivery (not a wide/nb).
    *   In `WicketModal`, if `freeHitActive`, disable/grey-out illegal dismissal types (same rules as No-ball).
2.  **Bye/Leg-Bye UI:** Add "B" and "LB" buttons to the `ExtrasPanel` in `page.tsx`. Wire them to `applyBall` with `extra: 'b' | 'lb'`.
3.  **Composite Entry:** Allow selecting "W" after "Wd" or "Nb" in the keypad. Ensure the `WicketModal` receives the context of the currently "armed" extra.
4.  **Rendering Fixes:**
    *   **BallPill:** Update logic to show `[runs]WD` or `[runs]NB`. (e.g., Wide + 1 run = `1WD`).
    *   **This Over Total:** Update `sum` logic in `page.tsx` to use the `teamDelta` calculated by the engine instead of raw `ball.runs`.
    *   **Commentary:** Update `buildCommentary` in `engine.ts` to include both the extra type and the dismissal description (e.g., "No ball, and Smith is Run Out").

**Risks:**
- "Free Hit" state persisting across overs or innings breaks if not carefully reset.

**Success Criteria:**
- "Free Hit" badge appears after a No-ball.
- Bye/Leg-bye buttons correctly attribute runs to extras and balls-faced to batter.
- Wide + 1 run displays as `1WD` in the over-strip.
