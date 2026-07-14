import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { examLabel, formatDate, solutionIsImage } from "@/lib/format";
import { deleteAccountAction } from "./actions";

export const dynamic = "force-dynamic";

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export default async function ContPage() {
  const user = await requireUser();
  const solutions = await prisma.solution.findMany({
    where: { userId: user.id },
    orderBy: { submittedAt: "desc" },
    include: {
      problem: { omit: { correctAnswer: true }, include: { exam: true } },
    },
  });
  const totalBytes = solutions.reduce((sum, s) => sum + s.sizeBytes, 0);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        Cont
      </h1>

      <section className="card space-y-2 p-5 text-sm">
        <p>
          <span className="text-muted">Email:</span>{" "}
          <span className="font-medium">{user.email}</span>
          {user.isAdmin && (
            <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              admin
            </span>
          )}
        </p>
        <p className="text-muted">
          Soluții încărcate: {solutions.length} fișiere (
          {formatMB(totalBytes)} MB din 500 MB).
        </p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold text-ink">
          Soluțiile mele ({solutions.length})
        </h2>
        {solutions.length === 0 ? (
          <p className="text-sm text-muted">
            Nicio soluție încărcată încă. Intră pe o problemă și încarcă un PDF
            sau o poză cu rezolvarea ta.
          </p>
        ) : (
          <ul className="space-y-2">
            {solutions.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-line p-2"
              >
                <a
                  href={`/api/solutions/${s.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Deschide fișierul"
                  className="shrink-0"
                >
                  {solutionIsImage(s.pdfPath) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Storage URL behind a redirect
                    <img
                      src={`/api/solutions/${s.id}`}
                      alt=""
                      className="h-12 w-12 rounded-lg border border-line object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-surface text-[10px] font-bold text-muted">
                      PDF
                    </span>
                  )}
                </a>
                <Link href={`/problems/${s.problemId}`} className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">
                    Problema {s.problem.number}
                  </div>
                  <div className="truncate text-xs text-faint">
                    {examLabel(s.problem.exam)}
                  </div>
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="font-semibold text-ink">Date & confidențialitate</h2>
        <p className="text-muted">
          Stocăm doar adresa ta de email, fișierele cu soluții pe care le
          încarci (PDF sau poze) și încercările tale la grilă. Fișierele sunt
          private — doar tu le poți accesa. Nu există tracking, reclame sau alte
          terțe părți în afară de infrastructura de găzduire (Supabase, Vercel)
          și emailul de notificare (Resend). Ștergerea contului elimină imediat
          și definitiv toate aceste date.
        </p>
      </section>

      <section className="card space-y-3 border-rose-200 p-5 text-sm">
        <h2 className="font-semibold text-rose-700">Șterge contul</h2>
        <p className="text-muted">
          Se șterg definitiv: contul, toate fișierele încărcate și istoricul de
          grilă. Nu există recuperare.
        </p>
        <form action={deleteAccountAction} className="space-y-3">
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" required className="h-4 w-4" />
            Înțeleg că ștergerea este permanentă.
          </label>
          <button
            type="submit"
            className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
          >
            Șterge contul definitiv
          </button>
        </form>
      </section>
    </div>
  );
}
