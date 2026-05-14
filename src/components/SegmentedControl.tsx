"use client";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="grid grid-flow-col auto-cols-fr gap-1 bg-[var(--surface-elevated)]"
      style={{ padding: 2, borderRadius: "var(--radius-pill)" }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`min-h-[40px] text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text-secondary)]"
            }`}
            style={{ borderRadius: "var(--radius-pill)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
