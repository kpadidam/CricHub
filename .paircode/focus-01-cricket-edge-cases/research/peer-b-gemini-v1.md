<!-- peer_id: peer-b-gemini -->
<!-- cli: gemini -->
<!-- model: (default) -->
<!-- duration_s: 47.7 -->
<!-- ok: True -->

To provide a comprehensive audit, I have analyzed the core engine (`src/lib/engine.ts`), type definitions (`src/lib/types.ts`), and UI components (`src/components/WicketModal.tsx`, `src/app/score/[id]/page.tsx`).

The following report identifies gaps between the current implementation and the **MCC Laws of Cricket (2022 Code)**.

---

# CricHub Cricket-Rules Edge-Case Audit

## (1) Wicket + Extras Combinations

| Scenario | Current Behavior | Correct Law / Expected | Difficulty |
| :--- | :--- | :--- | :--- |
| **Wide + Stumped** | Logic in `engine.ts` (L180) allows any wicket on a wide. Ball doesn't count. | **Correct.** Wide penalty (1 run) stands. Ball doesn't count. Wicket credited to bowler. | S |
| **Wide + Run-out** | Allowed. Ball doesn't count. | **Correct.** Wide penalty stands. Runs completed before run-out are added to Wides (Law 25.3). | S |
| **No-ball + Run-out** | Allowed. Ball doesn't count. | **Correct.** No-ball penalty stands. Runs completed off-bat (if any) count as runs. | S |
| **No-ball + Illegal Dismissal** | `engine.ts` allows 'bowled', 'caught', 'lbw', 'stumped', 'hit-wicket' on No-ball. | **BUG.** Striker can only be out: Run out, Hit the ball twice, Obstructing the field. (Law 21.18). | M |
| **Wide + Illegal Dismissal** | `engine.ts` allows 'bowled', 'caught', 'lbw', 'hit-wicket' on Wide. | **BUG.** Striker can only be out: Stumped, Run out, Obstructing the field, Hit wicket (Law 25.4 says No, wait—Law 25.4 says *only* Stumped, Run Out, Obstructing. Hit-wicket is NOT allowed on a Wide). | M |

## (2) Free Hit Logic

| Scenario | Current Behavior | Correct Law / Expected | Difficulty |
| :--- | :--- | :--- | :--- |
| **Post No-Ball state** | No "Free Hit" state exists in `Innings` or `Match`. | Next ball after any No-ball is a Free Hit. If next ball is Wide/NB, Free Hit persists. | M |
| **Free Hit Dismissals** | Any dismissal can be selected. | Only Run Out, Obstructing the field, and Hit the ball twice are allowed (same as No-ball rules). | M |

## (3) Run-out Details

| Scenario | Current Behavior | Correct Law / Expected | Difficulty |
| :--- | :--- | :--- | :--- |
| **Crossing (2022 Law)** | No crossing logic. `awaitingNewBatter` allows picking either slot. | **BUG.** Law 18.11: The new batter *must* come in at the end the out batter was at. Strike rotation logic (L341) swaps on runs, which is correct for *live* play. | M |
| **Runs Completed** | `WicketModal` captures runs, `engine.ts` adds them. | **Partial.** Runs completed *before* the run-out count (Law 18.6). However, if they were crossing for the 2nd run and got out, only 1 run counts. | S |
| **Which Batter Out?** | Determines via `runOutEnd` ('striker' or 'non-striker'). | **Correct.** But the UI should ideally show player names (e.g., "Was John out or Doe?") rather than "Striker/Non-striker" to avoid confusion during crossing. | S |

## (4) Bye / Leg-Bye + Wicket

| Scenario | Current Behavior | Correct Law / Expected | Difficulty |
| :--- | :--- | :--- | :--- |
| **Bye + Run Out** | Runs count as byes. Ball counts. | **Correct.** Runs completed before the dismissal count as extras (Law 18.6). | S |
| **Bye + Illegal Combo** | Allows "Bye + Bowled". | **BUG.** If a ball is "Bowled", it cannot be "Byes". The wicket takes precedence and runs are zeroed. | S |

## (5) Retired Hurt vs. Retired Out

| Scenario | Current Behavior | Correct Law / Expected | Difficulty |
| :--- | :--- | :--- | :--- |
| **Retired Hurt** | `engine.ts` (L187) increments `wickets` total. | **BUG.** Law 25.4.2: Retired-Hurt is "Retired - not out". It should NOT increment the team wicket count or end the innings. | M |
| **Return to Crease** | No mechanism for a retired-hurt batter to return. | Batter can return at the fall of a wicket or another retirement. | L |
| **Retired Out** | Increments `wickets`. | **Correct.** Counts as a wicket for the team, not credited to the bowler. | S |

## (6) Dead Ball

| Scenario | Current Behavior | Correct Law / Expected | Difficulty |
| :--- | :--- | :--- | :--- |
| **Dead Ball event** | No Dead Ball action in UI. | A Dead Ball results in no runs, no wicket, and the ball not counting (except in specific rare cases). | S |

## (7) Mankad (Non-striker Run Out)

| Scenario | Current Behavior | Correct Law / Expected | Difficulty |
| :--- | :--- | :--- | :--- |
| **Pre-delivery run-out** | Can be scored as a Run-out on Non-striker. | **Correct.** Law 38.3. But `engine.ts` currently assumes a ball was bowled (`batterFacedDelta` is always 1 if not a Wide). | S |

## (8) Ball Faced Incrementation

| Scenario | Current Behavior | Correct Law / Expected | Difficulty |
| :--- | :--- | :--- | :--- |
| **Wide** | `batterFacedDelta = 0`. | **Correct.** | - |
| **No-ball** | `batterFacedDelta = 1`. | **Correct.** (Law 21.18). | - |
| **Bye / Leg-bye** | `batterFacedDelta = 1`. | **Correct.** | - |

## (9) Last-ball-of-over / All-out

| Scenario | Current Behavior | Correct Law / Expected | Difficulty |
| :--- | :--- | :--- | :--- |
| **Wicket on 6th ball** | Strike does NOT swap (L341). | **Correct.** Law 18.11.2: If an over ends at the fall of a wicket, batters do not cross. The new batter starts the next over at the other end. | S |
| **All-out Logic** | `maxWickets = squadSize - 1`. | **Correct.** For a team of 11, the innings ends when the 10th wicket falls. | S |
| **Absent Hurt** | Not handled. | If a team is "All-out" because remaining players are "Absent Hurt", the innings ends. | M |

## (10) Edit-Ball & History Replay

| Scenario | Current Behavior | Correct Law / Expected | Difficulty |
| :--- | :--- | :--- | :--- |
| **Undo limitations** | `undoLastBall` uses `rebuildStats` which approximates player names. | **BUG.** `rebuildStats` (L366) says: "Subsequent batter/bowler changes... aren't recoverable." If a user changes a player and then undos, the state might corrupt. | L |
| **Prior Ball Edit** | UI button exists but is disabled. | Ability to edit any ball in the `balls[]` array and trigger a `rebuildStats` from the beginning. | L |

---

### Priority Implementation Roadmap (Punch-list)

1.  **[High]** Fix `retired-hurt` logic (Do not increment wickets).
2.  **[High]** Validate No-ball/Wide wicket types (Disable Bowled/Caught for NB).
3.  **[Med]** Implement "Free Hit" state tracking.
4.  **[Med]** Improve `rebuildStats` to handle player-change events (needs `Ball` to store `strikerName`/`bowlerName`).
5.  **[Low]** Add "Retired Out" vs "Retired Hurt" distinction in UI.
6.  **[Low]** Implement full "Edit Ball" history.
