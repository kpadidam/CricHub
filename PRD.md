# CricHub — Product Requirements Document

**Version:** 0.1 (MVP) · **Target build:** 3 hours · **Date:** 2026-05-14

## 1. Overview
CricHub is a **mobile-first web app** for scoring live cricket matches ball-by-ball. One person scores from their phone; others open a shared link to view the live scorecard (refresh to update). No accounts, no installs — just a URL.

### Non-goals (v0.1)
Realtime push, auth, player history, charts, desktop-optimized layouts.

## 2. Users
- **Scorer** — friend at a gully/club match scoring on phone.
- **Viewer** — teammates / spectators following remotely.

## 3. Use cases (MVP)
| # | Use case | Priority |
|---|---|---|
| 1 | Start match (teams, overs, toss, bat/bowl) | P0 |
| 2 | Score per ball: 0/1/2/3/4/6, W, Wd, Nb, B, Lb | P0 |
| 3 | Auto totals: score, wickets, overs.balls, RR | P0 |
| 4 | Track striker, non-striker, bowler | P0 |
| 5 | Rotate strike on odd runs & end of over | P0 |
| 6 | End of innings → switch, set target | P0 |
| 7 | Match end → winner / tie | P0 |
| 8 | Share viewer URL | P0 |
| 9 | Undo last ball | P1 |
| 10 | Last-6-balls strip | P1 |

## 4. Rules
- Wide/no-ball: +1 run, ball doesn't count.
- Bye/leg-bye: runs to extras, ball counts.
- Odd runs (1,3): swap striker.
- End of over: swap striker, prompt bowler.
- 10 wickets OR overs done → end innings.

## 5. Data model
```ts
type Ball = { runs: number; extra?: 'wd'|'nb'|'b'|'lb'; wicket?: boolean; countsAsBall: boolean };
type Innings = { battingTeam: 'A'|'B'; runs: number; wickets: number; ballsBowled: number; extras: number; balls: Ball[]; striker?: string; nonStriker?: string; bowler?: string };
type Match = { id: string; teamA: string; teamB: string; oversLimit: number; toss: { winner:'A'|'B'; elected:'bat'|'bowl' }; innings: [Innings, Innings?]; status: 'live'|'innings-break'|'finished'; result?: string; createdAt: number; updatedAt: number };
```

## 6. Stack
Next.js 14 App Router · TS · Tailwind · shadcn primitives · Vercel KV (in-memory stub for local) · Vercel hosting.

## 7. Design
**Dark-only.** Linear × ESPN Cricinfo × Apple Sports.
- bg `#0A0A0B`, text `#FAFAFA`
- accents: green `#16A34A` (runs), red `#DC2626` (wickets), amber `#F59E0B` (extras)
- Geist + Geist Mono (tabular nums for score)
- `rounded-2xl` cards, `rounded-full` chips
- thumb-zone action grid bottom half
- min tap target 44×44px

### Scorer layout (top→bottom)
1. Sticky top bar: `Team A 84/3` left · `12.4 / 20` right · RR muted · Undo top-right.
2. Players card: Striker* · Non-striker · Bowler.
3. This-over strip: 6 ball pills.
4. Action grid: 2×3 runs (`0 1 2 / 3 4 6`), row of W/Wd/Nb/B-Lb.

### Viewer layout
Huge score · sub-line (overs · CRR · need X from Y) · batters/bowler · last over · pull-to-refresh.

## 8. API
| Route | Method | Purpose |
|---|---|---|
| `/api/match` | POST | Create → returns id |
| `/api/match/:id` | GET | Fetch state |
| `/api/match/:id/ball` | POST | Append ball |
| `/api/match/:id/undo` | POST | Pop last ball |
| `/api/match/:id/innings` | POST | Close/start innings |

Pages: `/` (landing) · `/new` (setup) · `/score/:id` (scorer) · `/m/:id` (viewer).

## 9. Plan
| Time | Milestone |
|---|---|
| 0:00–0:20 | Scaffold |
| 0:20–0:50 | Setup form + create API |
| 0:50–1:50 | Scorer UI + ball POST |
| 1:50–2:20 | Innings switch + match end |
| 2:20–2:40 | Viewer + share |
| 2:40–3:00 | Deploy & test |

## 10. Done = 
Score a 5-over match on a phone with no bugs; second phone sees same score after refresh; doesn't look like 2008.
