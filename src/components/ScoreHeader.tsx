"use client";

import { RotateCcw } from "lucide-react";
import { LiveBadge } from "./LiveBadge";
import type { Innings, Match } from "@/lib/types";

function formatOvers(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}
function runRate(runs: number, balls: number) {
  if (!balls) return "0.00";
  return ((runs / balls) * 6).toFixed(2);
}

export function ScoreHeader({
  match,
  innings,
  showLive = true,
  onUndo,
  undoDisabled,
}: {
  match: Match;
  innings: Innings;
  showLive?: boolean;
  onUndo?: () => void;
  undoDisabled?: boolean;
}) {
  const teamName =
    innings.battingTeam === "A" ? match.teamA : match.teamB;
  const isSecond = match.innings.length === 2;
  const firstInn = match.innings[0]!;
  const target = isSecond ? firstInn.runs + 1 : undefined;
  const need = target !== undefined ? Math.max(0, target - innings.runs) : undefined;
  const ballsLeft = match.oversLimit * 6 - innings.ballsBowled;
  const crr = runRate(innings.runs, innings.ballsBowled);
  const rrr =
    target !== undefined && ballsLeft > 0 && need !== undefined && need > 0
      ? ((need / ballsLeft) * 6).toFixed(2)
      : null;

  return (
    <header
      className="sticky top-0 z-30 w-full px-5 py-4 text-white"
      style={{ backgroundColor: "var(--primary-dark)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div
            className="text-[13px] font-medium truncate"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            {teamName}
          </div>
          <div
            className="font-bold tabular-nums mt-1"
            style={{ fontSize: 28, lineHeight: 1.1 }}
          >
            {innings.runs}/{innings.wickets}
            <span
              className="ml-2 font-medium tabular-nums"
              style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}
            >
              ({formatOvers(innings.ballsBowled)} ov)
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          {showLive && <LiveBadge />}
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={undoDisabled}
              aria-label="Undo"
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                color: "white",
              }}
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>
      {isSecond && need !== undefined && (
        <div className="mt-2">
          <div className="text-[13px] font-semibold">
            Need {need} from {ballsLeft} balls
          </div>
          <div
            className="text-[11px] font-medium tabular-nums"
            style={{ color: "rgba(255,255,255,0.67)" }}
          >
            CRR {crr}
            {rrr ? ` | RRR ${rrr}` : ""}
          </div>
        </div>
      )}
      {!isSecond && (
        <div
          className="text-[11px] font-medium tabular-nums mt-1"
          style={{ color: "rgba(255,255,255,0.67)" }}
        >
          CRR {crr}
        </div>
      )}
    </header>
  );
}
