import Link from "next/link";
import { notFound } from "next/navigation";
import { Statement } from "@/components/Statement";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { solveState, type SolveState } from "@/lib/domain";
import { examLabel, formatDateTime, solutionIsImage } from "@/lib/format";
import { GrilaCheck } from "./GrilaCheck";
import { PaintCanvas } from "./PaintCanvas";
import { resolveNext } from "./resolveNext";
import { TagEditor } from "./TagEditor";
import { UploadForm } from "./UploadForm";

const STATUS: Record<SolveState, { badge: string; label: string }> = {
  nerezolvata: { badge: "bg-rose-100 text-rose-700", label: "nerezolvată" },
  grila: { badge: "bg-teal-100 text-teal-700", label: "verificată pe grilă" },
  doar_ai: { badge: "bg-orange-100 text-orange-700", label: "doar cu AI" },
  singur: { badge: "bg-green-100 text-green-700", label: "rezolvată singur" },
};

const SUBJECT: Record<string, { dot: string; label: string }> = {
  MATE: { dot: "bg-blue-500", label: "Matematică" },
  INFO: { dot: "bg-violet-500", label: "Informatică" },
};

export default async function ProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getSessionUser();
  const problem = await prisma.problem.findUnique({
    where: { id },
    omit: { correctAnswer: true }, // the key never leaves the server actions
    include: {
      exam: true,
      tags: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      solutions: {
        where: { userId: user?.id ?? "" },
        orderBy: { submittedAt: "asc" },
      },
      attempts: {
        where: { userId: user?.id ?? "" },
        select: { id: true, kind: true, choice: true, correct: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!problem) notFound();

  const next = await resolveNext(problem.id, problem.examId, user?.id, sp);

  const subjectTags = await prisma.tag.findMany({
    where: { subject: problem.exam.subject },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const attachedIds = new Set(problem.tags.map((t) => t.id));
  const availableTags = subjectTags.filter((t) => !attachedIds.has(t.id));

  const state = solveState(problem.solutions, problem.attempts);
  const status = STATUS[state];
  const subject = SUBJECT[problem.exam.subject];

  // Grila data: the key is fetched separately and stays server-side; it is
  // passed to the client ONLY after the user explicitly revealed it.
  const keyRow = await prisma.problem.findUnique({
    where: { id },
    select: { correctAnswer: true },
  });
  const hasKey = keyRow?.correctAnswer != null;
  const revealed = problem.attempts.some((a) => a.kind === "REVEAL");
  const grilaHistory = problem.attempts
    .filter((a) => a.kind === "CHOICE" && a.choice !== null)
    .map((a) => ({ id: a.id, choice: a.choice as string, correct: a.correct === true }));

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/exams/${problem.examId}`}
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            ← {examLabel(problem.exam)}
          </Link>
          {next && (
            <Link
              href={next.href}
              title={
                next.scope === "filter"
                  ? "Următoarea din filtrul curent"
                  : "Următoarea din examen"
              }
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-semibold text-brand shadow-soft transition-colors hover:border-brand hover:text-brand-700"
            >
              Următoarea problemă
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Problema {problem.number}
          </h1>
          {subject && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-0.5 text-xs font-medium text-muted">
              <span className={`h-2 w-2 rounded-full ${subject.dot}`} />
              {subject.label}
            </span>
          )}
          {problem.isDepartajare && (
            <span className="rounded-full border border-amber-500 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
              departajare
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.badge}`}
          >
            {status.label}
          </span>
          {problem.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-muted"
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>

      <section className="card p-6">
        <Statement latex={problem.latex} />
      </section>

      {hasKey && !user && (
        <section className="card flex flex-col items-start gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-ink">Verificare grilă</h2>
          <Link
            href="/login"
            className="text-sm font-semibold text-brand transition-colors hover:text-brand-700"
          >
            Autentifică-te pentru a-ți verifica răspunsul →
          </Link>
        </section>
      )}
      {hasKey && user ? (
        <GrilaCheck
          problemId={problem.id}
          verified={state === "grila"}
          history={grilaHistory}
          revealedAnswer={revealed ? (keyRow?.correctAnswer ?? null) : null}
        />
      ) : !hasKey ? (
        <section className="card flex flex-col items-start gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-ink">Verificare grilă</h2>
          <p className="text-xs text-faint">
            Răspunsul oficial nu a fost încă importat pentru această problemă.
          </p>
        </section>
      ) : null}

      {user && (
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">
          Soluții ({problem.solutions.length})
        </h2>
        {problem.solutions.length === 0 && (
          <p className="text-sm text-muted">Nicio soluție încărcată încă.</p>
        )}
        {problem.solutions.map((solution) => {
          const done = state === "singur";
          return (
            <article key={solution.id} className="card p-4">
              <header className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                <time className="font-medium tabular-nums">
                  {formatDateTime(solution.submittedAt)}
                </time>
                {solution.aiAssisted ? (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700">
                    cu AI
                  </span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">
                    independent
                  </span>
                )}
                {solution.aiAssisted && solution.reviewDueAt && !done && (
                  <span className="text-xs text-rose-600">
                    de refăcut singur până la {formatDateTime(solution.reviewDueAt)}
                  </span>
                )}
              </header>
              {solutionIsImage(solution.pdfPath) ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Storage URL behind a redirect; next/image can't cache it
                <img
                  src={`/api/solutions/${solution.id}`}
                  alt={`Soluție din ${formatDateTime(solution.submittedAt)}`}
                  className="max-h-[36rem] w-full rounded-xl border border-line object-contain"
                />
              ) : (
                <iframe
                  src={`/api/solutions/${solution.id}`}
                  title={`Soluție din ${formatDateTime(solution.submittedAt)}`}
                  className="h-[36rem] w-full rounded-xl border border-line"
                />
              )}
            </article>
          );
        })}
        <UploadForm problemId={problem.id} />
        <PaintCanvas problemId={problem.id} />
      </section>
      )}

      {user?.isAdmin && (
        <TagEditor
          problemId={problem.id}
          tags={problem.tags}
          available={availableTags}
        />
      )}

      {next && (
        <div className="flex justify-end pt-1">
          <Link
            href={next.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
          >
            Următoarea problemă
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
