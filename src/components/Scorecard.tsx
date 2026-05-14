import type { Innings } from "@/lib/types";

function overs(b: number) {
  return `${Math.floor(b / 6)}.${b % 6}`;
}
function sr(runs: number, balls: number) {
  if (!balls) return "—";
  return ((runs / balls) * 100).toFixed(1);
}
function econ(runs: number, balls: number) {
  if (!balls) return "—";
  return ((runs / balls) * 6).toFixed(2);
}

const sectionLabel =
  "text-[12px] font-semibold uppercase text-[var(--text-secondary)] mb-2 px-1";
const headerCell =
  "text-[12px] font-semibold uppercase text-[var(--text-secondary)]";
const rowCls =
  "text-sm font-medium text-[var(--text-primary)] tabular";

export function Scorecard({ innings }: { innings: Innings }) {
  const batters = innings.batters ?? [];
  const bowlers = innings.bowlers ?? [];
  const fow = innings.fallOfWickets ?? [];

  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className={sectionLabel} style={{ letterSpacing: "0.1em" }}>
          Batting
        </div>
        <div
          className="bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
          style={{ borderRadius: "var(--radius-lg)" }}
        >
          <div
            className={`grid grid-cols-[1fr_2.2rem_2.2rem_1.8rem_1.8rem_2.6rem] gap-2 px-3 py-2 ${headerCell} border-b border-[var(--border-light)]`}
            style={{ letterSpacing: "0.1em" }}
          >
            <span>Batter</span>
            <span className="text-right">R</span>
            <span className="text-right">B</span>
            <span className="text-right">4s</span>
            <span className="text-right">6s</span>
            <span className="text-right">SR</span>
          </div>
          {batters.length === 0 ? (
            <div className="px-3 py-3 text-[var(--text-secondary)] text-sm italic">
              No batters yet
            </div>
          ) : (
            batters.map((b, i) => {
              const isStriker =
                !b.out && b.name === innings.striker && !innings.awaitingNewBatter;
              const isNonStriker = !b.out && b.name === innings.nonStriker;
              return (
                <div
                  key={b.name + i}
                  className={`grid grid-cols-[1fr_2.2rem_2.2rem_1.8rem_1.8rem_2.6rem] gap-2 px-3 py-2 border-b border-[var(--border-light)] last:border-b-0 ${rowCls}`}
                >
                  <span className={`truncate ${b.out ? "text-[var(--text-muted)]" : ""}`}>
                    {b.name}
                    {isStriker && <span className="text-[var(--primary)] font-bold"> *</span>}
                    {isNonStriker && <span className="text-[var(--text-muted)]"> </span>}
                    {b.out && (
                      <span className="text-[10px] text-[var(--wicket-red)] ml-1">
                        ({b.howOut ?? "out"})
                      </span>
                    )}
                  </span>
                  <span className="text-right font-semibold">{b.runs}</span>
                  <span className="text-right">{b.ballsFaced}</span>
                  <span className="text-right">{b.fours}</span>
                  <span className="text-right">{b.sixes}</span>
                  <span className="text-right text-[var(--text-secondary)]">
                    {sr(b.runs, b.ballsFaced)}
                  </span>
                </div>
              );
            })
          )}
          <div className="px-3 py-2 text-xs text-[var(--text-secondary)] border-t border-[var(--border-light)] flex justify-between">
            <span>Extras</span>
            <span className="tabular">{innings.extras}</span>
          </div>
          <div className="px-3 py-2 text-sm flex justify-between border-t border-[var(--border-light)]">
            <span className="font-semibold text-[var(--text-primary)]">Total</span>
            <span className="tabular font-semibold text-[var(--text-primary)]">
              {innings.runs}/{innings.wickets}{" "}
              <span className="text-[var(--text-secondary)] text-xs">
                ({overs(innings.ballsBowled)})
              </span>
            </span>
          </div>
        </div>
      </section>

      <section>
        <div className={sectionLabel} style={{ letterSpacing: "0.1em" }}>
          Bowling
        </div>
        <div
          className="bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
          style={{ borderRadius: "var(--radius-lg)" }}
        >
          <div
            className={`grid grid-cols-[1fr_2.4rem_2.2rem_1.8rem_2.8rem] gap-2 px-3 py-2 ${headerCell} border-b border-[var(--border-light)]`}
            style={{ letterSpacing: "0.1em" }}
          >
            <span>Bowler</span>
            <span className="text-right">O</span>
            <span className="text-right">R</span>
            <span className="text-right">W</span>
            <span className="text-right">Econ</span>
          </div>
          {bowlers.length === 0 ? (
            <div className="px-3 py-3 text-[var(--text-secondary)] text-sm italic">
              No bowlers yet
            </div>
          ) : (
            bowlers.map((b, i) => {
              const isCurrent = b.name === innings.bowler && !innings.awaitingNewBowler;
              return (
                <div
                  key={b.name + i}
                  className={`grid grid-cols-[1fr_2.4rem_2.2rem_1.8rem_2.8rem] gap-2 px-3 py-2 border-b border-[var(--border-light)] last:border-b-0 ${rowCls}`}
                >
                  <span className="truncate">
                    {b.name}
                    {isCurrent && <span className="text-[var(--primary)] font-bold"> *</span>}
                  </span>
                  <span className="text-right">{overs(b.ballsBowled)}</span>
                  <span className="text-right">{b.runsConceded}</span>
                  <span className="text-right font-semibold">{b.wickets}</span>
                  <span className="text-right text-[var(--text-secondary)]">
                    {econ(b.runsConceded, b.ballsBowled)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {fow.length > 0 && (
        <section>
          <div className={sectionLabel} style={{ letterSpacing: "0.1em" }}>
            Fall of Wickets
          </div>
          <div
            className="bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
            style={{ borderRadius: "var(--radius-lg)" }}
          >
            {fow.map((w, i) => (
              <div
                key={`${w.wicketNumber}-${i}`}
                className="px-3 py-2 text-[13px] font-mono tabular text-[var(--text-secondary)] border-b border-[var(--border-light)] last:border-b-0"
              >
                <span className="text-[var(--wicket-red)] font-semibold">
                  {w.wicketNumber}-{w.runs}
                </span>{" "}
                <span>
                  ({w.batter}, {w.over} ov)
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
