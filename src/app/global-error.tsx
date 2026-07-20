"use client";

import { useEffect } from "react";
import "./globals.css";

const RELOAD_KEY = "departaj:stale-reload";
const RELOAD_COOLDOWN_MS = 30_000;

/**
 * Last-resort boundary: it catches what `error.tsx` cannot, because it sits
 * above the root layout (a crash in the layout itself, or a client runtime
 * error like a chunk that no longer exists).
 *
 * The common case is deployment skew — a tab open across a `vercel --prod`
 * asks for a JS chunk from the previous build, the fetch 404s and React tears
 * the whole tree down (the server action itself already ran fine). That is
 * cured by a reload, so do it automatically, once per 30s, so a genuinely
 * broken page can't turn into a refresh loop.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const text = `${error?.name ?? ""} ${error?.message ?? ""}`;
    const stale =
      /chunk|dynamically imported module|module script failed|deployment/i.test(
        text,
      );
    if (!stale) return;
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }, [error]);

  return (
    <html lang="ro">
      <body className="min-h-screen">
        <div className="mx-auto max-w-sm space-y-4 py-16 text-center">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            Ceva n-a mers.
          </h1>
          <p className="text-sm text-muted">
            Pagina a rămas în urma unei versiuni mai vechi. Reîncarcă — ce ai
            trimis deja s-a salvat.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Reîncarcă pagina
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
            >
              Încearcă din nou
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
