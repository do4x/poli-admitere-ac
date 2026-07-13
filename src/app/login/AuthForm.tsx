"use client";

import { useActionState, useState } from "react";
import {
  resendCodeAction,
  resetPasswordAction,
  signInAction,
  signInWithGoogleAction,
  signUpAction,
  verifyCodeAction,
  type AuthState,
} from "./actions";

type Mode = "signin" | "signup" | "forgot";

const AUTH_INITIAL: AuthState = { error: null };

const INPUT =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-brand";
const PRIMARY =
  "w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.02c2.2-2 3.5-5 3.5-8.6"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2-6.8-4.9l-.14.01-3.6 2.8-.05.13C3.4 21.3 7.4 24 12 24"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.5c-.3-.7-.4-1.5-.4-2.5s.2-1.8.4-2.5V6.7H1.4A11.9 11.9 0 0 0 0 12c0 1.9.5 3.7 1.4 5.3z"
      />
      <path
        fill="#EB4335"
        d="M12 4.6c2.2 0 3.7 1 4.6 1.8l3.3-3.2C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.7l3.8 2.8C6.2 6.6 8.9 4.6 12 4.6"
      />
    </svg>
  );
}

function Feedback({ state }: { state: AuthState }) {
  if (state.error) {
    return <p className="text-sm text-rose-600">{state.error}</p>;
  }
  if (state.info) {
    return <p className="text-sm text-teal-700">{state.info}</p>;
  }
  return null;
}

/** Verify-code step — shown after signup or after an unconfirmed signin. */
function VerifyCode({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    verifyCodeAction.bind(null, email),
    AUTH_INITIAL,
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendCodeAction.bind(null, email),
    AUTH_INITIAL,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-bold">Verifică-ți emailul</h2>
        <p className="text-sm text-muted">
          Am trimis un cod de confirmare la{" "}
          <span className="font-medium text-ink">{email}</span>.
        </p>
      </div>
      <form action={formAction} className="space-y-3">
        <input
          type="text"
          name="code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          autoComplete="one-time-code"
          placeholder="000000"
          className={`${INPUT} text-center font-display text-2xl tracking-[0.5em]`}
        />
        <Feedback state={state} />
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Se verifică…" : "Confirmă codul"}
        </button>
      </form>
      <form action={resendAction} className="flex items-center justify-between text-sm">
        <span className="text-faint">Nu a ajuns?</span>
        <button
          type="submit"
          disabled={resendPending}
          className="font-semibold text-brand transition-colors hover:text-brand-700 disabled:opacity-60"
        >
          Retrimite codul
        </button>
      </form>
      <Feedback state={resendState} />
      <p className="text-xs text-faint">
        Linkul de confirmare din același email funcționează și el.
      </p>
    </div>
  );
}

export function AuthForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signInFormAction, signInPending] = useActionState(
    signInAction,
    AUTH_INITIAL,
  );
  const [signUpState, signUpFormAction, signUpPending] = useActionState(
    signUpAction,
    AUTH_INITIAL,
  );
  const [googleState, googleFormAction, googlePending] = useActionState(
    signInWithGoogleAction,
    AUTH_INITIAL,
  );
  const [forgotState, forgotFormAction, forgotPending] = useActionState(
    resetPasswordAction,
    AUTH_INITIAL,
  );

  const verifyEmail = signUpState.verifyEmail ?? signInState.verifyEmail;
  if (verifyEmail) {
    return (
      <div className="card p-6">
        {signInState.info && (
          <p className="mb-3 text-sm text-teal-700">{signInState.info}</p>
        )}
        <VerifyCode email={verifyEmail} />
      </div>
    );
  }

  return (
    <div className="card space-y-5 p-6">
      {mode !== "forgot" && (
        <>
          <div
            className="grid grid-cols-2 rounded-xl border border-line bg-surface p-1 text-sm font-semibold"
            role="tablist"
          >
            {(
              [
                ["signin", "Intră"],
                ["signup", "Cont nou"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  mode === value
                    ? "bg-card text-ink shadow-soft"
                    : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {googleEnabled && (
            <>
              <form action={googleFormAction}>
                <button
                  type="submit"
                  disabled={googlePending}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition-colors hover:bg-surface disabled:opacity-60"
                >
                  <GoogleIcon />
                  Continuă cu Google
                </button>
                <div className="mt-2">
                  <Feedback state={googleState} />
                </div>
              </form>

              <div className="flex items-center gap-3 text-xs text-faint">
                <span className="h-px flex-1 bg-line" />
                sau cu email
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
        </>
      )}

      {mode === "signin" && (
        <form action={signInFormAction} className="space-y-3">
          <input
            type="email"
            name="email"
            required
            placeholder="nume@exemplu.ro"
            autoComplete="email"
            className={INPUT}
          />
          <input
            type="password"
            name="password"
            required
            placeholder="Parola"
            autoComplete="current-password"
            className={INPUT}
          />
          <Feedback state={signInState} />
          <button type="submit" disabled={signInPending} className={PRIMARY}>
            {signInPending ? "Se conectează…" : "Intră în cont"}
          </button>
          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="w-full text-center text-sm text-muted transition-colors hover:text-ink"
          >
            Ai uitat parola?
          </button>
        </form>
      )}

      {mode === "signup" && (
        <form action={signUpFormAction} className="space-y-3">
          <input
            type="email"
            name="email"
            required
            placeholder="nume@exemplu.ro"
            autoComplete="email"
            className={INPUT}
          />
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="Parolă (minim 8 caractere)"
            autoComplete="new-password"
            className={INPUT}
          />
          <Feedback state={signUpState} />
          <button type="submit" disabled={signUpPending} className={PRIMARY}>
            {signUpPending ? "Se creează…" : "Creează cont"}
          </button>
          <p className="text-xs text-faint">
            Primești un cod de confirmare pe email.
          </p>
        </form>
      )}

      {mode === "forgot" && (
        <form action={forgotFormAction} className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold">Resetează parola</h2>
            <p className="text-sm text-muted">
              Primești un link de resetare pe email. Merge și pentru conturile
              create înainte de introducerea parolelor.
            </p>
          </div>
          <input
            type="email"
            name="email"
            required
            placeholder="nume@exemplu.ro"
            autoComplete="email"
            className={INPUT}
          />
          <Feedback state={forgotState} />
          <button type="submit" disabled={forgotPending} className={PRIMARY}>
            {forgotPending ? "Se trimite…" : "Trimite linkul de resetare"}
          </button>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className="w-full text-center text-sm text-muted transition-colors hover:text-ink"
          >
            ← Înapoi la autentificare
          </button>
        </form>
      )}
    </div>
  );
}
