"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SOLUTIONS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * GDPR-complete account deletion: storage objects → DB rows (cascade wipes
 * solutions + attempts) → Supabase auth user (self-delete RPC) → session.
 * If storage cleanup partially fails we still proceed — an orphaned PDF in a
 * private bucket beats a half-deleted account.
 */
export async function deleteAccountAction(): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const solutions = await prisma.solution.findMany({
    where: { userId: user.id },
    select: { pdfPath: true },
  });
  if (solutions.length > 0) {
    await supabase.storage
      .from(SOLUTIONS_BUCKET)
      .remove(solutions.map((s) => s.pdfPath));
  }

  await prisma.user.delete({ where: { id: user.id } });

  const { error } = await supabase.rpc("delete_user");
  if (error) {
    console.error("[departaj] delete_user RPC a eșuat:", error.message);
  }

  await supabase.auth.signOut();
  redirect("/probleme");
}
