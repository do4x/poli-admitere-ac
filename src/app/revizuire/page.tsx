import Link from "next/link";
import { Statement } from "@/components/Statement";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aiPhase } from "@/lib/domain";
import { examLabel, formatDate, solutionIsImage } from "@/lib/format";
import { problemHref } from "@/lib/slug";
import { SolutionImage } from "../problems/[id]/SolutionImage";

export const dynamic = "force-dynamic";

/**
 * Revision stream: the user's own solutions, rendered large and grouped by
 * topic, for the last pass before the exam. Reading surface, not management —
 * uploads and deletes stay on the problem page.
 *
 * On wide screens each card splits in two: the statement on the left, the
 * solution on the right, so you can re-read the cerință while looking at your
 * own work instead of scrolling between them.
 *
 * Past-due AI solutions are hidden here exactly as they are on the problem
 * page (business rule 4): the 72h reset must not be escapable by a detour.
 */

const UNTAGGED = "Fără tip";

export default async function RevizuirePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const rawTag = params.tag;
  const activeTag = Array.isArray(rawTag) ? rawTag[0] : rawTag;

  const solutions = await prisma.solution.findMany({
    where: { userId: user.id },
    orderBy: { submittedAt: "desc" },
    relationLoadStrategy: "join",
    include: {
      problem: {
        omit: { correctAnswer: true },
        include: {
          exam: true,
          tags: { select: { name: true } },
          aiMarks: {
            where: { userId: user.id },
            select: { dueAt: true, redeemedAt: true },
          },
        },
      },
    },
  });

  const now = new Date();
  // Same visibility rule as the problem page: once an AI mark is past due and
  // unredeemed, its AI-assisted solutions disappear until redemption.
  const visible = solutions.filter((s) => {
    if (!s.aiAssisted) return true;
    return aiPhase(s.problem.aiMarks[0] ?? null, now) !== "due";
  });
  const hiddenCount = solutions.length - visible.length;

  const counts = new Map<string, number>();
  for (const s of visible) {
    const names = s.problem.tags.length
      ? s.problem.tags.map((t) => t.name)
      : [UNTAGGED];
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const chips = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ro"),
  );

  const shown = activeTag
    ? visible.filter((s) =>
        activeTag === UNTAGGED
          ? s.problem.tags.length === 0
          : s.problem.tags.some((t) => t.name === activeTag),
      )
    : visible;

  return (
    <div className="mx-auto max-w-[110rem] space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Revizuire
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Rezolvările tale, cu enunțul alături — pentru recapitularea finală.
          Încărcările și ștergerile rămân pe pagina problemei.
        </p>
      </header>

      {visible.length === 0 ? (
        <p className="card max-w-2xl p-5 text-sm text-muted">
          Nicio soluție de revizuit încă. Intră pe o problemă și încarcă un PDF
          sau o poză cu rezolvarea ta.
          {hiddenCount > 0 &&
            " (Soluțiile rezolvate cu AI sunt ascunse până le refaci singur.)"}
        </p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-1.5" aria-label="Filtrare pe tip">
            <Chip href="/revizuire" active={!activeTag}>
              Toate {visible.length}
            </Chip>
            {chips.map(([name, n]) => (
              <Chip
                key={name}
                href={`/revizuire?tag=${encodeURIComponent(name)}`}
                active={activeTag === name}
              >
                {name} {n}
              </Chip>
            ))}
          </nav>

          {hiddenCount > 0 && (
            <p className="text-xs text-muted">
              {hiddenCount === 1
                ? "O soluție cu AI este ascunsă"
                : `${hiddenCount} soluții cu AI sunt ascunse`}{" "}
              până refaci problema singur.
            </p>
          )}

          {shown.length === 0 ? (
            <p className="card max-w-2xl p-5 text-sm text-muted">
              Nicio soluție pentru tipul ăsta.
            </p>
          ) : (
            <div className="space-y-6">
              {shown.map((s) => (
                <article key={s.id} className="card space-y-4 p-4 xl:p-5">
                  <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-3">
                    <Link
                      href={problemHref(s.problem)}
                      className="font-display text-base font-bold hover:underline"
                    >
                      Problema {s.problem.number}
                    </Link>
                    <span className="text-xs text-faint">
                      {examLabel(s.problem.exam)}
                    </span>
                    {s.problem.tags.map((t) => (
                      <Link
                        key={t.name}
                        href={`/revizuire?tag=${encodeURIComponent(t.name)}`}
                        className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted transition-colors hover:border-ink/20 hover:text-ink"
                      >
                        {t.name}
                      </Link>
                    ))}
                    <div className="ml-auto flex shrink-0 items-center gap-2 text-xs">
                      <time className="tabular-nums text-faint">
                        {formatDate(s.submittedAt)}
                      </time>
                      {s.aiAssisted ? (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700">
                          cu AI
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">
                          singur
                        </span>
                      )}
                    </div>
                  </header>

                  <div className="grid gap-5 xl:grid-cols-[minmax(20rem,32rem)_minmax(0,1fr)]">
                    <div className="min-w-0 overflow-x-auto text-sm leading-relaxed">
                      <Statement latex={s.problem.latex} />
                    </div>

                    <div className="min-w-0">
                      {solutionIsImage(s.pdfPath) ? (
                        <SolutionImage
                          src={`/api/solutions/${s.id}`}
                          alt={`Rezolvarea ta la problema ${s.problem.number}`}
                          heightClass="max-h-[36rem] xl:max-h-[52rem]"
                        />
                      ) : (
                        <iframe
                          src={`/api/solutions/${s.id}`}
                          title={`Rezolvarea ta la problema ${s.problem.number}`}
                          className="h-[36rem] w-full rounded-xl border border-line xl:h-[52rem]"
                        />
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-colors ${
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-card text-muted shadow-soft hover:border-ink/20 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
