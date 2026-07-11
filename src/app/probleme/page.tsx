import Link from "next/link";
import { Statement } from "@/components/Statement";
import { prisma } from "@/lib/db";
import {
  matchesFilters,
  solveState,
  tagCounts,
  type ProblemFilters,
  type SolveState,
} from "@/lib/domain";
import { examLabel, problemNumberCompare } from "@/lib/format";
import { FilterBar } from "./FilterBar";
import { TaxonomyManager } from "./TaxonomyManager";
import { parseFilters } from "./searchFilters";

export const dynamic = "force-dynamic";

// Left spine = subject; card outline + status badge = solve state.
const SUBJECT_SPINE: Record<string, string> = {
  MATE: "bg-blue-500",
  INFO: "bg-violet-500",
};

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

  const [problems, allTags] = await Promise.all([
    prisma.problem.findMany({
      omit: { correctAnswer: true }, // the key never leaves the server actions
      include: {
        exam: true,
        tags: { select: { name: true } },
        solutions: { select: { aiAssisted: true } },
        attempts: {
          select: { kind: true, correct: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.tag.findMany({
      select: { id: true, name: true, subject: true },
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
    attempts: p.attempts,
  });

  const visible = problems
    .filter((p) => matchesFilters(filterable(p), domainFilters))
    .sort(
      (a, b) =>
        b.exam.year - a.exam.year || problemNumberCompare(a.number, b.number),
    );

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
    <div className="space-y-5">
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
      />

      {visible.length === 0 ? (
        <p className="card p-10 text-center text-sm text-muted">
          Nicio problemă nu corespunde filtrelor.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((problem) => {
            const status = STATUS[solveState(problem.solutions, problem.attempts)];
            const spine = SUBJECT_SPINE[problem.exam.subject] ?? "bg-stone-400";
            return (
              <li key={problem.id}>
                <Link href={`/problems/${problem.id}`} className="block">
                  <article
                    className={`relative overflow-hidden rounded-2xl border-2 bg-card py-4 pl-6 pr-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift ${status.border}`}
                  >
                    <span
                      className={`absolute inset-y-0 left-0 w-1.5 ${spine}`}
                      aria-hidden
                    />
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-display text-base font-bold">
                            {problem.number}
                          </span>
                          <span className="truncate text-xs text-faint">
                            {examLabel(problem.exam)}
                          </span>
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

      <TaxonomyManager tags={managedTags} />
    </div>
  );
}
