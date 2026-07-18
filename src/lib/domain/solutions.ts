/** Rule 4 (owner revision 2026-07-18): anything solved with AI must be
 *  re-solved independently 72 hours later — down from the original 4 days. */
export const REVIEW_DELAY_MS = 72 * 60 * 60 * 1000;

/** Rule 1: independent = not AI-assisted. */
export function isIndependent(solution: { aiAssisted: boolean }): boolean {
  return !solution.aiAssisted;
}

/** Rule 2: a problem counts as done iff ≥1 independent solution exists. */
export function hasIndependentSolution(problem: {
  solutions: readonly { aiAssisted: boolean }[];
}): boolean {
  return problem.solutions.some(isIndependent);
}

/** When a fresh AI mark's re-solve window closes. */
export function computeAiDueAt(markedAt: Date): Date {
  return new Date(markedAt.getTime() + REVIEW_DELAY_MS);
}
