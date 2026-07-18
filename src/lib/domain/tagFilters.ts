import { problemNumberCompare } from "@/lib/format";
import type { AiMarkLike } from "./aiMark";
import { solveState, type AttemptLike, type SolveState } from "./solveState";

/** A problem reduced to just the fields filtering depends on. */
export interface FilterableProblem {
  isDepartajare: boolean;
  subject: string; // "MATE" | "INFO"
  year: number;
  tags: readonly { name: string }[];
  solutions: readonly { aiAssisted: boolean }[];
  /** Chronological answer attempts; absent = none. */
  attempts?: readonly AttemptLike[];
  /** The user's AI mark, if any. */
  aiMark?: AiMarkLike | null;
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
  now: Date = new Date(),
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
  if (
    filters.stare &&
    solveState(
      problem.solutions,
      problem.attempts ?? [],
      problem.aiMark ?? null,
      now,
    ) !== filters.stare
  ) {
    return false;
  }
  return true;
}

/** A problem carrying its exam + the current user's solve-state relations. */
export interface ListProblem {
  id: string;
  number: string;
  isDepartajare: boolean;
  exam: { subject: string; year: number };
  tags: readonly { name: string }[];
  solutions: readonly { aiAssisted: boolean }[];
  attempts?: readonly AttemptLike[];
  aiMark?: AiMarkLike | null;
}

/**
 * Filter + order a problem list exactly as /probleme renders it (year desc,
 * then problem number). Shared by the /probleme page and the "next problem"
 * resolver so the button can never disagree with the list you came from.
 */
export function selectVisible<T extends ListProblem>(
  problems: readonly T[],
  filters: ProblemFilters,
  now: Date = new Date(),
): T[] {
  return problems
    .filter((p) =>
      matchesFilters(
        {
          isDepartajare: p.isDepartajare,
          subject: p.exam.subject,
          year: p.exam.year,
          tags: p.tags,
          solutions: p.solutions,
          attempts: p.attempts,
          aiMark: p.aiMark,
        },
        filters,
        now,
      ),
    )
    .sort(
      (a, b) =>
        b.exam.year - a.exam.year || problemNumberCompare(a.number, b.number),
    );
}
