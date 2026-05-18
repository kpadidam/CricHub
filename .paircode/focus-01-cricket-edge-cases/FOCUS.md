# FOCUS — cricket-edge-cases

**Opened:** 2026-05-18 11:14:09
**Prompt:** Deep research: identify EVERY edge case in cricket scoring our CricHub app may be missing. Focus on: wicket+extras combos, free hit rules, run-out edge cases, no-ball dismissals, bye/leg-bye+wicket, overthrows, retired hurt vs out, dead ball, mankad, ball faced rules per delivery, runs attribution, last-ball-of-over, all-out vs overs-exhausted, edit-ball capability. Read PRD.md, engine.ts, types.ts, WicketModal.tsx, score page. Output prioritized punch-list: scenario, current behavior, expected behavior, S/M/L difficulty.

## Goal

_Edit this section with the concrete goal of this focus._

## Roster override

_Leave empty to inherit from `.paircode/peers.yaml`. Or list peer ids to include/exclude for this focus._

```yaml
include: []    # if set, only these peers participate
exclude: []    # if set, these peers skip this focus
```

## Human gate

```yaml
mode: auto                   # auto | manual_between_stages | manual_every_N_rounds | manual_always
max_rounds_per_stage: 20
convergence: 3_rounds_no_new_findings
```

## Stages

- [ ] research
- [ ] plan
- [ ] execute

## Notes

_Captain's running notes for this focus._
flow: research → plan → execute
