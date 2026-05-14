"use client";

import { ReactNode } from "react";

export function PlayerPromptModal({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-sm bg-[var(--surface)] border-t sm:border border-[var(--border)] p-5 flex flex-col gap-4 fade-in"
        style={{
          borderTopLeftRadius: "var(--radius-xl)",
          borderTopRightRadius: "var(--radius-xl)",
          paddingTop: 16,
        }}
      >
        <div className="flex justify-center -mt-1">
          <span
            className="block rounded-full"
            style={{
              width: 40,
              height: 4,
              background: "var(--text-muted)",
            }}
          />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{title}</h2>
          {subtitle && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
