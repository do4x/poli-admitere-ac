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
      key={state.uploadedAt ?? "empty"}
      className="card space-y-3 p-4"
    >
      <h2 className="text-sm font-semibold text-ink">Încarcă o soluție (PDF)</h2>
      <input
        type="file"
        name="pdf"
        accept="application/pdf,.pdf"
        required
        className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="aiAssisted" className="h-4 w-4 accent-brand" />
        Am rezolvat cu ajutorul AI
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Se încarcă…" : "Încarcă"}
      </button>
      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state.uploadedAt !== null && !state.error && (
        <p className="text-sm text-green-700">Soluție încărcată.</p>
      )}
    </form>
  );
}
