"use client";

import { useState } from "react";
import { PlayerPicker } from "@/components/PlayerPicker";
import type { BallInput, WicketType } from "@/lib/types";

type DismissalChoice = {
  type: WicketType;
  label: string;
  needsFielder: boolean;
  needsRunOutEnd: boolean;
  needsRunsCompleted: boolean;
  autoSubmit: boolean;
};

const CHOICES: DismissalChoice[] = [
  { type: "bowled", label: "Bowled", needsFielder: false, needsRunOutEnd: false, needsRunsCompleted: false, autoSubmit: true },
  { type: "caught", label: "Caught", needsFielder: true, needsRunOutEnd: false, needsRunsCompleted: false, autoSubmit: false },
  { type: "caught-and-bowled", label: "Caught & Bowled", needsFielder: false, needsRunOutEnd: false, needsRunsCompleted: false, autoSubmit: true },
  { type: "lbw", label: "LBW", needsFielder: false, needsRunOutEnd: false, needsRunsCompleted: false, autoSubmit: true },
  { type: "run-out", label: "Run out", needsFielder: true, needsRunOutEnd: true, needsRunsCompleted: true, autoSubmit: false },
  { type: "stumped", label: "Stumped", needsFielder: true, needsRunOutEnd: false, needsRunsCompleted: false, autoSubmit: false },
  { type: "hit-wicket", label: "Hit wicket", needsFielder: false, needsRunOutEnd: false, needsRunsCompleted: false, autoSubmit: true },
  { type: "retired-hurt", label: "Retired hurt", needsFielder: false, needsRunOutEnd: false, needsRunsCompleted: false, autoSubmit: true },
  { type: "retired-out", label: "Retired out", needsFielder: false, needsRunOutEnd: false, needsRunsCompleted: false, autoSubmit: true },
];

export function WicketModal({
  bowlingRoster,
  bowlerName,
  onCancel,
  onSubmit,
}: {
  bowlingRoster: string[];
  bowlerName?: string;
  onCancel: () => void;
  onSubmit: (input: BallInput) => void | Promise<void>;
}) {
  const [choice, setChoice] = useState<DismissalChoice | null>(null);
  const [fielder, setFielder] = useState<string | undefined>();
  const [runOutEnd, setRunOutEnd] = useState<"striker" | "non-striker">("striker");
  const [runsCompleted, setRunsCompleted] = useState<number>(0);

  const send = (c: DismissalChoice, f?: string) => {
    const input: BallInput = {
      runs: c.needsRunsCompleted ? runsCompleted : 0,
      wicket: true,
      wicketType: c.type,
    };
    if (c.needsFielder && f) input.fielder = f;
    if (c.needsRunOutEnd) input.runOutEnd = runOutEnd;
    onSubmit(input);
  };

  const pickChoice = (c: DismissalChoice) => {
    if (c.autoSubmit) {
      send(c);
      return;
    }
    setChoice(c);
  };

  const fielderRoster = bowlerName
    ? bowlingRoster.filter((p) => p !== bowlerName)
    : bowlingRoster;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-md bg-[var(--surface)] border-t sm:border border-[var(--border)] p-5 flex flex-col gap-4 fade-in"
        style={{
          borderTopLeftRadius: "var(--radius-xl)",
          borderTopRightRadius: "var(--radius-xl)",
        }}
      >
        <div className="flex justify-center -mt-1">
          <span
            className="block rounded-full"
            style={{ width: 40, height: 4, background: "var(--text-muted)" }}
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-[var(--text-primary)]">
              {choice ? choice.label : "How was the batter out?"}
            </h2>
            {choice && (
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {choice.type === "run-out"
                  ? "Pick fielder, end & runs completed"
                  : choice.needsFielder
                  ? "Pick fielder"
                  : ""}
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="w-9 h-9 rounded-full border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!choice && (
          <div className="grid grid-cols-2 gap-2">
            {CHOICES.map((c) => (
              <button
                key={c.type}
                onClick={() => pickChoice(c)}
                className="min-h-[56px] border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] px-3 py-2 text-sm font-semibold text-left active:scale-[0.98] transition-transform"
                style={{ borderRadius: "var(--radius-lg)" }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {choice && choice.needsRunOutEnd && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-2 px-1">
              Which end?
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["striker", "non-striker"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setRunOutEnd(e)}
                  className={`min-h-[44px] border px-3 py-2 text-sm font-semibold ${
                    runOutEnd === e
                      ? "border-[var(--wicket-red)] bg-[var(--wicket-red-light)] text-[var(--wicket-red)]"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                  }`}
                  style={{ borderRadius: "var(--radius-lg)" }}
                >
                  {e === "striker" ? "Striker" : "Non-striker"}
                </button>
              ))}
            </div>
          </div>
        )}

        {choice && choice.needsRunsCompleted && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-2 px-1">
              Runs completed
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4].map((r) => (
                <button
                  key={r}
                  onClick={() => setRunsCompleted(r)}
                  className={`min-h-[44px] border tabular text-base font-semibold ${
                    runsCompleted === r
                      ? "border-[var(--extras-orange)] bg-[var(--extras-orange-light)] text-[var(--extras-orange)]"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                  }`}
                  style={{ borderRadius: "var(--radius-lg)" }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {choice && choice.needsFielder && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-2 px-1">
              Fielder
            </div>
            <PlayerPicker
              players={fielderRoster}
              onPick={(name) => {
                setFielder(name);
                send(choice, name);
              }}
              emptyMessage="No fielders available"
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {choice && (
            <button
              onClick={() => setChoice(null)}
              className="flex-1 min-h-[44px] border border-[var(--border)] bg-[var(--surface-elevated)] text-sm font-semibold text-[var(--text-primary)]"
              style={{ borderRadius: "var(--radius-lg)" }}
            >
              Back
            </button>
          )}
          <button
            onClick={onCancel}
            className="flex-1 min-h-[44px] border border-[var(--border)] bg-[var(--surface-elevated)] text-sm font-semibold text-[var(--text-secondary)]"
            style={{ borderRadius: "var(--radius-lg)" }}
          >
            Cancel
          </button>
        </div>

        {/* keep fielder state referenced for lint */}
        <span className="hidden">{fielder}</span>
      </div>
    </div>
  );
}
