"use server";

import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error: string | null;
  /** Set when the flow moved to the enter-the-email-code step. */
  verifyEmail?: string;
  /** Non-error feedback ("codul a fost retrimis", "email trimis"). */
  info?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PASSWORD_MIN = 8;

function readEmail(formData: FormData): string {
  return String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
}

/** Email + parolă. Un cont neconfirmat este trimis la pasul cu codul. */
export async function signInAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  if (!EMAIL_RE.test(email) || password.length === 0) {
    return { error: "Completează emailul și parola." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
      });
      return {
        error: null,
        verifyEmail: email,
        info: "Contul nu e confirmat încă — ți-am retrimis codul pe email.",
      };
    }
    return { error: "Email sau parolă greșite." };
  }
  redirect("/");
}

/** Cont nou: email + parolă → cod de confirmare pe email. */
export async function signUpAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  if (!EMAIL_RE.test(email)) {
    return { error: "Adresă de email invalidă." };
  }
  if (password.length < PASSWORD_MIN) {
    return { error: `Parola trebuie să aibă minim ${PASSWORD_MIN} caractere.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) {
    console.error("[departaj] signUp a eșuat:", error.message);
    return { error: "Crearea contului a eșuat. Încearcă din nou în câteva minute." };
  }
  // Anti-enumeration: pentru un email deja confirmat, Supabase întoarce un
  // user fără identități în loc de eroare.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "Există deja un cont cu acest email — intră cu parola." };
  }
  return { error: null, verifyEmail: email };
}

/** Verifică codul de 6 cifre primit pe email. */
export async function verifyCodeAction(
  email: string,
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const token = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(token)) {
    return { error: "Codul are 6 cifre.", verifyEmail: email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { error: "Cod invalid sau expirat.", verifyEmail: email };
  }
  redirect("/");
}

export async function resendCodeAction(
  email: string,
  _previous: AuthState,
  _formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) {
    return {
      error: "Nu am putut retrimite codul — așteaptă un minut.",
      verifyEmail: email,
    };
  }
  return { error: null, verifyEmail: email, info: "Cod retrimis. Verifică emailul." };
}

/** OAuth Google — redirect către consimțământul Google. */
export async function signInWithGoogleAction(
  _previous: AuthState,
  _formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error || !data.url) {
    console.error("[departaj] signInWithOAuth:", error?.message);
    return { error: "Autentificarea cu Google nu este disponibilă momentan." };
  }
  redirect(data.url);
}

/** Trimite emailul de resetare a parolei (și pentru conturile vechi fără parolă). */
export async function resetPasswordAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readEmail(formData);
  if (!EMAIL_RE.test(email)) {
    return { error: "Scrie emailul mai întâi, apoi apasă pe resetare." };
  }
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/parola`,
  });
  // Răspuns identic indiferent dacă emailul există — fără enumerare.
  return { error: null, info: "Dacă există un cont, ai primit un email de resetare." };
}
