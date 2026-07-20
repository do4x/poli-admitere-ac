import { prisma } from "@/lib/db";
import { needsDifficulty, selectVisible, type ProblemFilters } from "@/lib/domain";
import { problemNumberCompare } from "@/lib/format";
import { problemHref, type SlugExam } from "@/lib/slug";
import { fetchFilterableProblems, fetchSolveCounts } from "@/app/probleme/query";
import { parseFilters } from "@/app/probleme/searchFilters";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Re-serialize the current context params, forcing `from`, so navigation chains. */
function carry(searchParams: SearchParams, from: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const single = first(value);
    if (single && key !== "from") params.set(key, single);
  }
  params.set("from", from);
  return params.toString();
}

export interface NeighborLink {
  href: string;
  scope: "exam" | "filter";
}

export interface Neighbors {
  prev: NeighborLink | null;
  next: NeighborLink | null;
}

/**
 * The problems immediately before and after the current one, relative to where
 * the user came from (the `from` search param):
 *   - `probleme` → siblings in the same filtered/sorted /probleme list
 *   - anything else (incl. absent) → siblings in the same exam, by problem number
 * Either side is null when the current problem is at that end of the list.
 */
export async function resolveNeighbors(
  currentId: string,
  exam: { id: string } & SlugExam,
  user: { id: string; isAdmin: boolean } | null,
  searchParams: SearchParams,
): Promise<Neighbors> {
  const userId = user?.id;
  if (first(searchParams.from) === "probleme") {
    const parsed = parseFilters(searchParams);
    const filters: ProblemFilters = {
      tagName: parsed.tagName,
      subject: parsed.subject,
      year: parsed.year,
      stare: parsed.stare,
      neclasificat: parsed.neclasificat,
      departajareOnly: !parsed.toate,
      // Same admin gate as /probleme, so the button can never walk a list the
      // page itself would not show.
      minLevel: user?.isAdmin ? parsed.minLevel : undefined,
    };
    // Same order as the list the user came from — including the sort, or the
    // button would walk a different sequence than the one on screen.
    const sort =
      parsed.sort && needsDifficulty(parsed.sort) && !user?.isAdmin
        ? undefined
        : parsed.sort;
    const [problems, counts] = await Promise.all([
      fetchFilterableProblems(userId),
      sort === "relevanta" ? fetchSolveCounts() : Promise.resolve(null),
    ]);
    const visible = selectVisible(problems, filters, new Date(), sort, {
      solveCounts: counts ? new Map(Object.entries(counts)) : undefined,
    });
    const idx = visible.findIndex((p) => p.id === currentId);
    const query = carry(searchParams, "probleme");
    const link = (p: (typeof visible)[number]): NeighborLink => ({
      href: problemHref(p, query),
      scope: "filter",
    });
    if (idx < 0) return { prev: null, next: null };
    return {
      prev: idx > 0 ? link(visible[idx - 1]) : null,
      next: idx < visible.length - 1 ? link(visible[idx + 1]) : null,
    };
  }

  // Default: siblings within the same exam, in problem-number order.
  const siblings = await prisma.problem.findMany({
    where: { examId: exam.id },
    select: { id: true, number: true },
  });
  siblings.sort((a, b) => problemNumberCompare(a.number, b.number));
  const idx = siblings.findIndex((p) => p.id === currentId);
  const link = (p: { number: string }): NeighborLink => ({
    href: problemHref({ number: p.number, exam }, "from=exam"),
    scope: "exam",
  });
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? link(siblings[idx - 1]) : null,
    next: idx < siblings.length - 1 ? link(siblings[idx + 1]) : null,
  };
}
