"use client";

import { useActionState } from "react";
import { REVIEW_DELAY_HOURS } from "@/lib/domain";
import { markAiAction, unmarkAiAction, type AiMarkState } from "./actions";

const INITIAL: AiMarkState = { error: null };

interface AiMarkControlProps {
  problemId: string;
  /** null = no mark; otherwise the open window's deadline (pre-formatted). */
  dueLabel: string | null;
  /** The mark can still be undone (window open, no AI upload behind it). */
  canUnmark: boolean;
}

/**
 * "Am rezolvat cu AI" without uploading anything. Marking opens the re-solve
 * window after which the problem resets and must be re-solved to count.
 */
export function AiMarkControl({ problemId, dueLabel, canUnmark }: AiMarkControlProps) {
  const [markState, markFormAction, markPending] = useActionState(
    markAiAction.bind(null, problemId),
    INITIAL,
  );
  const [unmarkState, unmarkFormAction, unmarkPending] = useActionState(
    unmarkAiAction.bind(null, problemId),
    INITIAL,
  );
  const error = markState.error ?? unmarkState.error;

  return (
    <div className="card flex flex-wrap items-center justify-between gap-2 p-4">
      {dueLabel === null ? (
        <>
          <div>
            <p className="text-sm font-medium text-ink">
              Ai rezolvat-o cu AI, fără să încarci rezolvarea?
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Marcheaz-o — în {REVIEW_DELAY_HOURS} de ore se resetează și va
              trebui să o rezolvi din nou, singur, ca să conteze.
            </p>
          </div>
          <form action={markFormAction}>
            <button
              type="submit"
              disabled={markPending}
              className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50"
            >
              {markPending ? "Se marchează…" : "Am rezolvat cu AI"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-orange-700">
            Marcată ca rezolvată cu AI — se resetează pe{" "}
            <span className="font-semibold">{dueLabel}</span>. Rezolv-o singur
            până atunci.
          </p>
          {canUnmark && (
            <form action={unmarkFormAction}>
              <button
                type="submit"
                disabled={unmarkPending}
                className="text-xs text-faint underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
              >
                {unmarkPending ? "Se anulează…" : "Am marcat din greșeală"}
              </button>
            </form>
          )}
        </>
      )}
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </div>
  );
}
