"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, X, Coins } from "lucide-react";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { MatchFormat, MatchRules } from "@/lib/types";

const STEPS = ["match", "teams", "playersA", "playersB", "toss", "rules", "openers"] as const;
type Step = (typeof STEPS)[number];

const FORMATS: { id: Exclude<MatchFormat, "custom">; label: string; overs: number }[] = [
  { id: "T5", label: "T5", overs: 5 },
  { id: "T10", label: "T10", overs: 10 },
  { id: "T20", label: "T20", overs: 20 },
  { id: "ODI", label: "ODI", overs: 50 },
];

export default function NewMatchPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("match");

  const [venue, setVenue] = useState("");
  const [matchFormat, setMatchFormat] = useState<MatchFormat>("T20");
  const [overs, setOvers] = useState(20);

  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [playersA, setPlayersA] = useState<string[]>([""]);
  const [playersB, setPlayersB] = useState<string[]>([""]);

  const [tossWinner, setTossWinner] = useState<"A" | "B">("A");
  const [elected, setElected] = useState<"bat" | "bowl">("bat");

  const [wideRuns, setWideRuns] = useState<1 | 2>(1);
  const [noBallRuns, setNoBallRuns] = useState<1 | 2>(1);
  const [maxOversPerBowler, setMaxOversPerBowler] = useState(Math.ceil(20 / 5));
  const [powerplayOvers, setPowerplayOvers] = useState(Math.round(20 * 0.3));

  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanA = playersA.map((s) => s.trim()).filter(Boolean);
  const cleanB = playersB.map((s) => s.trim()).filter(Boolean);

  const battingSide: "A" | "B" =
    (tossWinner === "A" && elected === "bat") ||
    (tossWinner === "B" && elected === "bowl")
      ? "A"
      : "B";
  const battingRoster = battingSide === "A" ? cleanA : cleanB;
  const bowlingRoster = battingSide === "A" ? cleanB : cleanA;
  const battingName = battingSide === "A" ? teamA.trim() || "Team A" : teamB.trim() || "Team B";
  const bowlingName = battingSide === "A" ? teamB.trim() || "Team B" : teamA.trim() || "Team A";

  const matchValid = overs >= 1 && overs <= 50;
  const teamsValid = teamA.trim().length > 0 && teamB.trim().length > 0;
  const playersAValid = cleanA.length >= 2;
  const playersBValid = cleanB.length >= 2;
  const rulesValid =
    overs >= 1 && overs <= 50 &&
    maxOversPerBowler >= 1 && maxOversPerBowler <= overs &&
    powerplayOvers >= 1 && powerplayOvers <= overs;
  const openersValid =
    striker.length > 0 &&
    nonStriker.length > 0 &&
    bowler.length > 0 &&
    striker !== nonStriker &&
    battingRoster.includes(striker) &&
    battingRoster.includes(nonStriker) &&
    bowlingRoster.includes(bowler);

  const setFormat = (id: MatchFormat) => {
    setMatchFormat(id);
    if (id !== "custom") {
      const f = FORMATS.find((x) => x.id === id)!;
      setOvers(f.overs);
      setMaxOversPerBowler(Math.max(1, Math.ceil(f.overs / 5)));
      setPowerplayOvers(Math.max(1, Math.round(f.overs * 0.3)));
    }
  };

  async function startMatch() {
    if (!openersValid || submitting) return;
    setSubmitting(true);
    setError(null);
    const rules: MatchRules = { wideRuns, noBallRuns, maxOversPerBowler, powerplayOvers };
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamA: teamA.trim(),
          teamB: teamB.trim(),
          oversLimit: overs,
          venue: venue.trim() || undefined,
          matchFormat,
          rules,
          toss: { winner: tossWinner, elected },
          playersA: cleanA,
          playersB: cleanB,
          openers: { striker, nonStriker, bowler },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      router.push(`/score/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create match");
      setSubmitting(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);
  const total = STEPS.length;

  const goBack = () => {
    if (stepIndex === 0) router.push("/");
    else setStep(STEPS[stepIndex - 1]);
  };
  const goNext = () => setStep(STEPS[stepIndex + 1]);

  const titles: Record<Step, string> = {
    match: "Create Match",
    teams: "Add Teams",
    playersA: "Playing XI",
    playersB: "Playing XI",
    toss: "Toss",
    rules: "Match Rules",
    openers: "Opening Setup",
  };

  return (
    <main
      className="flex-1 flex flex-col"
      style={{ backgroundColor: "var(--background)" }}
    >
      <header
        className="sticky top-0 z-30"
        style={{
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between h-14 px-3">
          <button
            onClick={goBack}
            aria-label="Back"
            className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronLeft size={22} />
          </button>
          <h1
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {titles[step]}
          </h1>
          <div
            className="pr-3"
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-muted)",
            }}
          >
            {stepIndex + 1}/{total}
          </div>
        </div>
        <Stepper count={total} current={stepIndex} />
      </header>

      <div className="flex-1 flex flex-col gap-5 px-5 pt-5 pb-6">
        {step === "match" && (
          <>
            <Hero>Create Match</Hero>
            <Field label="Venue (optional)">
              <TextInput
                value={venue}
                onChange={setVenue}
                placeholder="Eden Gardens, Kolkata"
                maxLength={60}
              />
            </Field>
            <Field label="Match format">
              <div className="grid grid-cols-2 gap-2">
                {FORMATS.map((f) => {
                  const active = matchFormat === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormat(f.id)}
                      className="flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-all"
                      style={{
                        height: 84,
                        borderRadius: 12,
                        padding: 16,
                        backgroundColor: active
                          ? "var(--surface-elevated)"
                          : "var(--surface)",
                        border: active
                          ? "2px solid var(--primary)"
                          : "1px solid var(--border)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: active
                            ? "var(--primary)"
                            : "var(--text-primary)",
                          lineHeight: 1,
                        }}
                      >
                        {f.label}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {f.overs} ov
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setFormat("custom")}
                  className="col-span-2 flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-all"
                  style={{
                    height: 84,
                    borderRadius: 12,
                    padding: 16,
                    backgroundColor:
                      matchFormat === "custom"
                        ? "var(--surface-elevated)"
                        : "var(--surface)",
                    border:
                      matchFormat === "custom"
                        ? "2px solid var(--primary)"
                        : "1px dashed var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color:
                        matchFormat === "custom"
                          ? "var(--primary)"
                          : "var(--text-primary)",
                    }}
                  >
                    Custom
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    Choose overs
                  </span>
                </button>
              </div>
            </Field>
            {matchFormat === "custom" && (
              <Field label="Overs per side">
                <NumberInput
                  value={overs}
                  onChange={(v) => setOvers(Math.max(1, Math.min(50, v)))}
                />
              </Field>
            )}
          </>
        )}

        {step === "teams" && (
          <>
            <Hero>Add Teams</Hero>
            <Field label="Team A">
              <TextInput
                value={teamA}
                onChange={setTeamA}
                placeholder="India"
                maxLength={24}
                autoFocus
              />
            </Field>
            <Field label="Team B">
              <TextInput
                value={teamB}
                onChange={setTeamB}
                placeholder="Australia"
                maxLength={24}
              />
            </Field>
          </>
        )}

        {step === "playersA" && (
          <PlayingXI
            heading="Playing XI"
            teamName={teamA.trim() || "Team A"}
            players={playersA}
            setPlayers={setPlayersA}
          />
        )}

        {step === "playersB" && (
          <PlayingXI
            heading="Playing XI"
            teamName={teamB.trim() || "Team B"}
            players={playersB}
            setPlayers={setPlayersB}
          />
        )}

        {step === "toss" && (
          <>
            <Hero>Toss</Hero>
            <div className="flex justify-center py-2">
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: 72,
                  height: 72,
                  backgroundColor: "var(--surface-elevated)",
                }}
              >
                <Coins size={40} color="var(--primary)" />
              </div>
            </div>
            <Field label="Toss winner">
              <SegmentedControl
                value={tossWinner}
                onChange={(v) => {
                  setTossWinner(v);
                  setStriker(""); setNonStriker(""); setBowler("");
                }}
                options={[
                  { value: "A", label: teamA.trim() || "Team A" },
                  { value: "B", label: teamB.trim() || "Team B" },
                ]}
              />
            </Field>
            <Field label="Elected to">
              <SegmentedControl
                value={elected}
                onChange={(v) => {
                  setElected(v);
                  setStriker(""); setNonStriker(""); setBowler("");
                }}
                options={[
                  { value: "bat", label: "Bat" },
                  { value: "bowl", label: "Bowl" },
                ]}
              />
            </Field>
            <div
              className="text-center"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 16,
                fontSize: 14,
                color: "var(--text-secondary)",
              }}
            >
              <span style={{ color: "var(--primary)", fontWeight: 700 }}>
                {battingName}
              </span>{" "}
              bat first ·{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {bowlingName}
              </span>{" "}
              bowl
            </div>
          </>
        )}

        {step === "rules" && (
          <>
            <Hero>Match Rules</Hero>
            <div
              style={{
                backgroundColor: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Format
              </span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {matchFormat === "custom" ? "Custom" : matchFormat} · {overs} overs
              </span>
            </div>
            <Field label="Wide runs">
              <SegmentedControl
                value={String(wideRuns) as "1" | "2"}
                onChange={(v) => setWideRuns(Number(v) as 1 | 2)}
                options={[
                  { value: "1", label: "1 run" },
                  { value: "2", label: "2 runs" },
                ]}
              />
            </Field>
            <Field label="No-ball runs">
              <SegmentedControl
                value={String(noBallRuns) as "1" | "2"}
                onChange={(v) => setNoBallRuns(Number(v) as 1 | 2)}
                options={[
                  { value: "1", label: "1 run" },
                  { value: "2", label: "2 runs" },
                ]}
              />
            </Field>
            <Field label="Max overs per bowler">
              <NumberInput
                value={maxOversPerBowler}
                onChange={(v) =>
                  setMaxOversPerBowler(Math.max(1, Math.min(overs, v)))
                }
              />
            </Field>
            <Field label="Powerplay overs">
              <NumberInput
                value={powerplayOvers}
                onChange={(v) =>
                  setPowerplayOvers(Math.max(1, Math.min(overs, v)))
                }
              />
            </Field>
          </>
        )}

        {step === "openers" && (
          <>
            <Hero>Opening Setup</Hero>
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
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Batting
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginTop: 4,
                }}
              >
                {battingName}
              </div>
            </div>
            <PickerField
              label="Striker"
              value={striker}
              options={battingRoster.filter((p) => p !== nonStriker)}
              onPick={setStriker}
            />
            <PickerField
              label="Non-striker"
              value={nonStriker}
              options={battingRoster.filter((p) => p !== striker)}
              onPick={setNonStriker}
            />
            <PickerField
              label="Opening bowler"
              value={bowler}
              options={bowlingRoster}
              onPick={setBowler}
            />
          </>
        )}

        {error && (
          <div
            style={{
              backgroundColor: "var(--wicket-red-light)",
              border: "1px solid var(--wicket-red)",
              borderRadius: 8,
              padding: 12,
              fontSize: 13,
              color: "var(--wicket-red)",
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div className="px-5 pb-6 pt-2">
        {step === "match" && <NextBtn disabled={!matchValid} onClick={goNext} label="Next: Teams" />}
        {step === "teams" && <NextBtn disabled={!teamsValid} onClick={goNext} label="Next: Team A XI" />}
        {step === "playersA" && (
          <NextBtn
            disabled={!playersAValid}
            onClick={goNext}
            label={`Next: ${teamB.trim() || "Team B"} XI`}
            hint={
              playersAValid
                ? cleanA.length < 11
                  ? `Playing with ${cleanA.length}. You can add more or start now.`
                  : `${cleanA.length} / 11 players`
                : "Add at least 2 players"
            }
          />
        )}
        {step === "playersB" && (
          <NextBtn
            disabled={!playersBValid}
            onClick={goNext}
            label="Next: Toss"
            hint={
              playersBValid
                ? cleanB.length < 11
                  ? `Playing with ${cleanB.length}. You can add more or start now.`
                  : `${cleanB.length} / 11 players`
                : "Add at least 2 players"
            }
          />
        )}
        {step === "toss" && <NextBtn disabled={!teamsValid} onClick={goNext} label="Next: Rules" />}
        {step === "rules" && <NextBtn disabled={!rulesValid} onClick={goNext} label="Next: Openers" />}
        {step === "openers" && (
          <NextBtn
            disabled={!openersValid || submitting}
            onClick={startMatch}
            label={submitting ? "Starting…" : "Start match"}
          />
        )}
      </div>
    </main>
  );
}

function Stepper({ count, current }: { count: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-3 px-5">
      {Array.from({ length: count }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="rounded-full"
              style={{
                width: active ? 22 : 8,
                height: 8,
                backgroundColor:
                  done || active ? "var(--primary)" : "var(--border)",
                boxShadow: active
                  ? "0 0 0 3px var(--primary-light)33"
                  : undefined,
                transition: "all 150ms ease",
              }}
            />
            {i < count - 1 && (
              <span
                style={{
                  width: 8,
                  height: 2,
                  backgroundColor: done ? "var(--primary)" : "var(--border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Hero({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 22,
        fontWeight: 700,
        color: "var(--text-primary)",
        marginBottom: 4,
      }}
    >
      {children}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
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
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "14px 16px",
  fontSize: 15,
  color: "var(--text-primary)",
  width: "100%",
  outline: "none",
};

function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus={autoFocus}
      style={inputStyle}
      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    />
  );
}

function NumberInput({
  value,
  onChange,
  min = 1,
  max = 50,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 4,
      }}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        aria-label="Decrease"
        style={stepBtnStyle}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        style={{
          flex: 1,
          textAlign: "center",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--text-primary)",
          background: "transparent",
          border: "none",
          outline: "none",
          fontVariantNumeric: "tabular-nums",
          minWidth: 0,
        }}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        aria-label="Increase"
        style={stepBtnStyle}
      >
        +
      </button>
    </div>
  );
}

const stepBtnStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 8,
  backgroundColor: "var(--surface-elevated)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
  fontSize: 22,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

function NextBtn({
  disabled,
  onClick,
  label,
  hint,
}: {
  disabled?: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <>
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full active:scale-[0.98] transition-all"
        style={{
          backgroundColor: disabled ? "var(--surface-elevated)" : "var(--primary)",
          color: disabled ? "var(--text-muted)" : "var(--text-white)",
          padding: "14px 24px",
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          height: 50,
          opacity: disabled ? 0.7 : 1,
        }}
      >
        {label}
      </button>
      {hint && (
        <div
          className="text-center mt-2"
          style={{ fontSize: 12, color: "var(--text-secondary)" }}
        >
          {hint}
        </div>
      )}
    </>
  );
}

function PlayingXI({
  heading,
  teamName,
  players,
  setPlayers,
}: {
  heading: string;
  teamName: string;
  players: string[];
  setPlayers: (p: string[]) => void;
}) {
  const updateAt = (i: number, v: string) => {
    const next = [...players];
    next[i] = v;
    setPlayers(next);
  };
  const removeAt = (i: number) => {
    const next = players.filter((_, idx) => idx !== i);
    setPlayers(next.length === 0 ? [""] : next);
  };
  const add = () => {
    if (players.length >= 11) return;
    setPlayers([...players, ""]);
  };
  const filled = players.filter((s) => s.trim()).length;

  return (
    <div className="flex flex-col gap-3">
      <Hero>{heading}</Hero>
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
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Team
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginTop: 4,
          }}
        >
          {teamName}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginTop: 6,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {filled} / 11 players
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-7 text-center"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <input
              value={p}
              onChange={(e) => updateAt(i, e.target.value)}
              placeholder={`Player ${i + 1}`}
              maxLength={24}
              autoFocus={i === players.length - 1 && p === ""}
              style={{ ...inputStyle, padding: "10px 14px", fontSize: 14 }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remove player"
              className="w-11 h-11 rounded-lg flex items-center justify-center active:scale-95 transition-transform"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                backgroundColor: "var(--surface)",
              }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        disabled={players.length >= 11}
        className="flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        style={{
          height: 46,
          borderRadius: 10,
          border: "1px dashed var(--border)",
          color: "var(--text-secondary)",
          fontSize: 14,
          fontWeight: 500,
          backgroundColor: "var(--surface)",
          opacity: players.length >= 11 ? 0.4 : 1,
        }}
      >
        <Plus size={16} /> Add player {players.length >= 11 ? "(max 11)" : ""}
      </button>
    </div>
  );
}

function PickerField({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string;
  options: string[];
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
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
      {options.length === 0 ? (
        <div
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          No players in the roster — go back and add players.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((p) => {
            const active = p === value;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPick(p)}
                className="active:scale-[0.98] transition-transform"
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: 100,
                  border: active
                    ? "1px solid var(--primary)"
                    : "1px solid var(--border)",
                  backgroundColor: active
                    ? "var(--primary)"
                    : "var(--surface)",
                  color: active ? "var(--text-white)" : "var(--text-primary)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
