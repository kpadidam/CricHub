import type { Ball } from "@/lib/types";
import { displayLabel } from "@/lib/display";

type Tone = {
  bg: string;
  fg: string;
  fontSize: string;
};

function tone(b: Ball): Tone {
  if (b.wicket) {
    return {
      bg: "var(--wicket-red-light)",
      fg: "var(--wicket-red)",
      fontSize: "9px",
    };
  }
  if (b.extra) {
    return {
      bg: "var(--extras-orange-light)",
      fg: "var(--extras-orange)",
      fontSize: "9px",
    };
  }
  if (b.runs === 6) {
    return {
      bg: "var(--six-purple-light)",
      fg: "var(--six-purple)",
      fontSize: "12px",
    };
  }
  if (b.runs === 4) {
    return {
      bg: "var(--boundary-four-light)",
      fg: "var(--boundary-four)",
      fontSize: "12px",
    };
  }
  if (b.runs === 0) {
    return {
      bg: "var(--dot-gray-light)",
      fg: "var(--dot-gray)",
      fontSize: "12px",
    };
  }
  return {
    bg: "var(--run-blue-light)",
    fg: "var(--run-blue)",
    fontSize: "12px",
  };
}

export function BallPill({ ball }: { ball: Ball }) {
  const t = tone(ball);
  const content = displayLabel(ball);
  // Shrink font for longer composite labels (e.g. "1WD+W").
  const fontSize = content.length >= 4 ? "8px" : t.fontSize;
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-bold tabular"
      style={{
        width: 28,
        height: 28,
        background: t.bg,
        color: t.fg,
        fontSize,
        fontWeight: 700,
      }}
    >
      {content}
    </div>
  );
}

export function EmptyPill() {
  return (
    <div
      className="shrink-0 rounded-full border border-dashed"
      style={{
        width: 28,
        height: 28,
        borderColor: "var(--border)",
      }}
    />
  );
}
