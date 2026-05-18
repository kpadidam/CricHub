# Alpha v1 — Cricket scoring edge-case audit

Context: I have full session memory of this codebase. Engine, types, WicketModal, score page all touched recently. This is my honest punch list of every edge case CricHub mishandles, ranked by user impact.

## Snapshot of what we do today

- `BallInput`: `{ runs, extra?: 'wd'|'nb'|'b'|'lb', wicket?: boolean, wicketType?, dismissedPlayer?, fielder?, runOutEnd? }`
- `applyBall` builds a delta, swaps strikers on odd runs / end of over, marks dismissed batter `out`, fills `howOut`, appends `FallOfWicket`, generates commentary.
- Wicket flow: `WicketModal` lets you pick from 9 dismissal types. Run-out: pick striker/non-striker end + 0–4 runs completed + fielder. No combos with `wd`/`nb` allowed by the modal.
- `setPlayers` (PATCH /players) lets you replace striker, non-striker, or bowler — validates roster membership.
- `undoLastBall` replays the entire innings to recover state from `balls[]`.
- Squad-size aware all-out check exists.

## Punch list — prioritised by user impact

### CRITICAL — daily use, currently broken

**1. Run-out: pick which batter is out by NAME, not by end label**
- Scenario: striker hits, both batters run 1 (they cross), going for the 2nd run a throw breaks the non-striker's end → original-striker (now at non-striker's end) is out.
- Today: modal asks "striker / non-striker END" — ambiguous because after the 1 completed run, positions swapped. User must reason about positions instead of names.
- Should: show both current batter NAMES as the two buttons. Engine receives `dismissedPlayer` directly; deletes the matching slot.
- Difficulty: **S** (modal change + engine validation that dismissedPlayer is one of striker/nonStriker).

**2. Wide / No-ball + wicket combo not supported**
- Scenario A: wide ball, keeper collects, stumps batter → wide stays as 1 extra + stumped wicket. Bowler gets the wicket. Ball doesn't count.
- Scenario B: wide ball, batters run, one is run out → wide + run-out. Ball doesn't count. Run-out runs do NOT count beyond what was completed.
- Scenario C: no-ball, batters run 2 for the no-ball, one is run out attempting 3rd → no-ball + run-out, runs=2 (the completed ones), wicket. Ball doesn't count.
- Today: `BallInput` allows it shape-wise but `WicketModal` can only fire after the keypad's Wd/Nb panel; there's no UX to combine extras + wicket. Engine accepts it but commentary/howOut may be off.
- Should: allow combo. Validate which wicket types are legal on which extra (see #4). Bowler runsConceded must include the extra penalty + any runs taken.
- Difficulty: **M** (UX flow change; engine validation; commentary tweaks).

**3. Free-hit tracking absent**
- Scenario: any no-ball → next legal ball is free hit. On a free hit, batter CANNOT be out by anything except run-out, obstructing the field, or hit-the-ball-twice. Free-hit status persists across subsequent no-balls or wides (only a legal ball "consumes" it).
- Today: zero tracking.
- Should: `innings.freeHit: boolean`. Set true after every no-ball. Cleared after the next legal delivery. UI shows a "FREE HIT" pill above the keypad. WicketModal filters dismissal types when `freeHit` is true.
- Difficulty: **M** (engine state + UI badge + modal filter).

**4. No-ball dismissals validation**
- Scenario: on a no-ball, the only valid dismissals are: run-out, obstructing the field, hit-ball-twice, handled-the-ball (now obstructing). Bowled / caught / LBW / stumped / hit-wicket are NOT VALID.
- Today: the keypad arms an extra (wd/nb) and then a wicket — but engine doesn't validate dismissal-type against extra. So a "no-ball + caught" goes through and falsely credits the bowler.
- Should: engine returns 400 for invalid combo. Modal disables/greys those buttons.
- Difficulty: **S** (validation block + UI grey-out).

**5. Wide dismissals validation**
- Scenario: on a wide, valid dismissals are: run-out, stumped, obstructing field, hit-wicket. NOT VALID: bowled, caught (no contact), LBW.
- Today: same as #4 — no validation.
- Should: same as #4.
- Difficulty: **S**.

### HIGH — happens regularly, currently wrong

**6. Bye + wicket / Leg-bye + wicket**
- Scenario: bowler bowls legal ball, ball passes batter (bye) or hits pad (leg-bye), batters run for it, one is run out.
- Today: modal can only do "wicket" with no extras context. No UI path for "leg-bye 1 + run out".
- Should: combo allowed. Runs go to extras, bowler not credited, ball counts as legal, batter ballsFaced++.
- Difficulty: **M**.

**7. Mankad / non-striker run-out before delivery**
- Scenario: bowler runs out non-striker before delivery stride. Legal per Law 41.16. Ball doesn't count, no runs anywhere, just a wicket and `awaitingNewBatter` (specifically for nonStriker slot).
- Today: not supported. Engine assumes wicket means striker.
- Should: dedicated dismissal type `run-out-non-striker` (or treat as run-out where dismissed=nonStriker AND no ball-counts, no runs).
- Difficulty: **M** (new BallInput shape with `ballCounts: false`).

**8. Overthrows**
- Scenario: batters complete 2 runs, fielder throws toward keeper, ball goes to the boundary → 2 + 4 = 6 runs.
- Today: only single 0–6 / extras buttons; no way to combine. Many local scorers just enter "6" and move on (acceptable). But for accuracy ought to track overthrows separately (commentary distinguishes them).
- Should: optional "+ overthrow 4" affordance. For v1, "just enter 6" is acceptable — call this a known limitation.
- Difficulty: **L** (data model expansion, commentary, scorecard).

**9. Retired hurt vs retired out — currently both count as a wicket**
- Today: both call `applyBall({ wicket: true, wicketType })`. Engine increments wickets count for both.
- Should: retired hurt does NOT count as a wicket (innings continues, batter can return). retired out counts. Engine needs to skip wicket-count increment for `retired-hurt`. Also, retired-hurt batter needs a flag so they can re-enter via `setPlayers`.
- Difficulty: **S** (engine flag, batter state).

### MEDIUM — important for correctness

**10. Strike rotation on last-ball-of-over wicket**
- Scenario: 6th ball of over, batter takes 1 run AND gets run out at the non-striker's end → 1 run completed (odd) crosses them, then non-striker is out at striker's end, then end-of-over strike swap should put the surviving batter (who just took a run) at the non-striker's end for the new over.
- Today: engine swaps on odd runs AND swaps on end-of-over. Net: surviving batter is at non-striker's end. Correct for normal case but interaction with the missing dismissedPlayer-by-name fix (#1) must preserve correctness.
- Should: verify via tests once #1 lands.
- Difficulty: **S** (test only).

**11. Wicket on last ball of over — strike at start of next over**
- Scenario: 6th ball, striker out (bowled). New batter comes in. Conventionally the NEW batter faces the next over (because strike swaps at end of over, and the new batter takes the now-vacant striker slot, then they swap to non-striker for new over). Or… depends on whether runs were also taken.
- Today: ambiguous. Need to confirm engine behaviour.
- Should: codify and test. Standard rule: new batter starts at the end where the dismissed batter was. End-of-over swap then sends the new batter to non-striker. So the surviving original batter faces the new over.
- Difficulty: **S** (test + possibly a tweak).

**12. Penultimate-ball wicket carrying free-hit state**
- Scenario: ball 5 is a no-ball → ball 6 is a free hit. Ball 6 is also a wide → free hit persists. Ball 7 (new over) is legal → free-hit consumed.
- Today: free-hit not tracked.
- Should: persist `freeHit: true` across any non-legal delivery; clear on first legal delivery (counted as ball).
- Difficulty: **S** (once #3 lands, this is one extra line).

### LOW — nice to have, can defer

**13. Dead ball**
- Almost never used in local scoring. Skip.

**14. Absent hurt / not in starting XI returning mid-match**
- Skip for MVP.

**15. Crossing rule for new batter end**
- Scenario: striker hit, batters ran 1, crossed. On the 2nd run, striker is out at the non-striker's end (since they crossed). New batter takes that end (non-striker's end). End-of-over swap then determines who faces.
- Today: not modelled at all. We assume new batter always replaces the slot whose name is `out: true`.
- Should: when run-out happens mid-run with N runs completed, the new batter goes to the end the dismissed batter started from, considering crossings. For v1, **accept that the user manually picks a slot** via `setPlayers({ striker })` or `setPlayers({ nonStriker })`.
- Difficulty: **L** if automated; **S** if we just let the user pick.

### EDIT-BALL — separate workstream

**16. Edit ball N (not just undo last)**
- Scenario: 3 overs in, user realises ball 12 was wrongly recorded as a 4 instead of a 2.
- Today: only `undoLastBall` exists. To fix ball 12 you'd have to undo 6+ balls and re-enter them — destructive.
- Should: 
  - List ball-by-ball (already exists in viewer Commentary tab).
  - Each row has an Edit affordance for the scorer.
  - Edit posts a new endpoint `PATCH /api/match/[id]/ball/:index` with new `BallInput`.
  - Backend replaces `balls[index]` and **calls `rebuildStats` over the new ball sequence** (we already have replay-from-balls in `undoLastBall`).
  - Show diff toast: "Ball 12 changed from 4 to 2. Score now 87/3."
- Difficulty: **M** (we already have the replay engine; this is mostly a new endpoint + a list UI).

## Summary table

| # | Case | Diff | Tier |
|---|---|---|---|
| 1 | Run-out picker by name | S | Critical |
| 2 | wd/nb + wicket combos | M | Critical |
| 3 | Free hit | M | Critical |
| 4 | No-ball dismissal validation | S | Critical |
| 5 | Wide dismissal validation | S | Critical |
| 6 | bye/lb + wicket | M | High |
| 7 | Mankad | M | High |
| 8 | Overthrows | L | High (deferable) |
| 9 | Retired hurt ≠ wicket | S | High |
| 10 | Last-ball wicket strike test | S | Medium |
| 11 | Wicket+over-end strike codify | S | Medium |
| 12 | Free hit persistence | S | Medium |
| 15 | Crossing-end new batter (manual) | S | Low |
| 16 | Edit-ball endpoint | M | Separate workstream |

## Recommended ship order

1. Combo: **#1 + #4 + #5** (run-out name picker, wicket+extras validation) — one tight PR.
2. **#3 + #12** (free hit tracking + UI).
3. **#2 + #6** (UX for wd/nb + wicket, bye/lb + wicket).
4. **#9** (retired hurt fix).
5. **#7** (Mankad).
6. **#16** (edit-ball) — separate PR.
7. **#10 + #11** (codify + tests).

Skip #8, #13, #14, #15-automated for v1.
