"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Trophy } from "lucide-react";
import { BallPill, EmptyPill } from "@/components/BallPill";
import { Scorecard } from "@/components/Scorecard";
import { Tabs, type TabDef } from "@/components/Tabs";
import { ScoreHeader } from "@/components/ScoreHeader";
import { BottomNav } from "@/components/BottomNav";
import type { Ball, Innings, Match } from "@/lib/types";
import { ballTeamDelta } from "@/lib/display";

type TabId = "live" | "scorecard" | "commentary" | "info";

function formatOvers(b: number) {
  return `${Math.floor(b / 6)}.${b % 6}`;
}
function rr(runs: number, balls: number) {
  if (!balls) return "0.00";
  return ((runs / balls) * 6).toFixed(2);
}
function lastOver(balls: Ball[]): Ball[] {
  const legalTotal = balls.filter((b) => b.countsAsBall).length;
  const overStart = legalTotal - (legalTotal % 6 === 0 && legalTotal > 0 ? 6 : legalTotal % 6);
  let seen = 0;
  let idx = 0;
  for (let i = 0; i < balls.length; i++) {
    if (seen >= overStart) {
      idx = i;
      break;
    }
    if (balls[i].countsAsBall) seen++;
    if (seen === overStart) {
      idx = i + 1;
      break;
    }
  }
  return balls.slice(idx);
}

type OverGroup = {
  overNumber: number;
  balls: { ball: Ball; label: string }[];
  runs: number;
  wickets: number;
  complete: boolean;
};

function groupByOver(balls: Ball[], rules?: Match["rules"]): OverGroup[] {
  const groups: OverGroup[] = [];
  let curr: OverGroup | null = null;
  for (const b of balls) {
    if (!curr) {
      curr = { overNumber: groups.length + 1, balls: [], runs: 0, wickets: 0, complete: false };
    }
    const ballInOver = curr.balls.filter((x) => x.ball.countsAsBall).length;
    const overIdx = groups.length;
    const label = `${overIdx + 1}.${ballInOver + (b.countsAsBall ? 1 : 0)}`;
    curr.balls.push({ ball: b, label });
    if (b.wicket) curr.wickets += 1;
    const overLegal = curr.balls.filter((x) => x.ball.countsAsBall).length;
    if (overLegal === 6) {
      curr.complete = true;
      groups.push(curr);
      curr = null;
    }
  }
  if (curr) groups.push(curr);
  for (const g of groups) {
    g.runs = g.balls.reduce(
      (s, x) =>
        s +
        (rules
          ? ballTeamDelta(x.ball, rules)
          : x.ball.runs),
      0
    );
  }
  return groups;
}

export default function ViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("live");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/match/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMatch(data.match ?? data);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <main
        className="flex-1 flex items-center justify-center"
        style={{ color: "var(--text-muted)", fontSize: 13 }}
      >
        Loading…
      </main>
    );
  }
  if (err || !match) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <p style={{ color: "var(--wicket-red)" }}>{err ?? "Match not found"}</p>
        <Link href="/" style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          Home
        </Link>
      </main>
    );
  }

  const isLive = match.status === "live";
  const inn = (match.innings[1] ?? match.innings[0]) as Innings;

  const tabs: TabDef<TabId>[] = [
    { id: "live", label: "Live" },
    { id: "scorecard", label: "Scorecard" },
    { id: "commentary", label: "Commentary" },
    { id: "info", label: "Info" },
  ];

  return (
    <main
      className="flex-1 flex flex-col"
      style={{
        backgroundColor: "var(--background)",
        paddingBottom: "calc(80px + 8px)",
      }}
    >
      <ScoreHeader match={match} innings={inn} showLive={isLive} />

      <div className="px-5 pt-4 flex items-center justify-between">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        <button
          onClick={load}
          aria-label="Refresh"
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            backgroundColor: "var(--surface)",
          }}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="px-5 pt-4">
        {tab === "live" && <LiveTab match={match} />}
        {tab === "scorecard" && <ScorecardTab match={match} />}
        {tab === "commentary" && <CommentaryTab match={match} />}
        {tab === "info" && <InfoTab match={match} />}
      </div>

      <BottomNav />
    </main>
  );
}

function teamName(m: Match, inn: Innings) {
  return inn.battingTeam === "A" ? m.teamA : m.teamB;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function LiveTab({ match }: { match: Match }) {
  const inn = (match.innings[1] ?? match.innings[0]) as Innings;
  const balls = lastOver(inn.balls);
  const overRuns = balls.reduce((s, b) => s + ballTeamDelta(b, match.rules), 0);
  const recentBalls = [...inn.balls].slice(-10).reverse();

  const groups = groupByOver(inn.balls, match.rules);

  return (
    <div className="flex flex-col gap-5">
      {match.status === "finished" && match.result && (
        <div
          className="flex items-center gap-3"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <Trophy size={20} color="var(--primary)" />
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Result
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {match.result}
            </div>
          </div>
        </div>
      )}

      <Section title="Batting">
        <BattersTable innings={inn} />
      </Section>

      <Section title="Bowling">
        <BowlersTable innings={inn} />
      </Section>

      <Section title="This Over">
        <div className="flex items-center gap-2">
          <div className="flex gap-2 overflow-x-auto flex-1">
            {balls.length === 0
              ? Array.from({ length: 6 }).map((_, i) => <EmptyPill key={i} />)
              : balls.map((b, i) => <BallPill key={i} ball={b} />)}
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-secondary)",
            }}
          >
            {overRuns} runs
          </span>
        </div>
      </Section>

      <Section title="Ball by Ball">
        {recentBalls.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
            }}
          >
            No balls yet
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentBalls.map((b, i) => {
              // find label
              let label = "";
              for (const g of groups) {
                const hit = g.balls.find((x) => x.ball === b);
                if (hit) {
                  label = hit.label;
                  break;
                }
              }
              return (
                <div
                  key={i}
                  className="flex gap-3 items-baseline"
                  style={{
                    backgroundColor: b.wicket
                      ? "var(--wicket-red-light)"
                      : "var(--surface)",
                    border: `1px solid ${b.wicket ? "var(--wicket-red)" : "var(--border)"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      fontVariantNumeric: "tabular-nums",
                      minWidth: 44,
                    }}
                  >
                    {label} ov
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: b.wicket
                        ? "var(--wicket-red)"
                        : "var(--text-primary)",
                    }}
                    className="flex-1"
                  >
                    {b.commentary ?? fallbackCommentary(b)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {match.innings[0] && match.innings.length === 2 && (
        <div
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
          }}
          className="flex items-baseline justify-between"
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {match.innings[0]!.battingTeam === "A" ? match.teamA : match.teamB}
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {match.innings[0]!.runs}/{match.innings[0]!.wickets}
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginLeft: 6,
              }}
            >
              ({formatOvers(match.innings[0]!.ballsBowled)})
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function BattersTable({ innings }: { innings: Innings }) {
  const batters = innings.batters ?? [];
  if (batters.length === 0) {
    return (
      <div
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          textAlign: "center",
          padding: 12,
        }}
      >
        No batters yet
      </div>
    );
  }
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        className="grid grid-cols-12 px-4 py-2"
        style={{
          backgroundColor: "var(--surface-elevated)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <span className="col-span-6">Batter</span>
        <span className="col-span-2 text-right">R</span>
        <span className="col-span-2 text-right">B</span>
        <span className="col-span-2 text-right">SR</span>
      </div>
      {batters.map((b) => {
        const sr = b.ballsFaced > 0 ? ((b.runs / b.ballsFaced) * 100).toFixed(1) : "—";
        const onStrike = !b.out && b.name === innings.striker;
        const onCrease = !b.out && (b.name === innings.striker || b.name === innings.nonStriker);
        return (
          <div
            key={b.name}
            className="grid grid-cols-12 items-center px-4 py-2"
            style={{
              borderTop: "1px solid var(--border-light)",
              fontSize: 13,
            }}
          >
            <span
              className="col-span-6 truncate"
              style={{
                color: b.out ? "var(--text-secondary)" : "var(--text-primary)",
                fontWeight: onCrease ? 600 : 500,
              }}
            >
              {b.name}
              {onStrike && (
                <span style={{ color: "var(--primary)", marginLeft: 6 }}>●</span>
              )}
              {b.out && b.howOut && (
                <span
                  className="block"
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontWeight: 400,
                  }}
                >
                  {b.howOut}
                </span>
              )}
            </span>
            <span
              className="col-span-2 text-right"
              style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
            >
              {b.runs}
            </span>
            <span
              className="col-span-2 text-right"
              style={{
                fontVariantNumeric: "tabular-nums",
                color: "var(--text-secondary)",
              }}
            >
              {b.ballsFaced}
            </span>
            <span
              className="col-span-2 text-right"
              style={{
                fontVariantNumeric: "tabular-nums",
                color: "var(--text-secondary)",
              }}
            >
              {sr}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BowlersTable({ innings }: { innings: Innings }) {
  const bowlers = innings.bowlers ?? [];
  if (bowlers.length === 0) {
    return (
      <div
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          textAlign: "center",
          padding: 12,
        }}
      >
        No bowlers yet
      </div>
    );
  }
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        className="grid grid-cols-12 px-4 py-2"
        style={{
          backgroundColor: "var(--surface-elevated)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <span className="col-span-6">Bowler</span>
        <span className="col-span-2 text-right">O</span>
        <span className="col-span-1 text-right">R</span>
        <span className="col-span-1 text-right">W</span>
        <span className="col-span-2 text-right">Econ</span>
      </div>
      {bowlers.map((b) => {
        const overs = `${Math.floor(b.ballsBowled / 6)}.${b.ballsBowled % 6}`;
        const econ =
          b.ballsBowled > 0 ? ((b.runsConceded / b.ballsBowled) * 6).toFixed(2) : "—";
        const isCurrent = b.name === innings.bowler;
        return (
          <div
            key={b.name}
            className="grid grid-cols-12 items-center px-4 py-2"
            style={{
              borderTop: "1px solid var(--border-light)",
              fontSize: 13,
            }}
          >
            <span
              className="col-span-6 truncate"
              style={{
                color: "var(--text-primary)",
                fontWeight: isCurrent ? 600 : 500,
              }}
            >
              {b.name}
              {isCurrent && (
                <span style={{ color: "var(--primary)", marginLeft: 6 }}>●</span>
              )}
            </span>
            <span
              className="col-span-2 text-right"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {overs}
            </span>
            <span
              className="col-span-1 text-right"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {b.runsConceded}
            </span>
            <span
              className="col-span-1 text-right"
              style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
            >
              {b.wickets}
            </span>
            <span
              className="col-span-2 text-right"
              style={{
                fontVariantNumeric: "tabular-nums",
                color: "var(--text-secondary)",
              }}
            >
              {econ}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScorecardTab({ match }: { match: Match }) {
  return (
    <div className="flex flex-col gap-6">
      {match.innings.map((i, idx) =>
        i ? (
          <section key={idx}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
              }}
            >
              {teamName(match, i)} innings
            </div>
            <Scorecard innings={i} />
          </section>
        ) : null
      )}
    </div>
  );
}

type CommentaryFilter = "all" | "boundaries" | "wickets" | "extras";

function CommentaryTab({ match }: { match: Match }) {
  const [filter, setFilter] = useState<CommentaryFilter>("all");
  const inn = (match.innings[1] ?? match.innings[0]) as Innings;
  const groups = useMemo(() => groupByOver(inn.balls, match.rules), [inn.balls, match.rules]);

  const matches = (b: Ball) => {
    if (filter === "all") return true;
    if (filter === "boundaries") return !b.extra && (b.runs === 4 || b.runs === 6);
    if (filter === "wickets") return !!b.wicket;
    if (filter === "extras") return b.extra !== undefined;
    return true;
  };

  const filterTabs: TabDef<CommentaryFilter>[] = [
    { id: "all", label: "All" },
    { id: "boundaries", label: "Boundaries" },
    { id: "wickets", label: "Wickets" },
    { id: "extras", label: "Extras" },
  ];

  const reversed = [...groups].reverse();

  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={filterTabs} value={filter} onChange={setFilter} />

      {reversed.length === 0 && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            textAlign: "center",
            padding: 24,
          }}
        >
          No commentary yet.
        </div>
      )}

      {reversed.map((g) => {
        const visibleBalls = g.balls.filter((x) => matches(x.ball));
        if (visibleBalls.length === 0 && filter !== "all") return null;
        return (
          <section key={g.overNumber}>
            <div
              className="flex justify-between px-1 mb-2"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <span>Over {g.overNumber}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {g.runs} run{g.runs === 1 ? "" : "s"}
                {g.wickets > 0 ? `, ${g.wickets} wkt${g.wickets > 1 ? "s" : ""}` : ""}
              </span>
            </div>
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {[...visibleBalls].reverse().map((x, i) => (
                <div
                  key={i}
                  className="flex gap-3 px-4 py-3"
                  style={{
                    borderTop: i === 0 ? "none" : "1px solid var(--border-light)",
                    backgroundColor: x.ball.wicket
                      ? "var(--wicket-red-light)"
                      : "transparent",
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      fontVariantNumeric: "tabular-nums",
                      minWidth: 40,
                    }}
                  >
                    {x.label}
                  </span>
                  <span
                    style={{
                      color: x.ball.wicket
                        ? "var(--wicket-red)"
                        : "var(--text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    {x.ball.commentary ?? fallbackCommentary(x.ball)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function fallbackCommentary(b: Ball): string {
  if (b.wicket) return `WICKET! ${b.dismissedPlayer ?? "batter"} out`;
  if (b.extra === "wd") return `Wide${b.runs > 1 ? ` + ${b.runs - 1}` : ""}`;
  if (b.extra === "nb") return `No-ball${b.runs > 1 ? ` + ${b.runs - 1}` : ""}`;
  if (b.extra === "b") return `${b.runs} bye${b.runs === 1 ? "" : "s"}`;
  if (b.extra === "lb") return `${b.runs} leg bye${b.runs === 1 ? "" : "s"}`;
  if (b.runs === 0) return "No run";
  if (b.runs === 4) return "FOUR!";
  if (b.runs === 6) return "SIX!";
  return `${b.runs} run${b.runs === 1 ? "" : "s"}`;
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoTab({ match }: { match: Match }) {
  const tossTeam = match.toss.winner === "A" ? match.teamA : match.teamB;
  const battingFirst =
    match.toss.elected === "bat"
      ? tossTeam
      : match.toss.winner === "A"
      ? match.teamB
      : match.teamA;

  return (
    <div className="flex flex-col gap-3">
      <InfoCard title="Match">
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
          {match.teamA} vs {match.teamB}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginTop: 4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {match.oversLimit} overs per side
          {match.matchFormat && match.matchFormat !== "custom" && ` · ${match.matchFormat}`}
        </div>
        {match.venue && (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 6,
            }}
          >
            {match.venue}
          </div>
        )}
        <div
          style={{ fontSize: 13, marginTop: 10, color: "var(--text-secondary)" }}
        >
          Status:{" "}
          <span
            style={{ color: "var(--text-primary)", fontWeight: 600 }}
          >
            {match.status === "live"
              ? "Live"
              : match.status === "innings-break"
              ? "Innings break"
              : "Finished"}
          </span>
        </div>
        {match.result && (
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--primary)",
              fontWeight: 600,
            }}
          >
            {match.result}
          </div>
        )}
      </InfoCard>

      <InfoCard title="Toss">
        <div style={{ fontSize: 14, color: "var(--text-primary)" }}>
          <span style={{ fontWeight: 700 }}>{tossTeam}</span> won the toss and chose to{" "}
          <span style={{ fontWeight: 600 }}>{match.toss.elected}</span>.
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginTop: 4,
          }}
        >
          Batting first:{" "}
          <span style={{ color: "var(--text-primary)" }}>{battingFirst}</span>
        </div>
      </InfoCard>

      {match.rules && (
        <InfoCard title="Rules">
          <div
            className="grid grid-cols-2 gap-y-2"
            style={{ fontSize: 13 }}
          >
            <span style={{ color: "var(--text-secondary)" }}>Wide</span>
            <span
              className="text-right"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {match.rules.wideRuns} run{match.rules.wideRuns === 1 ? "" : "s"}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>No-ball</span>
            <span
              className="text-right"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {match.rules.noBallRuns} run{match.rules.noBallRuns === 1 ? "" : "s"}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>Max overs/bowler</span>
            <span
              className="text-right"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {match.rules.maxOversPerBowler}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>Powerplay</span>
            <span
              className="text-right"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {match.rules.powerplayOvers} ov
            </span>
          </div>
        </InfoCard>
      )}

      <InfoCard title={`${match.teamA} squad`}>
        <ul className="grid gap-1" style={{ fontSize: 13 }}>
          {match.playersA.map((p) => (
            <li key={p} style={{ color: "var(--text-primary)" }}>
              {p}
            </li>
          ))}
        </ul>
      </InfoCard>

      <InfoCard title={`${match.teamB} squad`}>
        <ul className="grid gap-1" style={{ fontSize: 13 }}>
          {match.playersB.map((p) => (
            <li key={p} style={{ color: "var(--text-primary)" }}>
              {p}
            </li>
          ))}
        </ul>
      </InfoCard>
    </div>
  );
}
