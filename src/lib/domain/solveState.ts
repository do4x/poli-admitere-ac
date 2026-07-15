import { isIndependent } from "./solutions";

/** The four solve states a problem can be in, for filtering on /probleme. */
export type SolveState = "nerezolvata" | "grila" | "doar_ai" | "singur";

/** An answer attempt reduced to what state derivation needs (chronological order). */
export interface AttemptLike {
  kind: "CHOICE" | "REVEAL";
  correct: boolean | null;
}

/**
 * Derive a problem's solve state (business rules 1–2 + grila ladder):
 * - ≥1 independent solution        → "singur" (done — the only state that
 *                                     satisfies the departajare counter)
 * - solutions exist, none indep.   → "doar_ai"
 * - correct grila answer submitted
 *   BEFORE any reveal              → "grila" (self-checked, no written proof)
 * - otherwise                      → "nerezolvata"
 *
 * A REVEAL taints all later attempts: once the key was seen, a correct
 * choice no longer demonstrates anything. Attempts must be passed in
 * chronological order.
 */
export function solveState(
  solutions: readonly { aiAssisted: boolean }[],
  attempts: readonly AttemptLike[] = [],
): SolveState {
  if (solutions.length > 0) {
    return solutions.some(isIndependent) ? "singur" : "doar_ai";
  }
  let revealed = false;
  for (const attempt of attempts) {
    if (attempt.kind === "REVEAL") {
      revealed = true;
    } else if (attempt.correct === true && !revealed) {
      return "grila";
    }
  }
  return "nerezolvata";
}

/** A grila check counts toward the completion goal only when the correct
 * answer came this early (owner decision 2026-07-15). */
export const GRILA_MAX_TRIES = 2;

/**
 * True iff the first pre-reveal correct choice was among the first
 * `maxTries` choices. Guessing your way to green in 3+ tries keeps the
 * "grila" status but does NOT count as done — the counter stays put.
 * Attempts must be passed in chronological order; REVEAL taints everything
 * after it, same as in `solveState`.
 */
export function grilaCountsAsDone(
  attempts: readonly AttemptLike[],
  maxTries: number = GRILA_MAX_TRIES,
): boolean {
  let revealed = false;
  let tries = 0;
  for (const attempt of attempts) {
    if (attempt.kind === "REVEAL") {
      revealed = true;
      continue;
    }
    tries++;
    if (attempt.correct === true && !revealed) {
      return tries <= maxTries;
    }
  }
  return false;
}
