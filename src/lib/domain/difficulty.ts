/**
 * Difficulty grading — implementation of DIFICULTATE.md v2.0 (20.07.2026).
 *
 * Two orthogonal axes (R = recognition, E = execution) plus four additive
 * modifiers collapse into `D_raw`, a continuous score. `D_raw` is the real
 * ordering; `level` (0.5★…5★ in half steps) is only the human label.
 * Everything here is pure — the grading itself happens offline and arrives
 * through `npm run import:dificultate`.
 */

/** Half-step scale shared by both axes: 1, 1.5, … 5. */
export const AXIS_VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

/** Allowed modifier values, per §4. */
export const T_VALUES = [0, 0.25, 0.5, 0.75, 1] as const;
export const P_VALUES = [0, 0.25, 0.5] as const;
export const K_VALUES = [0, 0.25, 0.5] as const;
export const V_VALUES = [-0.5, -0.25, 0, 0.25, 0.5] as const;

export interface DifficultyScores {
  /** R — recognition: what it costs to know *what* to do. */
  r: number;
  /** E — execution: what it costs to carry it out correctly. */
  e: number;
  /** T — trap density / distractor engineering. */
  t: number;
  /** P — path narrowness. */
  p: number;
  /** K — knowledge rarity. */
  k: number;
  /** V — verifiability (negative = cheap to check ⇒ easier). */
  v: number;
}

export type DifficultyLevel =
  | 0.5
  | 1
  | 1.5
  | 2
  | 2.5
  | 3
  | 3.5
  | 4
  | 4.5
  | 5;

export type Archetype =
  | "BRUTAL"
  | "INSIGHT"
  | "GRIND"
  | "TRAP"
  | "TRIVIAL"
  | "STANDARD";

/**
 * `D_raw = max(R, E) + 0.4 · (min(R, E) − 1) + T + P + K + V`
 *
 * The dominant axis sets the ceiling; the secondary one contributes
 * sublinearly. Rounded to 2 decimals — the band thresholds are quoted to 2
 * decimals, so float dust must not decide a band.
 */
export function computeDRaw(scores: DifficultyScores): number {
  const { r, e, t, p, k, v } = scores;
  const raw = Math.max(r, e) + 0.4 * (Math.min(r, e) - 1) + t + p + k + v;
  return Math.round(raw * 100) / 100;
}

/**
 * The ten bands of §5, as inclusive upper bounds. The last band has no upper
 * bound. Boundaries are quoted on the *lower* edge of the next band in the
 * document (≤1.25 then 1.26–2.00 …), so an upper bound of 1.25 is exact.
 */
const BANDS: { max: number; level: DifficultyLevel }[] = [
  { max: 1.25, level: 0.5 },
  { max: 2.0, level: 1 },
  { max: 2.6, level: 1.5 },
  { max: 3.2, level: 2 },
  { max: 3.9, level: 2.5 },
  { max: 4.6, level: 3 },
  { max: 5.5, level: 3.5 },
  { max: 6.4, level: 4 },
  { max: 7.75, level: 4.5 },
];

const TOP_LEVEL: DifficultyLevel = 5;

/** Band label for a raw score. */
export function levelFor(dRaw: number): DifficultyLevel {
  for (const band of BANDS) {
    if (dRaw <= band.max) return band.level;
  }
  return TOP_LEVEL;
}

/** Distance from a band boundary at which a problem is treated as borderline. */
export const MARGIN_TOLERANCE = 0.15;

/**
 * True when `D_raw` sits within 0.15 of a band boundary. With ten bands the
 * boundaries are twice as dense as in v1.0, so a single modifier decision can
 * flip the label — flagged problems are planned as if they were one band
 * higher (§5, "Regula de margine").
 */
export function isBandMargin(dRaw: number): boolean {
  return BANDS.some(
    (band) => Math.abs(dRaw - band.max) <= MARGIN_TOLERANCE + 1e-9,
  );
}

/**
 * The training prescription (§6). Order is part of the rule: the first
 * matching condition wins, so a BRUTAL is never re-labelled INSIGHT.
 */
export function archetypeFor(
  scores: Pick<DifficultyScores, "r" | "e" | "t">,
  level: DifficultyLevel,
): Archetype {
  const { r, e, t } = scores;
  if (r >= 4 && e >= 3.5 && level >= 4) return "BRUTAL";
  if (r - e >= 1.5) return "INSIGHT";
  if (e - r >= 1.5) return "GRIND";
  if (t >= 0.5 && r <= 2 && e <= 3) return "TRAP";
  if (level <= 1 && t <= 0.25) return "TRIVIAL";
  return "STANDARD";
}

export interface GradedDifficulty extends DifficultyScores {
  dRaw: number;
  level: DifficultyLevel;
  bandMargin: boolean;
  archetype: Archetype;
}

/** Everything derivable from the six axis/modifier scores, in one pass. */
export function grade(scores: DifficultyScores): GradedDifficulty {
  const dRaw = computeDRaw(scores);
  const level = levelFor(dRaw);
  return {
    ...scores,
    dRaw,
    level,
    bandMargin: isBandMargin(dRaw),
    archetype: archetypeFor(scores, level),
  };
}

/** Level values a user can pick as a minimum, hardest first. */
export const LEVELS: readonly DifficultyLevel[] = [
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,
];

/** The departajare threshold called out in §5 and §13. */
export const DEPARTAJARE_LEVEL: DifficultyLevel = 3.5;

/**
 * "Dificultate minimă" filter. Ungraded problems (level = null) never match a
 * minimum — an unknown difficulty is not evidence of a hard problem.
 * A band-margin problem is planned as its next band up (§5), so it passes a
 * minimum one half-star above its label.
 */
export function meetsMinLevel(
  problem: { level: number; bandMargin?: boolean } | null | undefined,
  min: number | undefined,
): boolean {
  if (min === undefined) return true;
  if (!problem) return false;
  const effective = problem.bandMargin ? problem.level + 0.5 : problem.level;
  return effective >= min;
}

/**
 * Star glyph breakdown for rendering a level: 5 slots, each full, half or
 * empty. `level` is in half steps, so at most one half ever appears.
 */
export function starSlots(level: number): ("full" | "half" | "empty")[] {
  const full = Math.floor(level);
  const half = level - full >= 0.5;
  return Array.from({ length: 5 }, (_, i) => {
    if (i < full) return "full";
    if (i === full && half) return "half";
    return "empty";
  });
}

/** "3½★" / "4★" — compact label for chips and badges. */
export function levelLabel(level: number): string {
  const full = Math.floor(level);
  const half = level - full >= 0.5;
  if (full === 0) return "½★";
  return `${full}${half ? "½" : ""}★`;
}
