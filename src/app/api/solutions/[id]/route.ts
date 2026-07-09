import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { solutionAbsolutePath } from "@/lib/storage";

/**
 * Stream a solution PDF by Solution id. The filesystem path always comes from
 * the DB row (written server-side at upload), never from the client, and is
 * re-validated against the solutions root — no path traversal surface.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const solution = await prisma.solution.findUnique({ where: { id } });
  if (!solution) {
    return new Response("Soluția nu există.", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(solutionAbsolutePath(solution.pdfPath));
  } catch {
    return new Response("Fișierul PDF lipsește de pe disc.", { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
