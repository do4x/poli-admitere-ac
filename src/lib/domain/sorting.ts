import { problemNumberCompare } from "@/lib/format";

/**
 * The orders the /probleme list can be shown in. `recente` is the default and
 * reproduces the historical order (newest exam first, then problem number).
 */
export type SortKey = "relevanta" | "greu" | "usor" | "recente" | "vechi";

export const SORT_KEYS: readonly SortKey[] = [
  "relevanta",
  "greu",
  "usor",
  "recente",
  "vechi",
];

export const DEFAULT_SORT: SortKey = "recente";

/** Sorts that read the (admin-only) difficulty grading. */
export function needsDifficulty(sort: SortKey): boolean {
  return sort === "greu" || sort === "usor";
}

/** A problem reduced to what ordering depends on. */
export interface SortableProblem {
  id: string;
  number: string;
  exam: { year: number };
  difficulty?: { dRaw: number } | null;
}

export interface SortContext {
  /** Problem id → how many users have solved it. Missing = 0. */
  solveCounts?: ReadonlyMap<string, number>;
}

/**
 * The historical order: newest exam first, then problem number. Used on its
 * own for `recente` and as the tie-breaker for every other sort, so the list
 * is always fully determined — no two renders can disagree.
 */
function byNewest(a: SortableProblem, b: SortableProblem): number {
  return b.exam.year - a.exam.year || problemNumberCompare(a.number, b.number);
}

/**
 * Order a filtered problem list. Pure and total: an unknown key falls back to
 * the default, and problems missing the data a sort needs (ungraded, never
 * solved) sink to the bottom rather than scrambling the list.
 *
 * Difficulty sorts compare `D_raw`, not the star band — DIFICULTATE.md §13:
 * the band is the label for humans, `D_raw` is the real ordering, and two
 * 3★ problems can legitimately differ by 0.6.
 */
export function sortProblems<T extends SortableProblem>(
  problems: readonly T[],
  sort: SortKey = DEFAULT_SORT,
  context: SortContext = {},
): T[] {
  const list = [...problems];
  const counts = context.solveCounts;

  switch (sort) {
    case "vechi":
      return list.sort(
        (a, b) =>
          a.exam.year - b.exam.year || problemNumberCompare(a.number, b.number),
      );

    case "greu":
      return list.sort((a, b) => {
        const da = a.difficulty?.dRaw;
        const db = b.difficulty?.dRaw;
        if (da === undefined || da === null) return db == null ? byNewest(a, b) : 1;
        if (db === undefined || db === null) return -1;
        return db - da || byNewest(a, b);
      });

    case "usor":
      return list.sort((a, b) => {
        const da = a.difficulty?.dRaw;
        const db = b.difficulty?.dRaw;
        if (da === undefined || da === null) return db == null ? byNewest(a, b) : 1;
        if (db === undefined || db === null) return -1;
        return da - db || byNewest(a, b);
      });

    case "relevanta":
      return list.sort((a, b) => {
        const ca = counts?.get(a.id) ?? 0;
        const cb = counts?.get(b.id) ?? 0;
        return cb - ca || byNewest(a, b);
      });

    case "recente":
    default:
      return list.sort(byNewest);
  }
}
