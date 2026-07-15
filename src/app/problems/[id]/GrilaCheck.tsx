"use client";

import { useActionState, useState } from "react";
import {
  revealAnswerAction,
  submitAnswerAction,
  type GrilaState,
} from "./actions";

const CHOICES = ["a", "b", "c", "d", "e", "f"] as const;
const INITIAL: GrilaState = { error: null };

export interface PastChoice {
  id: string;
  choice: string;
  correct: boolean;
}

interface GrilaCheckProps {
  problemId: string;
  /** Correct choice already submitted before any reveal. */
  verified: boolean;
  /** Correct within the first 2 tries — only then it moves the counter. */
  countsTowardGoal: boolean;
  history: PastChoice[];
  /** The official key, present ONLY after the user chose to reveal it. */
  revealedAnswer: string | null;
}

export function GrilaCheck({
  problemId,
  verified,
  countsTowardGoal,
  history,
  revealedAnswer,
}: GrilaCheckProps) {
  const [state, formAction, pending] = useActionState(
    submitAnswerAction.bind(null, problemId),
    INITIAL,
  );
  const [confirmingReveal, setConfirmingReveal] = useState(false);

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Verificare grilă</h2>
        {verified && (
          <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
            verificată pe grilă ✓
          </span>
        )}
      </div>

      {verified && !countsTowardGoal && (
        <p className="text-xs text-amber-700">
          Răspunsul corect a venit după mai mult de 2 încercări — nu contează
          la obiectiv. Rezolv-o singur ca să iasă din numărătoare.
        </p>
      )}

      {revealedAnswer ? (
        <p className="text-sm text-muted">
          Răspuns oficial:{" "}
          <span className="font-display text-base font-bold text-ink">
            {revealedAnswer})
          </span>
          {!verified && (
            <span className="ml-2 text-xs text-faint">
              — verificarea pe grilă nu mai e posibilă pentru această problemă.
            </span>
          )}
        </p>
      ) : (
        <form action={formAction} className="flex flex-wrap items-center gap-1.5">
          {CHOICES.map((choice) => (
            <button
              key={choice}
              type="submit"
              name="choice"
              value={choice}
              disabled={pending}
              className="h-9 w-9 rounded-lg border border-line bg-card font-display text-sm font-bold text-muted shadow-soft transition-colors hover:border-brand hover:text-brand-700 disabled:opacity-50"
            >
              {choice}
            </button>
          ))}
        </form>
      )}

      {state.error && <p className="text-xs text-rose-600">{state.error}</p>}
      {state.correct === true && (
        <p className="text-sm font-semibold text-teal-700">Corect ✓</p>
      )}
      {state.correct === false && (
        <p className="text-sm font-semibold text-rose-600">
          Greșit ✗ — mai încearcă.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {history.length > 0 ? (
          <p className="text-xs text-faint">
            Încercări:{" "}
            {history.map((h, i) => (
              <span key={h.id}>
                {i > 0 && " · "}
                <span
                  className={
                    h.correct ? "font-semibold text-teal-600" : "text-rose-500"
                  }
                >
                  {h.choice}
                  {h.correct ? " ✓" : " ✗"}
                </span>
              </span>
            ))}
          </p>
        ) : (
          <span />
        )}

        {!revealedAnswer &&
          (confirmingReveal ? (
            <span className="flex items-center gap-2 text-xs text-rose-600">
              Blochează definitiv „verificată pe grilă”.
              <form action={revealAnswerAction.bind(null, problemId)}>
                <button
                  type="submit"
                  className="rounded-lg border border-rose-500 px-2 py-0.5 font-semibold text-rose-600 hover:bg-rose-50"
                >
                  Arată oricum
                </button>
              </form>
              <button
                type="button"
                onClick={() => setConfirmingReveal(false)}
                className="text-muted hover:text-ink"
              >
                Renunță
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingReveal(true)}
              className="text-xs text-faint underline-offset-2 hover:text-ink hover:underline"
            >
              Arată răspunsul
            </button>
          ))}
      </div>
    </section>
  );
}
