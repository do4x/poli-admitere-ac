import Link from "next/link";
import { notFound } from "next/navigation";
import { Statement } from "@/components/Statement";
import { prisma } from "@/lib/db";
import { hasIndependentSolution } from "@/lib/domain";
import { examLabel, formatDateTime } from "@/lib/format";
import { TagEditor } from "./TagEditor";
import { UploadForm } from "./UploadForm";

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = await prisma.problem.findUnique({
    where: { id },
    include: {
      exam: true,
      tags: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      solutions: { orderBy: { submittedAt: "asc" } },
    },
  });
  if (!problem) notFound();

  const subjectTags = await prisma.tag.findMany({
    where: { subject: problem.exam.subject },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const attachedIds = new Set(problem.tags.map((t) => t.id));
  const availableTags = subjectTags.filter((t) => !attachedIds.has(t.id));

  const done = hasIndependentSolution(problem);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/exams/${problem.examId}`}
          className="text-sm text-stone-500 hover:text-stone-900"
        >
          ← {examLabel(problem.exam)}
        </Link>
        <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold">
          Problema {problem.number}
          {problem.isDepartajare && (
            <span className="rounded border border-amber-600 bg-amber-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
              departajare
            </span>
          )}
          {done ? (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
              rezolvată singur
            </span>
          ) : (
            <span className="rounded bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-600">
              nerezolvată singur
            </span>
          )}
        </h1>
      </div>

      <div className="rounded border border-stone-200 bg-stone-50 p-3">
        <TagEditor
          problemId={problem.id}
          tags={problem.tags}
          available={availableTags}
        />
      </div>

      <section className="rounded border border-stone-300 bg-white p-4">
        <Statement latex={problem.latex} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Soluții ({problem.solutions.length})
        </h2>
        {problem.solutions.length === 0 && (
          <p className="text-sm text-stone-500">Nicio soluție încărcată încă.</p>
        )}
        {problem.solutions.map((solution) => (
          <article
            key={solution.id}
            className="rounded border border-stone-300 bg-white p-4"
          >
            <header className="mb-2 flex items-center gap-3 text-sm">
              <time className="font-medium">
                {formatDateTime(solution.submittedAt)}
              </time>
              {solution.aiAssisted ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase text-amber-800">
                  cu AI
                </span>
              ) : (
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold uppercase text-green-800">
                  independent
                </span>
              )}
              {solution.aiAssisted && solution.reviewDueAt && !done && (
                <span className="text-xs text-red-600">
                  de refăcut singur până la {formatDateTime(solution.reviewDueAt)}
                </span>
              )}
            </header>
            <iframe
              src={`/api/solutions/${solution.id}`}
              title={`Soluție din ${formatDateTime(solution.submittedAt)}`}
              className="h-[36rem] w-full rounded border border-stone-200"
            />
          </article>
        ))}
        <UploadForm problemId={problem.id} />
      </section>
    </div>
  );
}
