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
  /** The answer is already found: no more attempts are accepted. */
  locked: boolean;
  /** Past-due AI mark: the grila is open again as the redemption path, so
   *  earlier attempts must not narrow down the choices. */
  redemption: boolean;
  history: PastChoice[];
  /** The official key, present ONLY after the user chose to reveal it. */
  revealedAnswer: string | null;
}

export function GrilaCheck({
  problemId,
  verified,
  countsTowardGoal,
  locked,
  redemption,
  history,
  revealedAnswer,
}: GrilaCheckProps) {
  const [state, formAction, pending] = useActionState(
    submitAnswerAction.bind(null, problemId),
    INITIAL,
  );
  const [selected, setSelected] = useState<string | null>(null);
  // The last choice actually sent, so the same letter can't be fired twice.
  const [sent, setSent] = useState<string | null>(null);
  const [confirmingReveal, setConfirmingReveal] = useState(false);

  const solvedChoice = locked
    ? (history.find((h) => h.correct)?.choice ?? null)
    : null;
  // Known-wrong letters stay clickable during redemption — see `redemption`.
  const wrongTried = new Set(
    redemption ? [] : history.filter((h) => !h.correct).map((h) => h.choice),
  );
  const canSubmit =
    selected !== null && selected !== sent && !pending && !locked;

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

      {redemption && (
        <p className="text-xs text-muted">
          Grila s-a redeschis de la zero — încercările de dinainte de resetare
          nu se mai văd.
        </p>
      )}

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
      ) : locked ? (
        <p className="text-sm text-muted">
          Ai răspuns corect
          {solvedChoice && (
            <>
              {" cu "}
              <span className="font-display text-base font-bold text-teal-700">
                {solvedChoice})
              </span>
            </>
          )}
        </p>
      ) : (
        <form
          action={formAction}
          onSubmit={() => setSent(selected)}
          className="space-y-3"
        >
          <input type="hidden" name="choice" value={selected ?? ""} />
          <div className="flex flex-wrap items-center gap-1.5">
            {CHOICES.map((choice) => {
              const isSelected = selected === choice;
              const isWrong = wrongTried.has(choice);
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setSelected(choice)}
                  disabled={pending || isWrong}
                  aria-pressed={isSelected}
                  title={isWrong ? "Ai încercat deja varianta asta" : undefined}
                  className={`h-9 w-9 rounded-lg border font-display text-sm font-bold shadow-soft transition-colors disabled:cursor-not-allowed ${
                    isSelected
                      ? "border-brand bg-brand text-white"
                      : isWrong
                        ? "border-line bg-surface text-faint line-through opacity-60"
                        : "border-line bg-card text-muted hover:border-brand hover:text-brand-700"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Se verifică…" : "Verifică răspunsul"}
            </button>
            {/* Nothing to say once a fresh choice is picked — the highlighted
                letter and the live button already say it. */}
            {(selected === null || selected === sent) && (
              <span className="text-xs text-faint">
                {selected === null
                  ? "Alege o variantă, apoi verifică."
                  : "Alege altă variantă ca să mai verifici o dată."}
              </span>
            )}
          </div>
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
          !locked &&
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
