"use client";

export type TabDef<T extends string> = {
  id: T;
  label: string;
};

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="sticky top-14 z-20 -mx-5 px-5 bg-[var(--background)] border-b border-[var(--border)]">
      <div role="tablist" className="flex gap-1 overflow-x-auto py-2">
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={`min-h-[40px] px-4 whitespace-nowrap transition-colors ${
                active
                  ? "bg-[var(--primary)] text-white text-sm font-semibold"
                  : "bg-transparent text-[var(--text-muted)] text-sm font-medium"
              }`}
              style={{ borderRadius: "var(--radius-md)" }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
