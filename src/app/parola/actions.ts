"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface PasswordState {
  error: string | null;
}

const PASSWORD_MIN = 8;

/** Set a new password — reached from the recovery-link session. */
export async function updatePasswordAction(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < PASSWORD_MIN) {
    return { error: `Parola trebuie să aibă minim ${PASSWORD_MIN} caractere.` };
  }
  if (password !== confirm) {
    return { error: "Parolele nu coincid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[departaj] updateUser(password):", error.message);
    return { error: "Setarea parolei a eșuat. Cere un nou link de resetare." };
  }
  redirect("/");
}
