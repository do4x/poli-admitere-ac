/** An attempt with its timestamp, for duration derivation (chronological order). */
export interface TimedAttempt {
  kind: "CHOICE" | "REVEAL";
  correct: boolean | null;
  createdAt: Date;
}

/** Gaps longer than this between consecutive attempts are treated as "resumed
 * later" (tab closed, lunch, sleep) and contribute nothing — wall-clock time
 * is not focus time. */
export const DEFAULT_MAX_GAP_MS = 15 * 60 * 1000;

/**
 * Derived time-to-solve for a problem's grila ladder (IDEAS.md, 2026-07-19):
 * active milliseconds from the FIRST attempt to the first untainted correct
 * choice.
 *
 * - Correct on the 1st try → 0 (the first attempt is the anchor; nothing
 *   precedes it, so there is no elapsed time to measure).
 * - Correct on the n-th try → sum of gaps between consecutive attempts up to
 *   the correct one, EXCLUDING gaps > `maxGapMs` (those are session breaks,
 *   not thinking time — a 14h "Δt" would be a lie).
 * - Never correct, or a REVEAL before the correct choice → null. Once the key
 *   was seen the timing demonstrates nothing, same as correctness.
 *
 * Pure derivation over `AnswerAttempt.createdAt` — no schema change, works
 * retroactively on all existing history. Attempts must be chronological.
 */
export function attemptDuration(
  attempts: readonly TimedAttempt[],
  maxGapMs: number = DEFAULT_MAX_GAP_MS,
): number | null {
  let activeMs = 0;
  let previous: TimedAttempt | null = null;

  for (const attempt of attempts) {
    if (attempt.kind === "REVEAL") return null;
    if (previous) {
      const gap = attempt.createdAt.getTime() - previous.createdAt.getTime();
      if (gap <= maxGapMs) activeMs += gap;
    }
    if (attempt.correct === true) return activeMs;
    previous = attempt;
  }
  return null;
}
