import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-sm space-y-4 py-16 text-center">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        Pagina nu există.
      </h1>
      <p className="text-sm text-muted">
        Linkul e greșit sau conținutul a fost mutat.
      </p>
      <Link
        href="/probleme"
        className="inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Înapoi la probleme
      </Link>
    </div>
  );
}
