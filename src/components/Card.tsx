import { ReactNode, HTMLAttributes } from "react";

export function Card({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`bg-[var(--surface)] border border-[var(--border)] p-4 ${className}`}
      style={{ borderRadius: "var(--radius-lg)", ...((rest as { style?: React.CSSProperties }).style ?? {}) }}
    >
      {children}
    </div>
  );
}
