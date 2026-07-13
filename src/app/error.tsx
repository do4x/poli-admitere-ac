"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-sm space-y-4 py-16 text-center">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        Ceva n-a mers.
      </h1>
      <p className="text-sm text-muted">
        Eroare neașteptată. Încearcă din nou — dacă persistă, revino mai
        târziu.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Încearcă din nou
      </button>
    </div>
  );
}
