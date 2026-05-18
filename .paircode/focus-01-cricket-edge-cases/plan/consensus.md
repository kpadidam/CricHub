# Consensus — Cricket edge-case audit — plan

## Where all three plans agreed

- **3 PRs**, sequential, additive-only schema changes.
- **PR 1 — Engine correctness** (no UI flow change): add `obstructing-field` + `hit-ball-twice` wicket types; decouple `retired-hurt` from wicket count; split no-ball into bat runs vs penalty; dismissal-vs-extra validation gate; fix last-ball-of-over wicket swap; clear stale awaiting flags on innings end; BallPill / over-total / commentary render fixes.
- **PR 2 — Wicket-flow rework**: `awaitingNewBatterFor: 'striker'|'non-striker'` slot tracking; run-out by NAME picker; composite delivery composer in WicketModal (extra → dismissal → runs → player → fielder); Bye / Leg-bye buttons in scorer keypad.
- **PR 3 — Free hit**: `freeHitActive` state on innings, set by nb, kept by wd, consumed by first legal ball; UI pill; dismissal filter in WicketModal.
- **Defer to v2**: overthrows, absent hurt, edit-ball, super over, automated crossing rules.

## Where plans clashed

1. **PR organisation:** alpha said PR1 ships pure engine, PR2 wicket-flow, PR3 free-hit. Codex split engine/types in PR1, slots+free-hit in PR2, UI in PR3. Gemini was closest to alpha.
   - **Verdict:** alpha's split wins — keep free-hit as its own PR so it's independently revertable, and ship the UI composer in PR2 not PR3.
2. **WicketModal touch count:** codex flagged that PR2 touches the modal for run-out and PR3 touches it again for free-hit. Alpha's split avoids this (modal touched once in PR2 for composer; PR3 only adds a `freeHitActive` prop and a disable filter — trivial second touch).
3. **End-to-end testability of PR1:** codex correctly noted PR1's API accepts `batRuns` but the UI doesn't send it until PR2/3 — meaning PR1 is hard to manually test end-to-end. Mitigated by: PR1 ships with a backwards-compat fallback (`batRuns` defaults to `runs` on a no-ball), so the existing no-ball flow records correctly to batter immediately, no UI change needed.
4. **`BatterStat.out` vs `.status`:** codex kept `out: boolean` and added `status` alongside (additive); alpha proposed replacing `out` with derived getter. Codex is safer.

## Team-lead verdict

The plan is solid. Three peers converged on the same fundamentals with only PR-shape disagreements. Codex's concerns about churn on WicketModal and PR1's testability were legitimate and absorbed.

Final shape:

- **PR 1 (Engine correctness)** ~45 min — pure backend + render fixes. Backwards-compat fallback means it ships safely. End-user sees no flow change.
- **PR 2 (Wicket flow + bye/lb UI + run-out by name)** ~90 min — biggest UX change. Backend slot tracking + frontend composer.
- **PR 3 (Free hit)** ~30 min — small, additive, independently revertable.

Parallelisable: yes. Within each PR, an engine agent and a UI agent can work in parallel, sharing the type contracts.

For this execute pass we'll ship **all three PRs as one bundle** via two parallel agents — backend (engine + types + API + validation) and frontend (modal composer + scorer keypad + free-hit pill + render fixes). The user pushes after each PR's worth of changes lands cleanly.

## Next action

Proceed to **execute stage**: dispatch backend + frontend agents in parallel with the full PR1+PR2+PR3 scope. Confirm typecheck + minimal smoke before reporting back.
