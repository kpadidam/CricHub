import type { Ball } from "@/lib/types";

type Tone = {
  bg: string;
  fg: string;
  content: string;
  fontSize: string;
};

function tone(b: Ball): Tone {
  if (b.wicket) {
    return {
      bg: "var(--wicket-red-light)",
      fg: "var(--wicket-red)",
      content: "W",
      fontSize: "12px",
    };
  }
  if (b.extra === "wd") {
    return {
      bg: "var(--extras-orange-light)",
      fg: "var(--extras-orange)",
      content: b.runs > 1 ? `${b.runs - 1}WD` : "WD",
      fontSize: "9px",
    };
  }
  if (b.extra === "nb") {
    return {
      bg: "var(--extras-orange-light)",
      fg: "var(--extras-orange)",
      content: b.runs > 1 ? `${b.runs - 1}NB` : "NB",
      fontSize: "9px",
    };
  }
  if (b.extra === "b") {
    return {
      bg: "var(--extras-orange-light)",
      fg: "var(--extras-orange)",
      content: `${b.runs}B`,
      fontSize: "9px",
    };
  }
  if (b.extra === "lb") {
    return {
      bg: "var(--extras-orange-light)",
      fg: "var(--extras-orange)",
      content: `${b.runs}LB`,
      fontSize: "9px",
    };
  }
  if (b.runs === 6) {
    return {
      bg: "var(--six-purple-light)",
      fg: "var(--six-purple)",
      content: "6",
      fontSize: "12px",
    };
  }
  if (b.runs === 4) {
    return {
      bg: "var(--boundary-four-light)",
      fg: "var(--boundary-four)",
      content: "4",
      fontSize: "12px",
    };
  }
  if (b.runs === 0) {
    return {
      bg: "var(--dot-gray-light)",
      fg: "var(--dot-gray)",
      content: "0",
      fontSize: "12px",
    };
  }
  return {
    bg: "var(--run-blue-light)",
    fg: "var(--run-blue)",
    content: String(b.runs),
    fontSize: "12px",
  };
}

export function BallPill({ ball }: { ball: Ball }) {
  const t = tone(ball);
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-bold tabular"
      style={{
        width: 28,
        height: 28,
        background: t.bg,
        color: t.fg,
        fontSize: t.fontSize,
        fontWeight: 700,
      }}
    >
      {t.content}
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
