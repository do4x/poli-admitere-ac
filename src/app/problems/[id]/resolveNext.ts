import { prisma } from "@/lib/db";
import { selectVisible, type ProblemFilters } from "@/lib/domain";
import { problemNumberCompare } from "@/lib/format";
import { fetchFilterableProblems } from "@/app/probleme/query";
import { parseFilters } from "@/app/probleme/searchFilters";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Re-serialize the current context params, forcing `from`, so "next" chains. */
function carry(searchParams: SearchParams, from: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const single = first(value);
    if (single && key !== "from") params.set(key, single);
  }
  params.set("from", from);
  return params.toString();
}

export interface NextLink {
  href: string;
  scope: "exam" | "filter";
}

/**
 * The problem that follows the current one, relative to where the user came
 * from (the `from` search param):
 *   - `probleme` → next in the same filtered/sorted /probleme list
 *   - anything else (incl. absent) → next in the same exam, by problem number
 * Returns null when the current problem is last, or can't be located.
 */
export async function resolveNext(
  currentId: string,
  examId: string,
  userId: string | undefined,
  searchParams: SearchParams,
): Promise<NextLink | null> {
  if (first(searchParams.from) === "probleme") {
    const parsed = parseFilters(searchParams);
    const filters: ProblemFilters = {
      tagName: parsed.tagName,
      subject: parsed.subject,
      year: parsed.year,
      stare: parsed.stare,
      neclasificat: parsed.neclasificat,
      departajareOnly: !parsed.toate,
    };
    const visible = selectVisible(
      await fetchFilterableProblems(userId),
      filters,
    );
    const idx = visible.findIndex((p) => p.id === currentId);
    const next = idx >= 0 ? visible[idx + 1] : undefined;
    if (!next) return null;
    return {
      href: `/problems/${next.id}?${carry(searchParams, "probleme")}`,
      scope: "filter",
    };
  }

  // Default: next within the same exam, in problem-number order.
  const siblings = await prisma.problem.findMany({
    where: { examId },
    select: { id: true, number: true },
  });
  siblings.sort((a, b) => problemNumberCompare(a.number, b.number));
  const idx = siblings.findIndex((p) => p.id === currentId);
  const next = idx >= 0 ? siblings[idx + 1] : undefined;
  if (!next) return null;
  return { href: `/problems/${next.id}?from=exam`, scope: "exam" };
}
