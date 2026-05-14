"use client";

export function PlayerPicker({
  players,
  excluded = [],
  dimmed = [],
  onPick,
  emptyMessage = "No players available",
}: {
  players: string[];
  excluded?: string[];
  dimmed?: string[];
  onPick: (name: string) => void;
  emptyMessage?: string;
}) {
  const excl = new Set(excluded);
  const dim = new Set(dimmed);
  const available = players.filter((p) => !excl.has(p));

  if (available.length === 0) {
    return (
      <div
        className="border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-[var(--text-secondary)] text-sm"
        style={{ borderRadius: "var(--radius-lg)" }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto -mx-1 px-1">
      {available.map((name) => {
        const isDim = dim.has(name);
        return (
          <button
            key={name}
            onClick={() => onPick(name)}
            className={`min-h-[44px] border border-[var(--border)] bg-[var(--surface)] text-left text-[15px] text-[var(--text-primary)] font-medium active:scale-[0.98] transition-transform ${
              isDim ? "opacity-50" : ""
            }`}
            style={{
              borderRadius: "var(--radius-lg)",
              padding: "12px 16px",
            }}
          >
            {name}
            {isDim && (
              <span className="text-xs text-[var(--text-muted)] ml-2">(last over)</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
