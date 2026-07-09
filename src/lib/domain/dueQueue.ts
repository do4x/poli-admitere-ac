import { hasIndependentSolution } from "./solutions";

export interface DueSolutionInput {
  aiAssisted: boolean;
  reviewDueAt: Date | null;
  notifiedAt: Date | null;
}

export interface DueItem<P, S> {
  problem: P;
  solution: S;
}

/**
 * Rule 5: the due queue — AI-assisted solutions with reviewDueAt <= now, on
 * problems that still have no independent solution. An independent solution
 * clears the problem from the queue permanently.
 */
export function dueSolutions<
  P extends { solutions: readonly DueSolutionInput[] },
>(problems: readonly P[], now: Date): DueItem<P, P["solutions"][number]>[] {
  const items: DueItem<P, P["solutions"][number]>[] = [];
  for (const problem of problems) {
    if (hasIndependentSolution(problem)) continue;
    for (const solution of problem.solutions) {
      if (!solution.aiAssisted) continue;
      if (solution.reviewDueAt === null) continue;
      if (solution.reviewDueAt.getTime() > now.getTime()) continue;
      items.push({ problem, solution });
    }
  }
  return items;
}

/** Digest candidates: due items whose review email was never sent. */
export function unnotified<S extends DueSolutionInput, P>(
  items: readonly DueItem<P, S>[],
): DueItem<P, S>[] {
  return items.filter((item) => item.solution.notifiedAt === null);
}
