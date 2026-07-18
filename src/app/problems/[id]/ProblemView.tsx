import Link from "next/link";
import { notFound } from "next/navigation";
import { Statement } from "@/components/Statement";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  aiPhase,
  grilaCountsAsDone,
  solveState,
  type SolveState,
} from "@/lib/domain";
import { examLabel, formatDateTime, solutionIsImage } from "@/lib/format";
import { examHref } from "@/lib/slug";
import { subjectStyle } from "@/lib/subjects";
import { AiMarkControl } from "./AiMarkControl";
import { DeleteSolutionButton } from "./DeleteSolutionButton";
import { GrilaCheck } from "./GrilaCheck";
import { resolveNeighbors } from "./resolveNeighbors";
import { SolutionImage } from "./SolutionImage";
import { TagEditor } from "./TagEditor";
import { UploadForm } from "./UploadForm";

const STATUS: Record<SolveState, { badge: string; label: string }> = {
  nerezolvata: { badge: "bg-rose-100 text-rose-700", label: "nerezolvată" },
  grila: { badge: "bg-teal-100 text-teal-700", label: "verificată pe grilă" },
  doar_ai: { badge: "bg-orange-100 text-orange-700", label: "doar cu AI" },
  singur: { badge: "bg-green-100 text-green-700", label: "rezolvată singur" },
};

/**
 * The problem page body, shared by the canonical slug route
 * (/pb1-mate/preadmitere/2026) — the old /problems/{id} route 308-redirects
 * there. `searchParams` must arrive already awaited.
 */
export async function ProblemView({
  problemId,
  searchParams: sp,
}: {
  problemId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUser();
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
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

  const { prev, next } = await resolveNeighbors(
    problem.id,
    problem.exam,
    user?.id,
    sp,
  );

  const subjectTags = await prisma.tag.findMany({
    where: { subject: problem.exam.subject },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const attachedIds = new Set(problem.tags.map((t) => t.id));
  const availableTags = subjectTags.filter((t) => !attachedIds.has(t.id));

  const aiMark = user
    ? await prisma.aiMark.findUnique({
        where: {
          problemId_userId: { problemId: problem.id, userId: user.id },
        },
        select: { dueAt: true, redeemedAt: true },
      })
    : null;
  const now = new Date();
  const state = solveState(problem.solutions, problem.attempts, aiMark, now);
  const phase = aiPhase(aiMark, now);
  // Past-due AI solutions hide until the problem is re-solved (redemption).
  const visibleSolutions =
    phase === "due"
      ? problem.solutions.filter((s) => !s.aiAssisted)
      : problem.solutions;
  const hiddenAiCount = problem.solutions.length - visibleSolutions.length;
  const status = STATUS[state];
  const subject = subjectStyle(problem.exam.subject);

  // Grila data: the key is fetched separately and stays server-side; it is
  // passed to the client ONLY after the user explicitly revealed it.
  const keyRow = await prisma.problem.findUnique({
    where: { id: problem.id },
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
            href={examHref(problem.exam)}
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            ← {examLabel(problem.exam)}
          </Link>
          {(prev || next) && (
            <div className="flex shrink-0 items-center gap-2">
              {prev && (
                <Link
                  href={prev.href}
                  title={
                    prev.scope === "filter"
                      ? "Problema anterioară din filtrul curent"
                      : "Problema anterioară din examen"
                  }
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-semibold text-brand shadow-soft transition-colors hover:border-brand hover:text-brand-700"
                >
                  <span aria-hidden>←</span>
                  Problema anterioară
                </Link>
              )}
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
          {phase === "due" && (
            <span className="rounded-full border border-rose-500 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
              de refăcut — AI
            </span>
          )}
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

      {phase === "due" && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-800 shadow-soft">
          <p className="font-semibold">
            Au trecut 72 de ore de când ai rezolvat-o cu AI — statutul s-a
            resetat.
          </p>
          <p className="mt-1">
            Rezolv-o acum corect la grilă (indiferent din câte încercări, dar
            fără să vezi răspunsul) sau încarcă propria rezolvare — abia atunci
            contează
            {hiddenAiCount > 0
              ? ", iar rezolvarea încărcată atunci reapare."
              : "."}
          </p>
        </section>
      )}

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
          countsTowardGoal={
            grilaCountsAsDone(problem.attempts) || aiMark?.redeemedAt != null
          }
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
          Soluții ({visibleSolutions.length})
        </h2>
        {hiddenAiCount > 0 && (
          <p className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-700">
            {hiddenAiCount === 1
              ? "O soluție rezolvată cu AI este ascunsă"
              : `${hiddenAiCount} soluții rezolvate cu AI sunt ascunse`}{" "}
            până rezolvi problema corect — apoi reapare aici.
          </p>
        )}
        {visibleSolutions.length === 0 && hiddenAiCount === 0 && (
          <p className="text-sm text-muted">Nicio soluție încărcată încă.</p>
        )}
        {visibleSolutions.map((solution) => {
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
                {solution.aiAssisted && phase === "window" && aiMark && !done && (
                  <span className="text-xs text-rose-600">
                    de refăcut singur până la {formatDateTime(aiMark.dueAt)}
                  </span>
                )}
                <DeleteSolutionButton solutionId={solution.id} />
              </header>
              {solutionIsImage(solution.pdfPath) ? (
                <SolutionImage
                  src={`/api/solutions/${solution.id}`}
                  alt={`Soluție din ${formatDateTime(solution.submittedAt)}`}
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
        {state !== "singur" && (phase === null || phase === "window") && (
          <AiMarkControl
            problemId={problem.id}
            dueLabel={
              phase === "window" && aiMark ? formatDateTime(aiMark.dueAt) : null
            }
            canUnmark={
              phase === "window" &&
              !problem.solutions.some((s) => s.aiAssisted)
            }
          />
        )}
        <UploadForm problemId={problem.id} />
      </section>
      )}

      {user?.isAdmin && (
        <TagEditor
          problemId={problem.id}
          tags={problem.tags}
          available={availableTags}
        />
      )}
    </div>
  );
}
