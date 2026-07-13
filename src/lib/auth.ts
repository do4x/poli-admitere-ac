import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

/** ADMIN_EMAILS (comma-separated) is the source of truth for the admin flag;
 *  the DB column just mirrors it for queries. */
function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export function siteUrl(): string {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

/**
 * The logged-in user, or null. Validates the JWT via Supabase, then mirrors
 * the identity into our User table (first login = row creation). Cached per
 * request — layout, page and actions share one lookup.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || typeof claims.email !== "string") return null;

  const id = claims.sub;
  const email = claims.email.toLowerCase();
  const isAdmin = isAdminEmail(email);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    try {
      await prisma.user.create({ data: { id, email, isAdmin } });
    } catch (error) {
      // Parallel first-request race: the row already exists — fine.
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
    }
  } else if (existing.email !== email || existing.isAdmin !== isAdmin) {
    await prisma.user.update({ where: { id }, data: { email, isAdmin } });
  }

  return { id, email, isAdmin };
});

/** Page guard: bounce anonymous visitors to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Page guard: admin area pretends not to exist for everyone else. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user?.isAdmin) notFound();
  return user;
}
