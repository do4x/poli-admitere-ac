import Link from "next/link";
import { Statement } from "@/components/Statement";
import { prisma } from "@/lib/db";
import {
  matchesFilters,
  solveState,
  tagCounts,
  type ProblemFilters,
} from "@/lib/domain";
import { examLabel, problemNumberCompare } from "@/lib/format";
import { FilterBar } from "./FilterBar";
import { parseFilters } from "./searchFilters";

export const dynamic = "force-dynamic";

const STARE_BADGE: Record<
  ReturnType<typeof solveState>,
  { text: string; cls: string }
> = {
  singur: { text: "rezolvată singur", cls: "bg-green-100 text-green-800" },
  doar_ai: { text: "doar cu AI", cls: "bg-amber-100 text-amber-800" },
  nerezolvata: { text: "nerezolvată", cls: "bg-stone-200 text-stone-600" },
};

export default async function ProblemePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = parseFilters(params);

  const [problems, allTags] = await Promise.all([
    prisma.problem.findMany({
      include: {
        exam: true,
        tags: { select: { name: true } },
        solutions: { select: { aiAssisted: true } },
      },
    }),
    prisma.tag.findMany({
      select: { name: true, subject: true },
      orderBy: [{ subject: "asc" }, { name: "asc" }],
    }),
  ]);

  const domainFilters: ProblemFilters = {
    tagName: parsed.tagName,
    subject: parsed.subject,
    year: parsed.year,
    stare: parsed.stare,
    neclasificat: parsed.neclasificat,
    departajareOnly: !parsed.toate,
  };

  const filterable = (p: (typeof problems)[number]) => ({
    isDepartajare: p.isDepartajare,
    subject: p.exam.subject,
    year: p.exam.year,
    tags: p.tags,
    solutions: p.solutions,
  });

  const visible = problems
    .filter((p) => matchesFilters(filterable(p), domainFilters))
    .sort(
      (a, b) =>
        b.exam.year - a.exam.year ||
        problemNumberCompare(a.number, b.number),
    );

  // Counts reflect the current scope (departajare-only unless "toate"),
  // independent of the other active filters, so a tag's size stays legible.
  const scopeSet = problems.filter((p) => (parsed.toate ? true : p.isDepartajare));
  const counts = tagCounts(scopeSet.map((p) => ({ tags: p.tags })));
  const years = [...new Set(problems.map((p) => p.exam.year))].sort(
    (a, b) => b - a,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Probleme</h1>
        <span className="text-sm text-stone-500">{visible.length} rezultate</span>
      </div>

      <FilterBar
        current={parsed}
        params={params}
        tags={allTags}
        years={years}
        counts={counts}
      />

      {visible.length === 0 ? (
        <p className="rounded border border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
          Nicio problemă nu corespunde filtrelor.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((problem) => {
            const badge = STARE_BADGE[solveState(problem.solutions)];
            return (
              <li
                key={problem.id}
                className={`rounded border bg-white p-3 ${
                  problem.isDepartajare
                    ? "border-l-4 border-amber-500"
                    : "border-stone-300"
                }`}
              >
                <div className="flex items-start gap-4">
                  <Link
                    href={`/problems/${problem.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="shrink-0 font-bold">
                        {problem.number}
                      </span>
                      <span className="truncate text-xs text-stone-500">
                        {examLabel(problem.exam)}
                      </span>
                    </div>
                    <div className="mt-1 max-h-12 overflow-hidden text-sm text-stone-700">
                      <Statement latex={problem.latex} />
                    </div>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
                    >
                      {badge.text}
                    </span>
                    {problem.tags.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1">
                        {problem.tags.map((tag) => (
                          <span
                            key={tag.name}
                            className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium text-stone-600"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
