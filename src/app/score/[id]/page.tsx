"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Share2, Trophy, ChevronLeft, Play } from "lucide-react";
import { BallPill, EmptyPill } from "@/components/BallPill";
import { ActionButton } from "@/components/ActionButton";
import { Scorecard } from "@/components/Scorecard";
import { PlayerPromptModal } from "@/components/PlayerPromptModal";
import { PlayerPicker } from "@/components/PlayerPicker";
import { ExtrasPanel } from "@/components/ExtrasPanel";
import { WicketModal } from "@/components/WicketModal";
import { ScoreHeader } from "@/components/ScoreHeader";
import type { BallInput, Extra, Innings, Match } from "@/lib/types";
import { ballTeamDelta } from "@/lib/display";

function currentInnings(m: Match): Innings {
  return (m.innings[1] ?? m.innings[0]) as Innings;
}
function battingTeamName(m: Match, inn: Innings) {
  return inn.battingTeam === "A" ? m.teamA : m.teamB;
}
function formatOvers(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}
function runRate(runs: number, balls: number) {
  if (!balls) return "0.00";
  return ((runs / balls) * 6).toFixed(2);
}
function lastSixOfOver(balls: Innings["balls"]) {
  const totalLegal = balls.filter((b) => b.countsAsBall).length;
  const overStart = totalLegal - (totalLegal % 6 === 0 && totalLegal > 0 ? 6 : totalLegal % 6);
  let legalSeen = 0;
  let idx = 0;
  for (let i = 0; i < balls.length; i++) {
    if (legalSeen >= overStart) {
      idx = i;
      break;
    }
    if (balls[i].countsAsBall) legalSeen++;
    if (legalSeen === overStart) {
      idx = i + 1;
      break;
    }
  }
  return balls.slice(idx);
}
function battingRoster(m: Match, inn: Innings): string[] {
  return inn.battingTeam === "A" ? m.playersA : m.playersB;
}
function bowlingRoster(m: Match, inn: Innings): string[] {
  return inn.battingTeam === "A" ? m.playersB : m.playersA;
}

export default function ScorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [armedExtra, setArmedExtra] = useState<null | Extra>(null);
  const [showWicketModal, setShowWicketModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/match/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMatch(data.match ?? data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const postBall = async (input: BallInput) => {
    try {
      const res = await fetch(`/api/match/${id}/ball`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMatch(data.match ?? data);
      setArmedExtra(null);
      setShowWicketModal(false);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed");
      load();
    }
  };

  const patchPlayers = async (body: { striker?: string; nonStriker?: string; bowler?: string }) => {
    try {
      const res = await fetch(`/api/match/${id}/players`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMatch(data.match ?? data);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed");
    }
  };

  const undo = async () => {
    try {
      const res = await fetch(`/api/match/${id}/undo`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMatch(data.match ?? data);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed");
    }
  };

  const inn = useMemo(() => (match ? currentInnings(match) : null), [match]);
  const lastBalls = inn ? lastSixOfOver(inn.balls) : [];

  const share = async () => {
    const url = `${window.location.origin}/m/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      showToast(url);
    }
  };

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
  if (err || !match || !inn) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <p style={{ color: "var(--wicket-red)" }}>{err ?? "Match not found"}</p>
        <Link
          href="/"
          style={{ color: "var(--text-secondary)", fontSize: 13 }}
        >
          Home
        </Link>
      </main>
    );
  }

  if (match.status === "finished") {
    return (
      <main
        className="flex-1 flex flex-col px-5 pt-4 pb-8 gap-5"
        style={{ backgroundColor: "var(--background)" }}
      >
        <header className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="Home"
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronLeft size={22} />
          </Link>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Result
          </span>
          <span className="w-11" />
        </header>

        <div className="flex flex-col items-center text-center pt-2 gap-3">
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 56,
              height: 56,
              backgroundColor: "var(--surface-elevated)",
            }}
          >
            <Trophy size={32} color="var(--primary-light)" />
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {match.result ?? "Match ended"}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-secondary)",
            }}
          >
            {match.teamA} v {match.teamB}
          </div>
        </div>

        <div className="grid gap-3">
          {match.innings.map((i, idx) =>
            i ? (
              <div
                key={idx}
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div className="flex justify-between items-baseline">
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {battingTeamName(match, i)}
                  </span>
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: "var(--primary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {i.runs}/{i.wickets}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    fontVariantNumeric: "tabular-nums",
                    marginTop: 4,
                  }}
                >
                  {formatOvers(i.ballsBowled)} ov · CRR {runRate(i.runs, i.ballsBowled)}
                </div>
              </div>
            ) : null
          )}
        </div>

        {match.innings.map((i, idx) =>
          i ? (
            <div key={`sc-${idx}`}>
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
                {battingTeamName(match, i)} innings
              </div>
              <Scorecard innings={i} />
            </div>
          ) : null
        )}

        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={share}
            className="flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{
              height: 50,
              borderRadius: 12,
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            <Share2 size={18} /> Share
          </button>
          <Link
            href={`/m/${id}`}
            className="flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{
              height: 50,
              borderRadius: 12,
              backgroundColor: "var(--primary)",
              color: "var(--text-white)",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            <Play size={18} fill="currentColor" /> Open viewer
          </Link>
        </div>

        {toast && <Toast text={toast} />}
      </main>
    );
  }

  if (match.status === "innings-break") {
    return <InningsBreak match={match} onContinue={(m) => setMatch(m)} id={id} />;
  }

  const innExt = inn as Innings & {
    awaitingNewBatterFor?: "striker" | "non-striker";
    freeHitActive?: boolean;
  };
  const awaitingBatterSlot: "striker" | "non-striker" | null =
    innExt.awaitingNewBatterFor ?? (inn.awaitingNewBatter ? "striker" : null);
  const awaitingBatter = awaitingBatterSlot !== null;
  const awaitingBowler = !!inn.awaitingNewBowler;
  const freeHitActive = !!innExt.freeHitActive;
  const blockActions = awaitingBatter || awaitingBowler;

  const bowlersList = inn.bowlers ?? [];
  const suggestedBowler =
    bowlersList.length >= 2 ? bowlersList[bowlersList.length - 2].name : undefined;
  const lastOverBowler = inn.bowler;

  const batRoster = battingRoster(match, inn);
  const bowlRoster = bowlingRoster(match, inn);

  const outOrInNames = new Set<string>();
  (inn.batters ?? []).forEach((b) => {
    if (b.out) outOrInNames.add(b.name);
  });
  // Exclude the surviving batter (in the other slot) from the picker.
  if (awaitingBatterSlot === "striker" && inn.nonStriker) outOrInNames.add(inn.nonStriker);
  if (awaitingBatterSlot === "non-striker" && inn.striker) outOrInNames.add(inn.striker);
  if (!awaitingBatter) {
    if (inn.striker) outOrInNames.add(inn.striker);
    if (inn.nonStriker) outOrInNames.add(inn.nonStriker);
  }

  const striker = inn.striker;
  const nonStriker = inn.nonStriker;
  const strikerStat = (inn.batters ?? []).find((b) => b.name === striker && !b.out);
  const nonStrikerStat = (inn.batters ?? []).find((b) => b.name === nonStriker && !b.out);
  const bowlerStat = (inn.bowlers ?? []).find((b) => b.name === inn.bowler);

  const overRuns = lastBalls.reduce((s, b) => s + ballTeamDelta(b, match.rules), 0);

  return (
    <main
      className="flex-1 flex flex-col"
      style={{ backgroundColor: "var(--background)" }}
    >
      <ScoreHeader
        match={match}
        innings={inn}
        onUndo={undo}
        undoDisabled={inn.balls.length === 0}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-3 flex flex-col gap-4">
        <SectionLabel>Batting</SectionLabel>
        <div className="flex flex-col gap-2">
          <BatterCard
            label="Striker"
            name={awaitingBatterSlot === "striker" ? undefined : striker}
            stats={strikerStat}
            isStriker
            pending={awaitingBatterSlot === "striker"}
          />
          <BatterCard
            label="Non-striker"
            name={awaitingBatterSlot === "non-striker" ? undefined : nonStriker}
            stats={nonStrikerStat}
            pending={awaitingBatterSlot === "non-striker"}
          />
        </div>

        <SectionLabel>Bowling</SectionLabel>
        <BowlerCard
          name={awaitingBowler ? undefined : inn.bowler}
          stats={bowlerStat}
          pending={awaitingBowler}
        />

        <SectionLabel>This Over</SectionLabel>
        <div className="flex items-center gap-2">
          <div className="flex gap-2 overflow-x-auto flex-1">
            {lastBalls.length === 0
              ? Array.from({ length: 6 }).map((_, i) => <EmptyPill key={i} />)
              : lastBalls.map((b, i) => <BallPill key={i} ball={b} />)}
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

        <div className="mt-2">
          <SectionLabel>Scorecard</SectionLabel>
          <Scorecard innings={inn} />
        </div>
      </div>

      {/* Sticky Keypad */}
      <div
        className="sticky bottom-0 px-4 pt-3 pb-4"
        style={{
          backgroundColor: "var(--surface)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {freeHitActive && (
          <div className="mb-2 flex justify-center">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold tracking-wider"
              style={{
                background: "var(--extras-orange-light)",
                color: "var(--extras-orange)",
                border: "1px solid var(--extras-orange)",
              }}
            >
              FREE HIT
            </span>
          </div>
        )}
        {armedExtra && (
          <div className="mb-2">
            <ExtrasPanel
              label={
                armedExtra === "wd"
                  ? "Wide"
                  : armedExtra === "nb"
                  ? "No-ball"
                  : armedExtra === "b"
                  ? "Bye"
                  : "Leg-bye"
              }
              onSend={(runs) => {
                if (armedExtra === "nb") {
                  // Off-bat runs on a no-ball go into batRuns.
                  postBall({ runs: 0, extra: "nb", batRuns: runs } as BallInput & { batRuns?: number });
                } else {
                  postBall({ runs, extra: armedExtra });
                }
              }}
              onCancel={() => setArmedExtra(null)}
            />
          </div>
        )}
        <div className="grid grid-cols-5 gap-2 mb-2">
          {[0, 1, 2, 3, 4].map((r) => (
            <ActionButton
              key={r}
              variant={r === 4 ? "four" : "run"}
              disabled={blockActions}
              onClick={() => postBall({ runs: r })}
              className="h-14"
              style={{ fontSize: 22, fontWeight: 700 }}
            >
              {r}
            </ActionButton>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <ActionButton
            variant="run"
            disabled={blockActions}
            onClick={() => postBall({ runs: 5 })}
            className="h-14"
            style={{ fontSize: 22, fontWeight: 700 }}
          >
            5
          </ActionButton>
          <ActionButton
            variant="six"
            disabled={blockActions}
            onClick={() => postBall({ runs: 6 })}
            className="h-14"
            style={{ fontSize: 22, fontWeight: 700 }}
          >
            6
          </ActionButton>
          <ActionButton
            variant="wicket"
            disabled={blockActions}
            onClick={() => setShowWicketModal(true)}
            className="h-14"
            style={{ fontSize: 15, fontWeight: 700 }}
          >
            Wicket
          </ActionButton>
        </div>
        <div className={`grid ${match.rules.noBallsEnabled === false ? "grid-cols-3" : "grid-cols-4"} gap-2 mb-2`}>
          <ActionButton
            variant="extra"
            disabled={blockActions}
            onClick={() => setArmedExtra(armedExtra === "wd" ? null : "wd")}
            className={`h-12 ${armedExtra === "wd" ? "ring-2" : ""}`}
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            Wd
          </ActionButton>
          {match.rules.noBallsEnabled !== false && (
            <ActionButton
              variant="extra"
              disabled={blockActions}
              onClick={() => setArmedExtra(armedExtra === "nb" ? null : "nb")}
              className={`h-12 ${armedExtra === "nb" ? "ring-2" : ""}`}
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              Nb
            </ActionButton>
          )}
          <ActionButton
            variant="extra"
            disabled={blockActions}
            onClick={() => setArmedExtra(armedExtra === "b" ? null : "b")}
            className={`h-12 ${armedExtra === "b" ? "ring-2" : ""}`}
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            B
          </ActionButton>
          <ActionButton
            variant="extra"
            disabled={blockActions}
            onClick={() => setArmedExtra(armedExtra === "lb" ? null : "lb")}
            className={`h-12 ${armedExtra === "lb" ? "ring-2" : ""}`}
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            Lb
          </ActionButton>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <GhostBtn
            disabled
            title="Coming soon"
            onClick={() => {}}
          >
            Edit Ball
          </GhostBtn>
          <GhostBtn
            disabled={inn.balls.length === 0}
            onClick={undo}
          >
            Undo
          </GhostBtn>
        </div>
      </div>

      {showWicketModal && !blockActions && (
        <WicketModal
          bowlingRoster={bowlRoster}
          bowlerName={inn.bowler}
          armedExtra={armedExtra ?? undefined}
          freeHitActive={freeHitActive}
          strikerName={inn.striker}
          nonStrikerName={inn.nonStriker}
          onCancel={() => setShowWicketModal(false)}
          onSubmit={(input) => postBall(input)}
        />
      )}

      {awaitingBatter && (() => {
        const recentOut = [...(inn.batters ?? [])].reverse().find((b) => b.out);
        const dismissedLine = recentOut
          ? `Dismissed: ${recentOut.name}${recentOut.howOut ? ` (${recentOut.howOut})` : ""}`
          : null;
        const slot = awaitingBatterSlot ?? "striker";
        return (
          <PlayerPromptModal
            title={`New batter (replacing dismissed ${slot})`}
            subtitle={`${battingTeamName(match, inn)}${dismissedLine ? ` — ${dismissedLine}` : " — pick from roster"}`}
          >
            <PlayerPicker
              players={batRoster}
              excluded={Array.from(outOrInNames)}
              onPick={(name) =>
                patchPlayers(
                  slot === "striker" ? { striker: name } : { nonStriker: name }
                )
              }
              emptyMessage="No batters left"
            />
          </PlayerPromptModal>
        );
      })()}

      {!awaitingBatter && awaitingBowler && (
        <PlayerPromptModal
          title="Who's bowling next?"
          subtitle={suggestedBowler ? `Suggested: ${suggestedBowler}` : "Pick from bowling team"}
        >
          <PlayerPicker
            players={bowlRoster}
            excluded={lastOverBowler ? [lastOverBowler] : []}
            onPick={(name) => patchPlayers({ bowler: name })}
            emptyMessage="No bowlers available"
          />
        </PlayerPromptModal>
      )}

      {toast && <Toast text={toast} />}
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </div>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div
      className="fixed bottom-44 left-1/2 -translate-x-1/2 z-50"
      style={{
        backgroundColor: "var(--text-primary)",
        color: "var(--text-white)",
        borderRadius: 100,
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 500,
        boxShadow: "var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.15))",
      }}
    >
      {text}
    </div>
  );
}

function GhostBtn({
  disabled,
  onClick,
  children,
  title,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="active:scale-[0.98] transition-transform"
      style={{
        height: 42,
        borderRadius: 10,
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        color: disabled ? "var(--text-muted)" : "var(--text-primary)",
        fontSize: 13,
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function BatterCard({
  label,
  name,
  stats,
  isStriker,
  pending,
}: {
  label: string;
  name?: string;
  stats?: { runs: number; ballsFaced: number };
  isStriker?: boolean;
  pending?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 16px",
      }}
      className="flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {pending ? (
            <span
              style={{
                fontSize: 14,
                color: "var(--primary)",
                fontWeight: 600,
              }}
            >
              Pick new batter
            </span>
          ) : (
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
              className="truncate"
            >
              {name ?? "—"}
            </span>
          )}
          {isStriker && !pending && (
            <span
              className="inline-block rounded-full"
              style={{
                width: 8,
                height: 8,
                backgroundColor: "var(--primary)",
              }}
              aria-label="on strike"
            />
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginTop: 2,
          }}
        >
          {label}
        </div>
      </div>
      {stats && !pending && (
        <div className="text-right shrink-0">
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {stats.runs}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginLeft: 6,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ({stats.ballsFaced})
          </span>
        </div>
      )}
    </div>
  );
}

function BowlerCard({
  name,
  stats,
  pending,
}: {
  name?: string;
  stats?: { ballsBowled: number; runsConceded: number; wickets: number };
  pending?: boolean;
}) {
  const overs = stats
    ? `${Math.floor(stats.ballsBowled / 6)}.${stats.ballsBowled % 6}`
    : "0.0";
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 16px",
      }}
      className="flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        {pending ? (
          <span
            style={{
              fontSize: 14,
              color: "var(--primary)",
              fontWeight: 600,
            }}
          >
            Pick next bowler
          </span>
        ) : (
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
            className="truncate block"
          >
            {name ?? "—"}
          </span>
        )}
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginTop: 2,
          }}
        >
          Bowler
        </div>
      </div>
      {stats && !pending && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-secondary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {overs} · {stats.runsConceded} · {stats.wickets}
        </div>
      )}
    </div>
  );
}

function InningsBreak({
  match,
  onContinue,
  id,
}: {
  match: Match;
  onContinue: (m: Match) => void;
  id: string;
}) {
  const first = match.innings[0]!;
  const battedA = first.battingTeam === "A";
  const newBatTeam = battedA ? match.teamB : match.teamA;
  const battingRosterList = battedA ? match.playersB : match.playersA;
  const bowlingRosterList = battedA ? match.playersA : match.playersB;
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = striker && nonStriker && bowler && striker !== nonStriker;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/match/${id}/innings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ striker, nonStriker, bowler }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onContinue(data.match ?? data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  };

  return (
    <main
      className="flex-1 flex flex-col px-5 pt-6 pb-8 gap-4"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Innings Break
      </div>
      <div
        className="text-center py-6 px-4"
        style={{
          backgroundColor: "var(--primary-dark)",
          color: "var(--text-white)",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.8)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {battedA ? match.teamA : match.teamB}
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            marginTop: 4,
          }}
        >
          {first.runs}/{first.wickets}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.8)",
            marginTop: 4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {`${Math.floor(first.ballsBowled / 6)}.${first.ballsBowled % 6}`} ov · CRR{" "}
          {(first.ballsBowled ? (first.runs / first.ballsBowled) * 6 : 0).toFixed(2)}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginTop: 12,
          }}
        >
          Target {first.runs + 1}
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3 flex-1">
        <div
          style={{ fontSize: 14, color: "var(--text-secondary)" }}
        >
          {newBatTeam} need {first.runs + 1} to win
        </div>
        <BreakSelect label="Striker" value={striker} onChange={setStriker} options={battingRosterList.filter((p) => p !== nonStriker)} />
        <BreakSelect label="Non-striker" value={nonStriker} onChange={setNonStriker} options={battingRosterList.filter((p) => p !== striker)} />
        <BreakSelect label="Opening bowler" value={bowler} onChange={setBowler} options={bowlingRosterList} />
        {err && (
          <div style={{ color: "var(--wicket-red)", fontSize: 13 }}>{err}</div>
        )}
        <div className="flex-1" />
        <button
          type="submit"
          disabled={!valid || busy}
          className="active:scale-[0.98] transition-transform"
          style={{
            height: 50,
            borderRadius: 12,
            backgroundColor: !valid || busy ? "var(--surface-elevated)" : "var(--primary)",
            color: !valid || busy ? "var(--text-muted)" : "var(--text-white)",
            fontSize: 15,
            fontWeight: 600,
            opacity: !valid || busy ? 0.7 : 1,
          }}
        >
          {busy ? "Starting…" : "Start innings 2"}
        </button>
      </form>
    </main>
  );
}

function BreakSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 48,
          padding: "0 14px",
          borderRadius: 10,
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          fontSize: 15,
        }}
      >
        <option value="">Pick {label.toLowerCase()}</option>
        {options.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}
