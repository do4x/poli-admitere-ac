/** Rule 4: anything solved with AI must be re-solved independently once this
 *  window closes. 4 days originally, 72h on 2026-07-18, 48h on 2026-07-20 —
 *  the reset is also what reopens a locked grila, so it has to come round
 *  while the problem is still fresh enough to be worth re-testing.
 *  Every user-facing "în N ore" string reads the hours from here. */
export const REVIEW_DELAY_HOURS = 48;
export const REVIEW_DELAY_MS = REVIEW_DELAY_HOURS * 60 * 60 * 1000;

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
