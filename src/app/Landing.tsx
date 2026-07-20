import Link from "next/link";
import { prisma } from "@/lib/db";

const FEATURES: { glyph: string; tint: string; title: string; body: string }[] = [
  {
    glyph: "✓",
    tint: "bg-teal-100 text-teal-700",
    title: "Verificare instant pe grilă",
    body: "Alegi a)–f) și afli pe loc dacă e corect. Cheia oficială nu părăsește niciodată serverul.",
  },
  {
    glyph: "#",
    tint: "bg-brand-100 text-brand-700",
    title: "20 de tipuri de probleme",
    body: "Integrale, recurențe, combinatorică, grafuri — filtrezi exact ce vrei să exersezi azi.",
  },
  {
    glyph: "⇑",
    tint: "bg-violet-100 text-violet-700",
    title: "Soluțiile tale, private",
    body: "Încarci PDF-ul scris de mână. Doar tu îl vezi — un caiet de soluții organizat pe probleme.",
  },
  {
    glyph: "0",
    tint: "bg-amber-100 text-amber-700",
    title: "Contorul de departajare",
    body: "Problemele grele care fac diferența la admitere, numărate explicit până ajungi la zero.",
  },
  {
    glyph: "4z",
    tint: "bg-rose-100 text-rose-700",
    title: "Onest cu tine însuți",
    body: "Ai rezolvat cu AI? Primești 4 zile să o refaci singur — altfel nu se pune.",
  },
  {
    glyph: "∫",
    tint: "bg-blue-100 text-blue-700",
    title: "Enunțuri oficiale, randate frumos",
    body: "Matematică în KaTeX, cod C++ cu sintaxă evidențiată — subiectele reale, lizibile.",
  },
];

const LADDER: { label: string; badge: string; border: string; body: string }[] = [
  {
    label: "nerezolvată",
    badge: "bg-rose-100 text-rose-700",
    border: "border-rose-300",
    body: "Încă nu te-ai atins de ea.",
  },
  {
    label: "verificată pe grilă",
    badge: "bg-teal-100 text-teal-700",
    border: "border-teal-300",
    body: "Ai nimerit răspunsul corect, fără să-l fi văzut înainte.",
  },
  {
    label: "doar cu AI",
    badge: "bg-orange-100 text-orange-700",
    border: "border-orange-300",
    body: "Rezolvată cu ajutor — nu se pune încă.",
  },
  {
    label: "rezolvată singur",
    badge: "bg-green-100 text-green-700",
    border: "border-green-300",
    body: "Soluție scrisă de tine, cap-coadă. Asta contează.",
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "Răsfoiește liber",
    body: "Toate subiectele de Matematică și Informatică, organizate pe ani, sesiuni și tipuri — fără cont.",
  },
  {
    title: "Verifică-te pe grilă",
    body: "Îți faci cont, rezolvi pe caiet, alegi varianta și afli instant dacă gândirea ta a fost corectă.",
  },
  {
    title: "Încarcă soluția ta",
    body: "PDF-ul scris de mână devine dovada: problema e rezolvată singur, iar contorul scade.",
  },
];

export async function Landing() {
  const [problems, departajare, exams, tags, years] = await Promise.all([
    prisma.problem.count(),
    prisma.problem.count({ where: { isDepartajare: true } }),
    prisma.exam.count(),
    prisma.tag.count(),
    prisma.exam.findMany({ distinct: ["year"], select: { year: true } }),
  ]);

  const stats: { value: string; label: string }[] = [
    { value: String(problems), label: "probleme" },
    { value: String(departajare), label: "de departajare" },
    { value: String(exams), label: "examene" },
    { value: String(tags), label: "tipuri" },
    { value: `${years.length}`, label: "ani (2015–2026)" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-20 pb-8">
      {/* Hero */}
      <section className="mx-auto max-w-3xl space-y-6 pt-10 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted shadow-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Admitere UPB · 24 iulie 2026
        </p>
        <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Subiectele de admitere UPB.
          <br />
          <span className="text-brand">Rezolvate de tine, nu pentru tine.</span>
        </h1>
        <p className="mx-auto max-w-xl text-base text-muted sm:text-lg">
          Matematică și Informatică, 2015–2026: verificare instant pe grilă,
          filtre pe tipuri de probleme și caietul tău privat de soluții — cu
          termene care te țin cinstit.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
          >
            Creează cont gratuit
          </Link>
          <Link
            href="/probleme"
            className="rounded-xl border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink shadow-soft transition-colors hover:bg-surface"
          >
            Răsfoiește problemele →
          </Link>
        </div>
      </section>

      {/* Live stats */}
      <section aria-label="Statistici" className="hero-mesh card p-6 sm:p-8">
        <dl className="grid grid-cols-2 gap-6 text-center sm:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-1">
              <dd className="font-display text-3xl font-extrabold tracking-tight text-ink">
                {stat.value}
              </dd>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </section>

      {/* Features */}
      <section className="space-y-8">
        <div className="mx-auto max-w-2xl space-y-2 text-center">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Construit pentru pregătire serioasă
          </h2>
          <p className="text-sm text-muted sm:text-base">
            Fără gamification, fără zgomot — doar subiectele reale și progresul
            tău real.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="card space-y-3 p-5">
              <span
                aria-hidden
                className={`flex h-9 w-9 items-center justify-center rounded-xl font-display text-base font-bold ${feature.tint}`}
              >
                {feature.glyph}
              </span>
              <h3 className="font-semibold text-ink">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Solve ladder */}
      <section className="space-y-8">
        <div className="mx-auto max-w-2xl space-y-2 text-center">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Fiecare problemă are o stare. Doar una contează.
          </h2>
          <p className="text-sm text-muted sm:text-base">
            Sistemul de progres nu te lasă să te minți: grila e verificare, AI-ul
            e ajutor, dar doar soluția scrisă de tine închide problema.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LADDER.map((state, index) => (
            <li
              key={state.label}
              className={`card space-y-2 border-2 p-5 ${state.border}`}
            >
              <span className="text-xs font-semibold text-faint">
                {index + 1}/4
              </span>
              <p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${state.badge}`}
                >
                  {state.label}
                </span>
              </p>
              <p className="text-sm leading-relaxed text-muted">{state.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* How it works */}
      <section className="space-y-8">
        <h2 className="text-center font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Cum funcționează
        </h2>
        <ol className="grid gap-4 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card flex gap-4 p-5">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-base font-bold text-white"
              >
                {index + 1}
              </span>
              <div className="space-y-1">
                <h3 className="font-semibold text-ink">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Final CTA */}
      <section className="hero-mesh card space-y-4 p-8 text-center sm:p-12">
        <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {departajare} probleme de departajare te așteaptă.
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted sm:text-base">
          Cont gratuit, fără instalare. Începe cu problemele care chiar fac
          diferența în iulie.
        </p>
        <div>
          <Link
            href="/login"
            className="inline-block rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-brand-700"
          >
            Începe acum
          </Link>
        </div>
      </section>
    </div>
  );
}
