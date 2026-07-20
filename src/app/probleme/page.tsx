import Link from "next/link";
import { Statement } from "@/components/Statement";
import { DifficultyBadge } from "@/components/Stars";
import { prisma } from "@/lib/db";
import {
  aiPhase,
  needsDifficulty,
  selectVisible,
  solveState,
  tagCounts,
  type ProblemFilters,
  type SolveState,
} from "@/lib/domain";
import { getSessionUser } from "@/lib/auth";
import { examLabel } from "@/lib/format";
import { problemHref } from "@/lib/slug";
import { subjectStyle } from "@/lib/subjects";
import { FilterBar } from "./FilterBar";
import { TaxonomyManager } from "./TaxonomyManager";
import { fetchFilterableProblems, fetchSolveCounts } from "./query";
import { PAGE_SIZE, pageHref, parseFilters, parsePage } from "./searchFilters";

export const dynamic = "force-dynamic";

// Left spine = subject; card outline + status badge = solve state.
const STATUS: Record<
  SolveState,
  { border: string; badge: string; label: string }
> = {
  nerezolvata: {
    border: "border-rose-300",
    badge: "bg-rose-100 text-rose-700",
    label: "nerezolvată",
  },
  grila: {
    border: "border-teal-300",
    badge: "bg-teal-100 text-teal-700",
    label: "verificată pe grilă",
  },
  doar_ai: {
    border: "border-orange-300",
    badge: "bg-orange-100 text-orange-700",
    label: "doar cu AI",
  },
  singur: {
    border: "border-green-300",
    badge: "bg-green-100 text-green-700",
    label: "rezolvată singur",
  },
};

export default async function ProblemePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = parseFilters(params);
  const user = await getSessionUser();

  const [problems, allTags] = await Promise.all([
    fetchFilterableProblems(user?.id),
    prisma.tag.findMany({
      select: { id: true, name: true, subject: true },
      orderBy: [{ subject: "asc" }, { name: "asc" }],
    }),
  ]);

  // Difficulty is admin-only for now: a non-admin hitting ?dificultate=4 by
  // hand gets the unfiltered list, not a hidden feature.
  const canSeeDifficulty = user?.isAdmin === true;

  const domainFilters: ProblemFilters = {
    tagName: parsed.tagName,
    subject: parsed.subject,
    year: parsed.year,
    stare: parsed.stare,
    neclasificat: parsed.neclasificat,
    departajareOnly: !parsed.toate,
    minLevel: canSeeDifficulty ? parsed.minLevel : undefined,
  };

  // A non-admin cannot sort by a grading they cannot see either.
  const sort =
    parsed.sort && needsDifficulty(parsed.sort) && !canSeeDifficulty
      ? undefined
      : parsed.sort;
  // Only the popularity sort needs the global aggregate — everyone else skips
  // the round trip entirely.
  const solveCounts =
    sort === "relevanta" ? new Map(Object.entries(await fetchSolveCounts())) : undefined;

  const now = new Date();
  const visible = selectVisible(problems, domainFilters, now, sort, {
    solveCounts,
  });

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(parsePage(params), totalPages);
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Carry the active filter into each problem link so its "next" button walks
  // this same list (the full filtered list, not just the current page).
  const ctxQuery = (() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const single = Array.isArray(v) ? v[0] : v;
      if (single) p.set(k, single);
    }
    p.set("from", "probleme");
    return p.toString();
  })();

  const scopeSet = problems.filter((p) => (parsed.toate ? true : p.isDepartajare));
  const counts = tagCounts(scopeSet.map((p) => ({ tags: p.tags })));
  const years = [...new Set(problems.map((p) => p.exam.year))].sort(
    (a, b) => b - a,
  );

  const totalCounts = tagCounts(problems.map((p) => ({ tags: p.tags })));
  const managedTags = allTags.map((t) => ({
    ...t,
    count: totalCounts.byTag[t.name] ?? 0,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Probleme
          </h1>
          <p className="mt-1 text-sm text-muted">
            Filtrează după capitol pentru lucru țintit.
          </p>
        </div>
        <span className="rounded-full border border-line bg-card px-3 py-1 text-sm font-medium text-muted shadow-soft tabular-nums">
          {visible.length} rezultate
        </span>
      </div>

      <FilterBar
        current={parsed}
        params={params}
        tags={allTags}
        years={years}
        counts={counts}
        showDifficulty={canSeeDifficulty}
        gradedCount={
          canSeeDifficulty
            ? scopeSet.filter((p) => p.difficulty).length
            : undefined
        }
        sort={sort}
      />

      {visible.length === 0 ? (
        <p className="card p-10 text-center text-sm text-muted">
          Nicio problemă nu corespunde filtrelor.
        </p>
      ) : (
        <ul className="space-y-3">
          {pageItems.map((problem) => {
            const status =
              STATUS[
                solveState(
                  problem.solutions,
                  problem.attempts,
                  problem.aiMark,
                  now,
                )
              ];
            const due = aiPhase(problem.aiMark, now) === "due";
            const spine = subjectStyle(problem.exam.subject).spine;
            return (
              <li key={problem.id}>
                <Link href={problemHref(problem, ctxQuery)} className="block">
                  <article
                    className={`relative overflow-hidden rounded-2xl border-2 bg-card py-4 pl-6 pr-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift ${status.border}`}
                  >
                    <span
                      className={`absolute inset-y-0 left-0 w-1.5 ${spine}`}
                      aria-hidden
                    />
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <span className="font-display text-base font-bold">
                            {problem.number}
                          </span>
                          <span className="truncate text-xs text-faint">
                            {examLabel(problem.exam)}
                          </span>
                          {canSeeDifficulty && problem.difficulty && (
                            <DifficultyBadge
                              difficulty={problem.difficulty}
                              showTime
                            />
                          )}
                          {canSeeDifficulty && !problem.difficulty && (
                            <span className="text-[10px] uppercase tracking-wide text-faint">
                              negradată
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 max-h-12 overflow-hidden text-sm text-ink/75">
                          <Statement latex={problem.latex} />
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.badge}`}
                        >
                          {status.label}
                        </span>
                        {due && (
                          <span className="rounded-full border border-rose-500 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                            de refăcut — AI
                          </span>
                        )}
                        {problem.tags.length > 0 && (
                          <div className="flex max-w-[13rem] flex-wrap justify-end gap-1">
                            {problem.tags.map((tag) => (
                              <span
                                key={tag.name}
                                className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-medium text-muted"
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between border-t border-line pt-4 text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(params, page - 1)}
              className="rounded-full border border-line bg-card px-3 py-1 font-medium text-muted shadow-soft transition-colors hover:border-ink/20 hover:text-ink"
            >
              ← anterioara
            </Link>
          ) : (
            <span className="rounded-full border border-line px-3 py-1 font-medium text-faint opacity-50">
              ← anterioara
            </span>
          )}
          <span className="tabular-nums text-muted">
            pagina {page} din {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(params, page + 1)}
              className="rounded-full border border-line bg-card px-3 py-1 font-medium text-muted shadow-soft transition-colors hover:border-ink/20 hover:text-ink"
            >
              următoarea →
            </Link>
          ) : (
            <span className="rounded-full border border-line px-3 py-1 font-medium text-faint opacity-50">
              următoarea →
            </span>
          )}
        </nav>
      )}

      {user?.isAdmin && <TaxonomyManager tags={managedTags} />}
    </div>
  );
}
