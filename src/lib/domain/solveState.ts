import { isIndependent } from "./solutions";

/** The three solve states a problem can be in, for filtering on /probleme. */
export type SolveState = "nerezolvata" | "singur" | "doar_ai";

/**
 * Derive a problem's solve state from its solutions (business rules 1–2):
 * - no solutions            → "nerezolvata"
 * - ≥1 independent solution → "singur" (done, even alongside AI-assisted ones)
 * - solutions but all AI    → "doar_ai"
 */
export function solveState(
  solutions: readonly { aiAssisted: boolean }[],
): SolveState {
  if (solutions.length === 0) return "nerezolvata";
  if (solutions.some(isIndependent)) return "singur";
  return "doar_ai";
}
