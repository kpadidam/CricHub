"use client";

import { ActionButton } from "@/components/ActionButton";

export function ExtrasPanel({
  label,
  onSend,
  onCancel,
}: {
  label: string;
  onSend: (runs: number) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="border border-[var(--extras-orange)] bg-[var(--extras-orange-light)] p-3 mb-2 fade-in"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider font-semibold text-[var(--extras-orange)]">
          {label} · runs taken
        </span>
        <button
          onClick={onCancel}
          className="text-xs text-[var(--text-secondary)] underline"
          aria-label="Cancel"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((r) => (
          <ActionButton
            key={r}
            variant="extra"
            onClick={() => onSend(r)}
            className="h-12"
          >
            {r}
          </ActionButton>
        ))}
      </div>
    </div>
  );
}
