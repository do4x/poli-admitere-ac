"use client";

import { useState, useTransition } from "react";
import { revealHintAction } from "./actions";

export interface HintSlot {
  level: number;
  label: string;
  /** Present only once the hint is open — a closed hint's text never reaches
   *  the client, or "closed" would be a CSS lie. */
  text: string | null;
  opened: boolean;
}

/**
 * Progressive hints, built from the grading's `trigger`: level 1 is the signal
 * to spot, level 2 the move it licenses.
 *
 * Opening one is a deliberate, irreversible act — it is recorded and, from
 * that moment on, a correct grila answer no longer counts (same rule as
 * "Arată răspunsul"). Hence the warning on the first open and no way to
 * "un-see" it afterwards.
 */
export function HintPanel({
  problemId,
  hints,
  tainted,
}: {
  problemId: string;
  hints: HintSlot[];
  /** Some hint is already open, so the warning has nothing left to protect. */
  tainted: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<number | null>(null);

  if (hints.length === 0) return null;

  const open = (level: number) => {
    setConfirming(null);
    startTransition(() => {
      void revealHintAction(problemId, level);
    });
  };

  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Indicii</h2>
        {!tainted && (
          <p className="text-[11px] text-faint">
            Un indiciu anulează verificarea pe grilă — la fel ca „Arată răspunsul”.
          </p>
        )}
      </div>

      <ul className="mt-2 space-y-2">
        {hints.map((hint) => (
          <li key={hint.level}>
            {hint.opened && hint.text ? (
              <div className="rounded-lg border border-line bg-surface px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                  {hint.label}
                </p>
                <p className="mt-0.5 text-sm text-ink/85">{hint.text}</p>
              </div>
            ) : confirming === hint.level ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-800">
                  {hint.level >= 2
                    ? "Indiciul 2 este ideea rezolvării. Dacă îl deschizi, problema nu se mai pune ca rezolvată singur pe baza grilei — îți rămâne doar varianta să încarci propria rezolvare."
                    : "Sigur? După asta, un răspuns corect pe grilă nu mai contează."}
                </p>
                <button
                  type="button"
                  onClick={() => open(hint.level)}
                  disabled={pending}
                  className="rounded-md border border-amber-500 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
                >
                  {pending ? "Se deschide…" : "Arată indiciul"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="text-xs text-faint underline-offset-2 hover:text-ink hover:underline"
                >
                  Renunț
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  tainted ? open(hint.level) : setConfirming(hint.level)
                }
                disabled={pending}
                className="w-full rounded-lg border border-dashed border-line px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:border-ink/25 hover:text-ink disabled:opacity-50"
              >
                {hint.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
