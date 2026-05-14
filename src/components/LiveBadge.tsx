export function LiveBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white"
      style={{ backgroundColor: "var(--live-red)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
      <span
        className="text-[10px] font-bold"
        style={{ letterSpacing: "0.1em" }}
      >
        LIVE
      </span>
    </span>
  );
}
