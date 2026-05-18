# Consensus — Cricket edge-case audit — research

## Where peers agreed

All three takes (alpha, codex, gemini) converged on these as **P0 / Critical**:

1. **No-ball off-bat runs lost to extras** (codex caught this; alpha missed it). Today bat runs on a no-ball are bucketed as extras with `offBatRuns = 0` — silently wrong for every nb ever recorded.
2. **No-ball / wide dismissal-type validation is absent.** Engine accepts `nb + caught`, `nb + bowled`, `wd + caught`, etc. — all illegal under Laws 21.18 & 25.4. Wicket flow is also missing `obstructing-field` and `hit-ball-twice`.
3. **Run-out picker by NAME, not by end label.** "Striker / non-striker end" is ambiguous after a crossed run. Should show actual batter names. Engine must accept a `dismissedPlayer` name and slot the new batter into the right end (`awaitingNewBatterFor: 'striker'|'non-striker'` flag).
4. **Free hit not tracked at all.** No field anywhere. Need `freeHitActive` that persists through subsequent wides/nbs and is consumed by the next legal ball.
5. **Retired hurt is wrongly counted as a wicket.** Engine increments wickets count and writes a FoW. Should be a batter-status change only — innings continues, batter can return.
6. **Bye / leg-bye buttons not exposed in the scorer UI at all.** PRD P0 omission. (Engine supports them.)
7. **Last-ball-of-over wicket: end-of-over swap is skipped.** Engine guards with `if (!wicket)` — wrong. End-of-over swap should still apply, then new batter takes the dismissed end.
8. **Overs-exhausted on a wicket** leaves a stale `awaitingNewBatter` even though innings is over.
9. **Edit-ball is a separate workstream** — current "undo last" is the only mutation. Need either per-ball snapshots or full event-sourced replay.

## Where peers clashed

- **Mankad / pre-delivery run-out:** codex says model it as a non-delivery event (`countsAsBallOverride: false`); alpha said pragmatically dispatch as a new dismissal type. Both work — codex's approach is cleaner.
- **Overthrows:** codex wants a full data model split (`completedRuns` + `overthrowRuns` + attribution). Alpha said "just enter total and skip for v1." Gemini agreed with codex direction but rated **L**. → For v1 ship "just enter total"; revisit in v2.
- **Crossing rules:** gemini wants automatic computation per Law 18.11. Codex and alpha agree that for a club app, **letting the user manually choose the new batter's slot via `setPlayers`** is acceptable.
- **Super over:** all three said skip.

## Other findings worth keeping

From codex (alpha & gemini missed):

- **BallPill rendering bug**: `b.runs > 1 ? b.runs - 1 : ...` is wrong because `b.runs` already excludes the wide/nb penalty. Wide+1 renders as "WD" not "1WD"; wide+2 renders as "1WD".
- **This-over runs total** sums `b.runs` only — drops the wd/nb penalty. Wrong.
- **Wicket pill always returns "W"** before checking extras — composite cases (`Nb+W`, `B1W`) render as just `W`.
- **Wicket commentary returns immediately** — never mentions runs or extras for combined dismissals.
- **`buildCommentary` says "off bat" for no-ball runs** that the engine is currently bucketing into extras — commentary text is inconsistent with the stats it generates.
- **Retired hurt also increments balls-faced** because modal sends `runs: 0, wicket: true` — counts as a delivery faced.
- **Absent hurt** not modelled at all (batter status: active / out / retired-hurt / retired-out / absent-hurt).

## Team-lead verdict

The audit is solid and grounded. Every claim citing engine.ts:NNN was spot-checked and held. The peers surfaced **3 bugs my own pass missed entirely**: no-ball off-bat runs going to extras, the pill/over-total rendering errors, and the retired-hurt-as-faced-ball issue. Worth the round.

Final P0 stack-rank for ship order:

1. **Retired-hurt fix + new dismissal types** (`obstructing-field`, `hit-ball-twice`, separate retired status). Small, prevents data corruption.
2. **No-ball off-bat runs** — add `batRuns` separate from `extraRuns` on a no-ball. Critical correctness fix.
3. **Dismissal validation against extra** (nb/wd → only legal wickets). Backend gate; UI filter.
4. **Run-out by name** + `awaitingNewBatterFor` slot tracking.
5. **wd/nb + wicket combos** in scorer UI (composite delivery composer).
6. **Free hit** state + UI badge + dismissal filter (depends on #3, #4).
7. **Bye / leg-bye buttons** + bye/lb + wicket combos.
8. **Last-ball-over wicket strike rotation** + stale `awaitingNewBatter` cleanup.
9. **BallPill/commentary/this-over-total** rendering fixes.

Defer to v2: overthrows, absent hurt, edit-ball, super over, mankad-as-non-delivery-event (current run-out path is good enough).

## Next action

Move to **plan stage** — produce a concrete implementation plan for items 1–9 above. Group into 3 shippable PRs to keep blast radius manageable.
