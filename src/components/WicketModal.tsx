"use client";

import { useMemo, useState } from "react";
import { PlayerPicker } from "@/components/PlayerPicker";
import type { BallInput, Extra, WicketType } from "@/lib/types";

type DeliveryKind = "legal" | "wd" | "nb" | "b" | "lb";

const DELIVERY_CHIPS: { id: DeliveryKind; label: string }[] = [
  { id: "legal", label: "Legal" },
  { id: "wd", label: "Wide" },
  { id: "nb", label: "No-ball" },
  { id: "b", label: "Bye" },
  { id: "lb", label: "Leg-bye" },
];

type WicketChoice = {
  type: WicketType;
  label: string;
  needsFielder: boolean;
};

const ALL_DISMISSALS: WicketChoice[] = [
  { type: "bowled", label: "Bowled", needsFielder: false },
  { type: "caught", label: "Caught", needsFielder: true },
  { type: "caught-and-bowled", label: "Caught & Bowled", needsFielder: false },
  { type: "lbw", label: "LBW", needsFielder: false },
  { type: "run-out", label: "Run out", needsFielder: true },
  { type: "stumped", label: "Stumped", needsFielder: true },
  { type: "hit-wicket", label: "Hit wicket", needsFielder: false },
  { type: "retired-hurt", label: "Retired hurt", needsFielder: false },
  { type: "retired-out", label: "Retired out", needsFielder: false },
  // The two new entries — typed loosely against current types.ts because
  // backend agent is extending WicketType in a parallel PR.
  { type: "obstructing-field" as WicketType, label: "Obstructing field", needsFielder: true },
  { type: "hit-ball-twice" as WicketType, label: "Hit ball twice", needsFielder: false },
];

function allowedDismissals(
  delivery: DeliveryKind,
  freeHitActive: boolean
): Set<WicketType> {
  // Free hit OR no-ball: only run-out / obstructing-field / hit-ball-twice.
  if (freeHitActive || delivery === "nb") {
    return new Set<WicketType>([
      "run-out",
      "obstructing-field" as WicketType,
      "hit-ball-twice" as WicketType,
    ]);
  }
  if (delivery === "wd") {
    return new Set<WicketType>([
      "run-out",
      "stumped",
      "obstructing-field" as WicketType,
      "hit-wicket",
    ]);
  }
  if (delivery === "b" || delivery === "lb") {
    return new Set<WicketType>([
      "run-out",
      "obstructing-field" as WicketType,
      "hit-ball-twice" as WicketType,
    ]);
  }
  // legal
  return new Set<WicketType>(ALL_DISMISSALS.map((d) => d.type));
}

function disabledNote(delivery: DeliveryKind, freeHitActive: boolean): string {
  if (freeHitActive) return "FREE HIT — only run-out / obstructing / hit-ball-twice";
  if (delivery === "nb") return "On a no-ball, only run-out / obstructing / hit-ball-twice are valid";
  if (delivery === "wd") return "On a wide, only run-out / stumped / obstructing / hit-wicket are valid";
  if (delivery === "b" || delivery === "lb") return "On byes/leg-byes, only run-out / obstructing / hit-ball-twice are valid";
  return "";
}

export function WicketModal({
  bowlingRoster,
  bowlerName,
  armedExtra,
  freeHitActive = false,
  strikerName,
  nonStrikerName,
  onCancel,
  onSubmit,
}: {
  bowlingRoster: string[];
  bowlerName?: string;
  armedExtra?: Extra;
  freeHitActive?: boolean;
  strikerName?: string;
  nonStrikerName?: string;
  onCancel: () => void;
  onSubmit: (input: BallInput) => void | Promise<void>;
}) {
  const initialDelivery: DeliveryKind = armedExtra ?? "legal";
  const [delivery, setDelivery] = useState<DeliveryKind>(initialDelivery);
  const [wicketType, setWicketType] = useState<WicketType | null>(null);
  const [runs, setRuns] = useState<number>(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [fielder, setFielder] = useState<string | null>(null);

  const allowed = useMemo(() => allowedDismissals(delivery, freeHitActive), [delivery, freeHitActive]);
  const note = disabledNote(delivery, freeHitActive);

  // If the user changes delivery to one that disallows the current pick, reset it.
  const onChangeDelivery = (d: DeliveryKind) => {
    setDelivery(d);
    const next = allowedDismissals(d, freeHitActive);
    if (wicketType && !next.has(wicketType)) {
      setWicketType(null);
      setFielder(null);
      setDismissed(null);
    }
  };

  const choice = wicketType ? ALL_DISMISSALS.find((c) => c.type === wicketType) ?? null : null;
  const needsFielder = choice?.needsFielder ?? false;
  const isRunOut = wicketType === "run-out";

  const runsLabel = delivery === "nb" ? "Bat runs" : delivery === "legal" ? "Runs taken" : "Runs taken";

  const canSubmit = (() => {
    if (!wicketType) return false;
    if (isRunOut && !dismissed) return false;
    if (needsFielder && !fielder) return false;
    return true;
  })();

  const submit = () => {
    if (!canSubmit || !wicketType) return;
    const input: BallInput = {
      runs: 0,
      wicket: true,
      wicketType,
    };
    // Delivery type → extra
    if (delivery !== "legal") {
      input.extra = delivery as Extra;
    }
    // Runs assignment varies by delivery type
    if (delivery === "nb") {
      // Off-bat runs on a no-ball go to batRuns; team penalty is added engine-side.
      (input as BallInput & { batRuns?: number }).batRuns = runs;
      input.runs = 0;
    } else if (delivery === "wd" || delivery === "b" || delivery === "lb") {
      input.runs = runs;
    } else {
      // legal
      input.runs = runs;
    }
    if (isRunOut && dismissed) {
      input.dismissedPlayer = dismissed;
      // back-compat: also flag which end (if we can infer)
      if (dismissed === strikerName) input.runOutEnd = "striker";
      else if (dismissed === nonStrikerName) input.runOutEnd = "non-striker";
    } else if (strikerName) {
      // For all other dismissals the striker is dismissed.
      input.dismissedPlayer = strikerName;
    }
    if (needsFielder && fielder) input.fielder = fielder;
    onSubmit(input);
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
        className="w-full sm:max-w-md bg-[var(--surface)] border-t sm:border border-[var(--border)] p-5 flex flex-col gap-4 fade-in max-h-[92vh] overflow-y-auto"
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
              Wicket — build delivery
            </h2>
            {freeHitActive && (
              <p
                className="text-xs font-semibold mt-1"
                style={{ color: "var(--extras-orange)" }}
              >
                FREE HIT active
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

        {/* Step 1: Delivery type */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-2 px-1">
            Delivery type
          </div>
          <div className="flex flex-wrap gap-2">
            {DELIVERY_CHIPS.map((d) => (
              <button
                key={d.id}
                onClick={() => onChangeDelivery(d.id)}
                className={`min-h-[44px] px-3 text-sm font-semibold border ${
                  delivery === d.id
                    ? "border-[var(--extras-orange)] bg-[var(--extras-orange-light)] text-[var(--extras-orange)]"
                    : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                }`}
                style={{ borderRadius: "var(--radius-lg)" }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Dismissal type */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-2 px-1">
            Dismissal type
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_DISMISSALS.map((c) => {
              const enabled = allowed.has(c.type);
              const selected = wicketType === c.type;
              return (
                <button
                  key={c.type}
                  disabled={!enabled}
                  onClick={() => {
                    setWicketType(c.type);
                    setFielder(null);
                    if (c.type !== "run-out") setDismissed(null);
                  }}
                  className={`min-h-[44px] border px-3 py-2 text-sm font-semibold text-left ${
                    selected
                      ? "border-[var(--wicket-red)] bg-[var(--wicket-red-light)] text-[var(--wicket-red)]"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                  } ${!enabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  style={{ borderRadius: "var(--radius-lg)" }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {note && (
            <p className="text-[11px] mt-2 px-1 text-[var(--text-muted)]">{note}</p>
          )}
        </div>

        {/* Step 3: Runs */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-2 px-1">
            {runsLabel}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
              <button
                key={r}
                onClick={() => setRuns(r)}
                className={`min-h-[44px] border tabular text-base font-semibold ${
                  runs === r
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

        {/* Step 4: Dismissed batter (run-out) */}
        {isRunOut && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-2 px-1">
              Dismissed batter
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[strikerName, nonStrikerName].map((name, i) => (
                <button
                  key={i}
                  disabled={!name}
                  onClick={() => name && setDismissed(name)}
                  className={`min-h-[64px] border px-3 py-2 text-base font-semibold ${
                    dismissed === name
                      ? "border-[var(--wicket-red)] bg-[var(--wicket-red-light)] text-[var(--wicket-red)]"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                  } ${!name ? "opacity-40" : ""}`}
                  style={{ borderRadius: "var(--radius-lg)" }}
                >
                  {name ?? "—"}
                  <span className="block text-[10px] font-normal text-[var(--text-muted)] mt-1">
                    {i === 0 ? "Striker" : "Non-striker"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Fielder */}
        {needsFielder && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-2 px-1">
              Fielder
            </div>
            <PlayerPicker
              players={fielderRoster}
              onPick={(name) => setFielder(name)}
              emptyMessage="No fielders available"
            />
            {fielder && (
              <p className="text-[11px] mt-2 px-1 text-[var(--text-muted)]">
                Selected: {fielder}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 min-h-[44px] border border-[var(--border)] bg-[var(--surface-elevated)] text-sm font-semibold text-[var(--text-secondary)]"
            style={{ borderRadius: "var(--radius-lg)" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 min-h-[44px] text-sm font-semibold text-white disabled:opacity-40"
            style={{
              borderRadius: "var(--radius-lg)",
              backgroundColor: "var(--wicket-red)",
            }}
          >
            Confirm wicket
          </button>
        </div>
      </div>
    </div>
  );
}
