import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Landing } from "./Landing";
import {
  dueSolutions,
  examProgress,
  grilaCountsAsDone,
  remainingCount,
  solveState,
} from "@/lib/domain";
import { examLabel, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Personal workspace for members; the public landing page for visitors.
  const user = await getSessionUser();
  if (!user) return <Landing />;

  const now = new Date();
  const [problems, recentSolutions] = await Promise.all([
    prisma.problem.findMany({
      omit: { correctAnswer: true }, // the key never leaves the server actions
      // Single joined query instead of one round-trip per relation — see
      // src/app/probleme/query.ts for why this matters over the pooled
      // connection.
      relationLoadStrategy: "join",
      include: {
        exam: true,
        solutions: { where: { userId: user.id } },
        attempts: {
          where: { userId: user.id },
          select: { kind: true, correct: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.solution.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: "desc" },
      take: 8,
      include: { problem: { include: { exam: true } } },
    }),
  ]);

  const remaining = remainingCount(problems);
  const totalDepartajare = problems.filter((p) => p.isDepartajare).length;
  const doneDepartajare = totalDepartajare - remaining;
  const grilaProblems = problems.filter(
    (p) =>
      p.isDepartajare && solveState(p.solutions, p.attempts) === "grila",
  );
  // Only 1st/2nd-try checks count as done; 3+ tries = guessed, still remaining.
  const grilaVerified = grilaProblems.filter((p) =>
    grilaCountsAsDone(p.attempts),
  ).length;
  const grilaGuessed = grilaProblems.length - grilaVerified;
  const percentDone =
    totalDepartajare === 0
      ? 0
      : Math.round((doneDepartajare / totalDepartajare) * 100);

  const dueByProblem = new Map<
    string,
    { problem: (typeof problems)[number]; dueAt: Date }
  >();
  for (const item of dueSolutions(problems, now)) {
    const dueAt = item.solution.reviewDueAt;
    if (dueAt === null) continue;
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
    <div className="space-y-6">
      {dueQueue.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/80 shadow-soft">
          <div className="flex items-center gap-2 border-b border-rose-200 px-5 py-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-600 text-xs font-bold text-white">
              !
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wide text-rose-700">
              De rezolvat singur — termen depășit
            </h2>
          </div>
          <ul className="divide-y divide-rose-100">
            {dueQueue.map(({ problem, dueAt }) => (
              <li key={problem.id}>
                <Link
                  href={`/problems/${problem.id}`}
                  className="flex items-baseline justify-between px-5 py-2.5 text-sm transition-colors hover:bg-rose-100/60"
                >
                  <span className="font-medium text-rose-900">
                    Problema {problem.number} — {examLabel(problem.exam)}
                  </span>
                  <span className="text-xs text-rose-500">
                    scadent {formatDateTime(dueAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="hero-mesh relative overflow-hidden rounded-2xl border border-line shadow-soft">
        <div className="px-8 py-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Probleme de departajare rămase
          </p>
          <div
            className={`font-display mt-3 text-8xl font-extrabold tabular-nums leading-none tracking-tight ${
              remaining === 0 ? "text-green-600" : "text-ink"
            }`}
          >
            {remaining}
          </div>
          <p className="mt-3 text-sm text-muted">
            rezolvate singur sau verificate pe grilă din cel mult 2 încercări —
            ținta este{" "}
            <span className="font-semibold text-ink">0</span> până la 24 iulie
            2026
          </p>

          <div className="mx-auto mt-7 max-w-md">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
              <span>
                {doneDepartajare} din {totalDepartajare} rezolvate
              </span>
              <span className="tabular-nums">{percentDone}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full transition-all ${
                  percentDone === 100
                    ? "bg-green-500"
                    : "bg-gradient-to-r from-brand to-violet-500"
                }`}
                style={{ width: `${percentDone}%` }}
              />
            </div>
            {grilaVerified > 0 && (
              <p className="mt-2 text-xs text-teal-700">
                din care {grilaVerified} verificate doar pe grilă (fără rezolvare
                scrisă)
              </p>
            )}
            {grilaGuessed > 0 && (
              <p className="mt-1 text-xs text-amber-700">
                {grilaGuessed} verificate pe grilă din 3+ încercări — nu
                contează, rezolvă-le singur
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Progres pe ani</h2>
          {years.length === 0 && (
            <p className="text-sm text-muted">
              Niciun examen importat.{" "}
              <Link href="/import" className="font-medium text-brand hover:underline">
                Importă probleme
              </Link>
              .
            </p>
          )}
          <ul className="space-y-3.5">
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
                    <span className="tabular-nums text-muted">
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full rounded-full ${
                        percent === 100
                          ? "bg-green-500"
                          : "bg-gradient-to-r from-brand to-violet-500"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Soluții recente</h2>
          {recentSolutions.length === 0 && (
            <p className="text-sm text-muted">
              Nicio soluție încărcată încă.
            </p>
          )}
          <ul className="space-y-1">
            {recentSolutions.map((solution) => (
              <li key={solution.id}>
                <Link
                  href={`/problems/${solution.problemId}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface"
                >
                  <time className="shrink-0 tabular-nums text-xs text-faint">
                    {formatDateTime(solution.submittedAt)}
                  </time>
                  <span className="min-w-0 flex-1 truncate">
                    Problema {solution.problem.number} —{" "}
                    {examLabel(solution.problem.exam)}
                  </span>
                  {solution.aiAssisted ? (
                    <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700">
                      AI
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">
                      singur
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
