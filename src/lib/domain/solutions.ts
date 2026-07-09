/** Rule 4: an AI-assisted solution must be re-solved independently 4 days later. */
export const REVIEW_DELAY_MS = 4 * 24 * 60 * 60 * 1000;

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

export function computeReviewDueAt(
  submittedAt: Date,
  aiAssisted: boolean,
): Date | null {
  return aiAssisted ? new Date(submittedAt.getTime() + REVIEW_DELAY_MS) : null;
}
