import Link from "next/link";
import { ChevronRight, ClipboardPenLine, Trophy, Tv } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

export default function Home() {
  return (
    <main
      className="flex-1 flex flex-col px-5 pt-10"
      style={{
        paddingBottom: "calc(80px + 24px)",
        backgroundColor: "var(--background)",
      }}
    >
      {/* Logo + title */}
      <div className="flex flex-col items-center text-center gap-3 pb-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--primary)" }}
        >
          <Trophy size={32} color="#fff" />
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Local Cricket Live
        </h1>
        <p
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: "var(--text-secondary)",
          }}
        >
          Score. Track. Celebrate.
        </p>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3">
        <Link
          href="/new"
          className="flex items-center gap-4 active:scale-[0.99] transition-transform"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--text-white)",
            padding: 16,
            borderRadius: 16,
          }}
        >
          <ClipboardPenLine size={28} />
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 18, fontWeight: 700 }}>Score a Match</div>
            <div
              style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}
            >
              Start recording a new match
            </div>
          </div>
          <ChevronRight size={22} />
        </Link>

        <div
          className="flex items-center gap-4"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            padding: 16,
            borderRadius: 16,
            opacity: 0.6,
          }}
          aria-disabled
        >
          <Tv size={28} color="var(--text-secondary)" />
          <div className="flex-1 min-w-0">
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              View Live Matches
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
              }}
            >
              Follow live scores and stats
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: 100,
              backgroundColor: "var(--surface-elevated)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Coming soon
          </span>
        </div>
      </div>

      {/* Quick Access */}
      <SectionHeader>Quick Access</SectionHeader>
      <div className="grid grid-cols-2 gap-3">
        <QuickCard label="Live Now" value="0 matches" />
        <QuickCard label="Upcoming" value="0 matches" />
      </div>

      {/* Recent Results */}
      <SectionHeader>Recent Results</SectionHeader>
      <div
        className="text-center py-6"
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}
      >
        No completed matches yet
      </div>

      <BottomNav />
    </main>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-8 mb-3"
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </h2>
  );
}

function QuickCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 12,
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
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}
