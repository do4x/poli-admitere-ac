"use client";

import { useActionState } from "react";
import { updatePasswordAction, type PasswordState } from "./actions";

const INITIAL: PasswordState = { error: null };

export function ParolaForm() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="card space-y-3 p-6">
      <input
        type="password"
        name="password"
        required
        minLength={8}
        autoFocus
        placeholder="Parolă nouă (minim 8 caractere)"
        autoComplete="new-password"
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
      />
      <input
        type="password"
        name="confirm"
        required
        minLength={8}
        placeholder="Repetă parola"
        autoComplete="new-password"
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
      />
      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Se salvează…" : "Salvează parola"}
      </button>
    </form>
  );
}
