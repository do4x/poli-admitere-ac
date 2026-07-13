"use server";

import { siteUrl } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
  sentTo: string | null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function sendMagicLink(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { error: "Adresă de email invalidă.", sentTo: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) {
    console.error("[departaj] signInWithOtp a eșuat:", error.message);
    return {
      error:
        "Trimiterea emailului a eșuat. Așteaptă un minut și încearcă din nou.",
      sentTo: null,
    };
  }
  return { error: null, sentTo: email };
}
