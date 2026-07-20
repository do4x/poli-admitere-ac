import { levelLabel, starSlots } from "@/lib/domain";

/**
 * A 0.5★–5★ level drawn as five star glyphs. Half stars are a full star
 * clipped to its left half over an empty one — no half-star glyph exists in
 * a font we can rely on.
 */
export function Stars({
  level,
  size = "sm",
  className = "",
}: {
  level: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const px = size === "md" ? "text-base" : "text-[11px]";
  return (
    <span
      className={`inline-flex items-center leading-none ${px} ${className}`}
      title={`Dificultate ${levelLabel(level)}`}
      aria-label={`Dificultate ${levelLabel(level)} din 5`}
    >
      {starSlots(level).map((slot, i) => (
        <Star key={i} slot={slot} />
      ))}
    </span>
  );
}

function Star({ slot }: { slot: "full" | "half" | "empty" }) {
  if (slot === "full") return <span aria-hidden>★</span>;
  if (slot === "empty") return <span aria-hidden className="opacity-25">★</span>;
  return (
    <span aria-hidden className="relative inline-block">
      <span className="opacity-25">★</span>
      <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">★</span>
    </span>
  );
}

const ARCHETYPE_STYLE: Record<string, { label: string; className: string }> = {
  BRUTAL: { label: "brutal", className: "border-rose-400 bg-rose-50 text-rose-700" },
  INSIGHT: { label: "insight", className: "border-violet-400 bg-violet-50 text-violet-700" },
  GRIND: { label: "grind", className: "border-blue-400 bg-blue-50 text-blue-700" },
  TRAP: { label: "capcană", className: "border-amber-400 bg-amber-50 text-amber-700" },
  TRIVIAL: { label: "trivial", className: "border-line bg-surface text-faint" },
  STANDARD: { label: "standard", className: "border-line bg-surface text-muted" },
};

/**
 * The training prescription (§6) — what to DO with the problem, which the
 * level alone never says: a 3.5★ GRIND dies to repetition, a 3.5★ INSIGHT
 * never does.
 */
export function ArchetypeBadge({ archetype }: { archetype: string }) {
  const style = ARCHETYPE_STYLE[archetype];
  if (!style) return null;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.className}`}
    >
      {style.label}
    </span>
  );
}

/**
 * Level + archetype + target time, the admin-only difficulty strip shown on a
 * problem. `dRaw` is the real ordering, so it rides along in the tooltip.
 */
export function DifficultyBadge({
  difficulty,
  size = "sm",
  showTime = false,
}: {
  difficulty: {
    level: number;
    dRaw: number;
    bandMargin: boolean;
    archetype: string;
    targetMinutes: number;
  };
  size?: "sm" | "md";
  showTime?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1 text-amber-600"
        title={`D_raw ${difficulty.dRaw.toFixed(2)}${
          difficulty.bandMargin ? " — la margine de bandă, tratează-o ca banda superioară" : ""
        }`}
      >
        <Stars level={difficulty.level} size={size} />
        {difficulty.bandMargin && (
          <span className="text-[10px] font-bold text-amber-500" aria-hidden>
            +
          </span>
        )}
      </span>
      <ArchetypeBadge archetype={difficulty.archetype} />
      {showTime && (
        <span className="text-[11px] tabular-nums text-faint">
          ~{difficulty.targetMinutes} min
        </span>
      )}
    </span>
  );
}
