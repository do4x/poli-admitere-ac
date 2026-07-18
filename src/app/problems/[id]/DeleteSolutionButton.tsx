"use client";

import { useActionState, useState } from "react";
import { deleteSolutionAction, type DeleteSolutionState } from "./actions";

const INITIAL: DeleteSolutionState = { error: null };

/** Two-step delete for a solution the user owns — same confirm pattern as
 *  the grila reveal. The page re-render removes the card. */
export function DeleteSolutionButton({ solutionId }: { solutionId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteSolutionAction.bind(null, solutionId),
    INITIAL,
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="ml-auto text-xs text-faint underline-offset-2 hover:text-rose-600 hover:underline"
      >
        Șterge
      </button>
    );
  }

  return (
    <span className="ml-auto flex items-center gap-2 text-xs text-rose-600">
      Ștergere definitivă.
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-rose-500 px-2 py-0.5 font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          {pending ? "Se șterge…" : "Șterge oricum"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-muted hover:text-ink"
      >
        Renunță
      </button>
      {state.error && <span>{state.error}</span>}
    </span>
  );
}
