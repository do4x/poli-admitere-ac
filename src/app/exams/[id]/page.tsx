import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { examProgress, hasIndependentSolution } from "@/lib/domain";
import { examLabel, problemNumberCompare } from "@/lib/format";
import { toggleDepartajare } from "./actions";

export const dynamic = "force-dynamic";

export default async function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      problems: {
        include: { solutions: { select: { aiAssisted: true } } },
      },
    },
  });
  if (!exam) notFound();

  const problems = [...exam.problems].sort((a, b) =>
    problemNumberCompare(a.number, b.number),
  );
  const progress = examProgress(problems);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/exams" className="text-sm text-stone-500 hover:text-stone-900">
          ← Examene
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{examLabel(exam)}</h1>
        <p className="text-sm text-stone-600">
          Departajare rezolvate singur: {progress.done}/{progress.total}
        </p>
      </div>

      <ul className="space-y-2">
        {problems.map((problem) => {
          const done = hasIndependentSolution(problem);
          return (
            <li
              key={problem.id}
              className={`flex items-center gap-4 rounded border bg-white p-3 ${
                problem.isDepartajare
                  ? "border-amber-500 border-l-4"
                  : "border-stone-300"
              }`}
            >
              <Link
                href={`/problems/${problem.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 hover:underline"
              >
                <span className="w-12 shrink-0 font-bold">{problem.number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-stone-600">
                  {problem.latex}
                </span>
              </Link>
              <span className="shrink-0 text-xs text-stone-500">
                {problem.solutions.length} sol.
              </span>
              {done ? (
                <span className="shrink-0 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                  rezolvată
                </span>
              ) : (
                <span className="shrink-0 rounded bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-600">
                  de rezolvat
                </span>
              )}
              <form action={toggleDepartajare.bind(null, problem.id)}>
                <button
                  type="submit"
                  className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${
                    problem.isDepartajare
                      ? "border-amber-600 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-stone-300 text-stone-400 hover:bg-stone-100"
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
