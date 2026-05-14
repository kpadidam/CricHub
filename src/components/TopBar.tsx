"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function TopBar({
  title,
  right,
  onBack,
  backHref,
}: {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
  backHref?: string;
}) {
  const router = useRouter();
  const handleBack = () => {
    if (onBack) return onBack();
    if (backHref) return router.push(backHref);
    router.back();
  };
  return (
    <header className="sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="flex items-center justify-between h-14 px-3">
        <button
          onClick={handleBack}
          aria-label="Back"
          className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--text-secondary)] active:scale-95 transition-transform"
        >
          <ChevronLeft size={22} />
        </button>
        <h1
          className="text-[12px] font-medium uppercase text-[var(--text-secondary)] truncate"
          style={{ letterSpacing: "0.18em" }}
        >
          {title}
        </h1>
        <div className="min-w-11 h-11 flex items-center justify-end pr-1">
          {right ?? <span className="w-9" />}
        </div>
      </div>
    </header>
  );
}

export function StepDots({ count, current }: { count: number; current: number }) {
  return (
    <div className="flex justify-center gap-1.5 py-3">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === current
              ? "w-7 bg-[var(--primary)]"
              : i < current
              ? "w-5 bg-[var(--primary-light)]"
              : "w-5 bg-[var(--border)]"
          }`}
        />
      ))}
    </div>
  );
}

export function StepCounter({ current, total }: { current: number; total: number }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span
      className="font-mono text-[11px] text-[var(--text-muted)] tabular"
      style={{ letterSpacing: "0.18em" }}
    >
      {pad(current)}/{pad(total)}
    </span>
  );
}

export function LiveDot({ label = "LIVE" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--live-red)]"
      style={{ letterSpacing: "0.22em" }}
    >
      <span className="w-2 h-2 rounded-full bg-[var(--live-red)] pulse-dot" />
      {label}
    </span>
  );
}

export function CricHubMark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="text-lg font-bold leading-none text-[var(--text-primary)]"
      style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
    >
      Local Cricket <span className="text-[var(--primary)]">Live</span>
    </Link>
  );
}
