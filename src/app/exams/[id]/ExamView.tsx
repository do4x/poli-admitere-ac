import Link from "next/link";
import { notFound } from "next/navigation";
import { Statement } from "@/components/Statement";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { examProgress, solveState, type SolveState } from "@/lib/domain";
import { examLabel, problemNumberCompare } from "@/lib/format";
import { problemHref } from "@/lib/slug";
import { toggleDepartajare } from "./actions";

export const dynamic = "force-dynamic";

const SUBJECT_SPINE: Record<string, string> = {
  MATE: "bg-blue-500",
  INFO: "bg-violet-500",
};

const STATUS: Record<SolveState, { border: string; badge: string; label: string }> = {
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

/**
 * The exam page body, shared by the canonical slug route
 * (/mate/preadmitere/2026) — the old /exams/{id} route 308-redirects there.
 */
export async function ExamView({ examId }: { examId: string }) {
  const user = await getSessionUser();
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      problems: {
        omit: { correctAnswer: true }, // the key never leaves the server actions
        include: {
          solutions: {
            where: { userId: user?.id ?? "" },
            select: { aiAssisted: true },
          },
          attempts: {
            where: { userId: user?.id ?? "" },
            select: { kind: true, correct: true },
            orderBy: { createdAt: "asc" },
          },
          aiMarks: {
            where: { userId: user?.id ?? "" },
            select: { dueAt: true, redeemedAt: true },
          },
        },
      },
    },
  });
  if (!exam) notFound();

  const now = new Date();
  const problems = [...exam.problems]
    .map(({ aiMarks, ...problem }) => ({
      ...problem,
      aiMark: aiMarks[0] ?? null,
    }))
    .sort((a, b) => problemNumberCompare(a.number, b.number));
  const progress = examProgress(problems, now);
  const spine = SUBJECT_SPINE[exam.subject] ?? "bg-stone-400";

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/exams"
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          ← Examene
        </Link>
        <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight">
          {examLabel(exam)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Departajare rezolvate (singur sau pe grilă):{" "}
          <span className="font-semibold text-ink tabular-nums">
            {progress.done}/{progress.total}
          </span>
        </p>
      </div>

      <ul className="space-y-3">
        {problems.map((problem) => {
          const status =
            STATUS[
              solveState(problem.solutions, problem.attempts, problem.aiMark, now)
            ];
          return (
            <li
              key={problem.id}
              className={`relative flex items-center gap-4 overflow-hidden rounded-2xl border-2 bg-card py-3 pl-6 pr-4 shadow-soft ${status.border}`}
            >
              {problem.isDepartajare && (
                <span
                  className={`absolute inset-y-0 left-0 w-1.5 ${spine}`}
                  aria-hidden
                />
              )}
              <Link
                href={problemHref(
                  { number: problem.number, exam },
                  "from=exam",
                )}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="font-display w-12 shrink-0 font-bold">
                  {problem.number}
                </span>
                <div className="min-w-0 max-h-12 flex-1 overflow-hidden line-clamp-2 text-sm text-muted [&_.katex-display]:my-0 [&_.katex-display]:inline [&_.katex]:text-[0.95em] [&_p]:my-0 [&_p]:inline [&_pre]:my-0">
                  <Statement latex={problem.latex} />
                </div>
              </Link>
              <span className="shrink-0 text-xs text-faint tabular-nums">
                {problem.solutions.length} sol.
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.badge}`}
              >
                {status.label}
              </span>
              {user?.isAdmin ? (
                <form action={toggleDepartajare.bind(null, problem.id)}>
                  <button
                    type="submit"
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                      problem.isDepartajare
                        ? "border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "border-line text-faint hover:bg-surface hover:text-ink"
                    }`}
                    title={
                      problem.isDepartajare
                        ? "Scoate din departajare"
                        : "Marchează ca departajare"
                    }
                  >
                    departajare
                  </button>
                </form>
              ) : (
                problem.isDepartajare && (
                  <span className="shrink-0 rounded-full border border-amber-500 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    departajare
                  </span>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
