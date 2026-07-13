import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteAccountAction } from "./actions";

export const dynamic = "force-dynamic";

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export default async function ContPage() {
  const user = await requireUser();
  const usage = await prisma.solution.aggregate({
    where: { userId: user.id },
    _count: true,
    _sum: { sizeBytes: true },
  });

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
          Soluții încărcate: {usage._count} PDF-uri (
          {formatMB(usage._sum.sizeBytes ?? 0)} MB din 500 MB).
        </p>
      </section>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="font-semibold text-ink">Date & confidențialitate</h2>
        <p className="text-muted">
          Stocăm doar adresa ta de email, PDF-urile cu soluții pe care le
          încarci și încercările tale la grilă. PDF-urile sunt private — doar
          tu le poți accesa. Nu există tracking, reclame sau alte terțe părți
          în afară de infrastructura de găzduire (Supabase, Vercel) și emailul
          de notificare (Resend). Ștergerea contului elimină imediat și
          definitiv toate aceste date.
        </p>
      </section>

      <section className="card space-y-3 border-rose-200 p-5 text-sm">
        <h2 className="font-semibold text-rose-700">Șterge contul</h2>
        <p className="text-muted">
          Se șterg definitiv: contul, toate PDF-urile încărcate și istoricul
          de grilă. Nu există recuperare.
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
