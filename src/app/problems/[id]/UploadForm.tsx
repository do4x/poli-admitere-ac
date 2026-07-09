"use client";

import { useActionState } from "react";
import { uploadSolution, type UploadState } from "./actions";

const initialState: UploadState = { error: null, uploadedAt: null };

export function UploadForm({ problemId }: { problemId: string }) {
  const [state, formAction, pending] = useActionState(
    uploadSolution.bind(null, problemId),
    initialState,
  );

  return (
    <form
      action={formAction}
      // Remount inputs after a successful upload so the form clears.
      key={state.uploadedAt ?? "empty"}
      className="space-y-3 rounded border border-stone-300 bg-white p-4"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        Încarcă o soluție (PDF)
      </h2>
      <input
        type="file"
        name="pdf"
        accept="application/pdf,.pdf"
        required
        className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-stone-800 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-stone-700"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="aiAssisted" className="h-4 w-4" />
        Am rezolvat cu ajutorul AI
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {pending ? "Se încarcă…" : "Încarcă"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.uploadedAt !== null && !state.error && (
        <p className="text-sm text-green-700">Soluție încărcată.</p>
      )}
    </form>
  );
}
