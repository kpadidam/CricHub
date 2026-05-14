"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, Trophy, User } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type Item = {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href?: string;
};

const ITEMS: Item[] = [
  { id: "home", label: "Home", icon: Home, href: "/" },
  { id: "matches", label: "Matches", icon: List, href: "/" },
  { id: "tournaments", label: "Tournaments", icon: Trophy },
  { id: "profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const activeId =
    pathname === "/" ? "home" : pathname.startsWith("/m/") ? "matches" : "";

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40"
      style={{
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "28px",
      }}
    >
      <ul className="flex items-stretch justify-around h-[52px]">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const isActive = activeId === it.id;
          const color = isActive
            ? "var(--primary)"
            : "var(--text-muted)";
          const inner = (
            <span
              className="flex flex-col items-center justify-center gap-0.5 h-full"
              style={{ color }}
            >
              <Icon width={24} height={24} />
              <span style={{ fontSize: 11, fontWeight: 500 }}>{it.label}</span>
            </span>
          );
          return (
            <li key={it.id} className="flex-1">
              {it.href ? (
                <Link href={it.href} className="block h-full">
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full h-full"
                  aria-disabled
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
