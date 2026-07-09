import Link from "next/link";
import { prisma } from "@/lib/db";
import { dueSolutions, examProgress, remainingCount } from "@/lib/domain";
import { examLabel, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const [problems, recentSolutions] = await Promise.all([
    prisma.problem.findMany({
      include: { exam: true, solutions: true },
    }),
    prisma.solution.findMany({
      orderBy: { submittedAt: "desc" },
      take: 8,
      include: { problem: { include: { exam: true } } },
    }),
  ]);

  const remaining = remainingCount(problems);

  // One row per problem in the due queue, keyed on the earliest due solution.
  const dueByProblem = new Map<
    string,
    { problem: (typeof problems)[number]; dueAt: Date }
  >();
  for (const item of dueSolutions(problems, now)) {
    const dueAt = item.solution.reviewDueAt;
    if (dueAt === null) continue; // dueSolutions never returns these
    const current = dueByProblem.get(item.problem.id);
    if (!current || dueAt < current.dueAt) {
      dueByProblem.set(item.problem.id, { problem: item.problem, dueAt });
    }
  }
  const dueQueue = [...dueByProblem.values()].sort(
    (a, b) => a.dueAt.getTime() - b.dueAt.getTime(),
  );

  const years = [...new Set(problems.map((p) => p.exam.year))].sort(
    (a, b) => b - a,
  );

  return (
    <div className="space-y-8">
      {dueQueue.length > 0 && (
        <section className="rounded border border-red-300 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-red-700">
            De rezolvat singur — termen depășit
          </h2>
          <ul className="space-y-1">
            {dueQueue.map(({ problem, dueAt }) => (
              <li key={problem.id} className="text-sm">
                <Link
                  href={`/problems/${problem.id}`}
                  className="font-medium text-red-800 underline hover:text-red-600"
                >
                  Problema {problem.number} — {examLabel(problem.exam)}
                </Link>{" "}
                <span className="text-red-600">
                  (scadent {formatDateTime(dueAt)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded border border-stone-300 bg-white p-8 text-center">
        <div
          className={`text-8xl font-black tabular-nums tracking-tight ${
            remaining === 0 ? "text-green-600" : "text-stone-900"
          }`}
        >
          {remaining}
        </div>
        <p className="mt-2 text-sm uppercase tracking-wide text-stone-500">
          probleme de departajare rămase
        </p>
        <p className="mt-1 text-xs text-stone-400">
          rezolvate singur, fără AI — ținta: 0 până la 24 iulie 2026
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded border border-stone-300 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Progres pe ani
          </h2>
          {years.length === 0 && (
            <p className="text-sm text-stone-500">
              Niciun examen importat.{" "}
              <Link href="/import" className="underline">
                Importă probleme
              </Link>
              .
            </p>
          )}
          <ul className="space-y-3">
            {years.map((year) => {
              const yearProblems = problems.filter((p) => p.exam.year === year);
              const progress = examProgress(yearProblems);
              const percent =
                progress.total === 0
                  ? 0
                  : Math.round((progress.done / progress.total) * 100);
              return (
                <li key={year}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{year}</span>
                    <span className="tabular-nums text-stone-600">
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-stone-200">
                    <div
                      className={`h-full ${
                        percent === 100 ? "bg-green-600" : "bg-stone-700"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded border border-stone-300 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Soluții recente
          </h2>
          {recentSolutions.length === 0 && (
            <p className="text-sm text-stone-500">Nicio soluție încărcată.</p>
          )}
          <ul className="space-y-2">
            {recentSolutions.map((solution) => (
              <li key={solution.id} className="flex items-center gap-2 text-sm">
                <time className="shrink-0 tabular-nums text-stone-500">
                  {formatDateTime(solution.submittedAt)}
                </time>
                <Link
                  href={`/problems/${solution.problemId}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  Problema {solution.problem.number} —{" "}
                  {examLabel(solution.problem.exam)}
                </Link>
                {solution.aiAssisted && (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold uppercase text-amber-800">
                    AI
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
