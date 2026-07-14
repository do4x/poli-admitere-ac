import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { signedSolutionUrl } from "@/lib/storage";

/**
 * Serve a solution file (PDF or image): auth → ownership → 60s signed Storage
 * URL. The response Content-Type comes from Storage (set at upload), so the
 * browser renders it directly in an <iframe> (PDF) or <img> (image).
 * Non-owners get 404 (not 403) so solution ids don't leak existence.
 * Storage RLS on the {userId}/ prefix backs this check up.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Autentificare necesară.", { status: 401 });
  }

  const { id } = await params;
  const solution = await prisma.solution.findUnique({ where: { id } });
  if (!solution || solution.userId !== user.id) {
    return new Response("Soluția nu există.", { status: 404 });
  }

  const url = await signedSolutionUrl(solution.pdfPath, 60);
  if (!url) {
    return new Response("Fișierul nu a putut fi accesat.", { status: 500 });
  }

  return NextResponse.redirect(url, {
    headers: { "Cache-Control": "no-store" },
  });
}
