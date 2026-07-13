"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null, sentTo: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, INITIAL);

  if (state.sentTo) {
    return (
      <div className="card space-y-2 p-6">
        <h2 className="font-semibold text-ink">Verifică-ți emailul</h2>
        <p className="text-sm text-muted">
          Am trimis un link de autentificare la{" "}
          <span className="font-medium text-ink">{state.sentTo}</span>.
          Deschide-l în același browser.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Email</span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          placeholder="nume@exemplu.ro"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
        />
      </label>
      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Se trimite…" : "Trimite link de autentificare"}
      </button>
      <p className="text-xs text-faint">
        Fără parolă — primești un link pe email. Contul se creează automat la
        prima autentificare.
      </p>
    </form>
  );
}
