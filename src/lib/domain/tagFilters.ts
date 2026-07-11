import { solveState, type SolveState } from "./solveState";

/** A problem reduced to just the fields filtering depends on. */
export interface FilterableProblem {
  isDepartajare: boolean;
  subject: string; // "MATE" | "INFO"
  year: number;
  tags: readonly { name: string }[];
  solutions: readonly { aiAssisted: boolean }[];
}

export interface ProblemFilters {
  tagName?: string;
  subject?: string;
  year?: number;
  stare?: SolveState;
  neclasificat?: boolean;
  /** When true, only departajare problems match. Default scope on /probleme. */
  departajareOnly?: boolean;
}

export interface TagCounts {
  /** Number of problems carrying each tag name (a problem counts once per tag). */
  byTag: Record<string, number>;
  /** Number of problems with zero tags. */
  neclasificat: number;
}

export function tagCounts(
  problems: readonly { tags: readonly { name: string }[] }[],
): TagCounts {
  const byTag: Record<string, number> = {};
  let neclasificat = 0;
  for (const problem of problems) {
    if (problem.tags.length === 0) {
      neclasificat += 1;
      continue;
    }
    for (const tag of problem.tags) {
      byTag[tag.name] = (byTag[tag.name] ?? 0) + 1;
    }
  }
  return { byTag, neclasificat };
}

/**
 * True iff the problem satisfies every active filter (AND semantics).
 * Absent filter fields are ignored.
 */
export function matchesFilters(
  problem: FilterableProblem,
  filters: ProblemFilters,
): boolean {
  if (filters.departajareOnly && !problem.isDepartajare) return false;
  if (filters.neclasificat && problem.tags.length !== 0) return false;
  if (filters.subject && problem.subject !== filters.subject) return false;
  if (filters.year !== undefined && problem.year !== filters.year) return false;
  if (
    filters.tagName &&
    !problem.tags.some((tag) => tag.name === filters.tagName)
  ) {
    return false;
  }
  if (filters.stare && solveState(problem.solutions) !== filters.stare) {
    return false;
  }
  return true;
}
