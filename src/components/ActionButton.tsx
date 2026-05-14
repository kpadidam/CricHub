"use client";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "run" | "four" | "six" | "wicket" | "extra" | "boundary";

const variants: Record<Variant, string> = {
  run:
    "bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-[22px] font-bold",
  four:
    "bg-[var(--boundary-four-light)] border border-[var(--boundary-four)] text-[var(--boundary-four)] text-[22px] font-bold",
  boundary:
    "bg-[var(--boundary-four-light)] border border-[var(--boundary-four)] text-[var(--boundary-four)] text-[22px] font-bold",
  six:
    "bg-[var(--six-purple-light)] border border-[var(--six-purple)] text-[var(--six-purple)] text-[22px] font-bold",
  wicket:
    "bg-[var(--wicket-red)] border border-[var(--wicket-red)] text-white text-sm font-semibold",
  extra:
    "bg-[var(--extras-orange-light)] border border-[var(--extras-orange)] text-[var(--extras-orange)] text-sm font-semibold",
};

export function ActionButton({
  variant = "run",
  children,
  className = "",
  ...rest
}: { variant?: Variant; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`min-h-[44px] h-14 w-full rounded-[12px] tabular active:scale-95 transition-transform duration-150 disabled:opacity-40 disabled:active:scale-100 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
