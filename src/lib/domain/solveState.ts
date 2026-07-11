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
