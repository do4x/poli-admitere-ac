import { prisma } from "@/lib/db";

/**
 * All problems with their exam and the current user's solve-state relations,
 * in the exact shape the /probleme list and the "next problem" resolver both
 * consume. Kept in one place so their ordering/filtering can never drift.
 * `correctAnswer` is omitted — the key never leaves the server actions.
 */
export function fetchFilterableProblems(userId: string | undefined) {
  return prisma.problem.findMany({
    omit: { correctAnswer: true },
    // Single SQL query (LATERAL joins) instead of Prisma's default one
    // round-trip per relation — the pooled connection (Supabase pgbouncer,
    // transaction mode) pays a fixed ~70-140ms per statement, so 6 sequential
    // queries (problem, exam, tag-join, tag, solution, attempt) added up to
    // ~650-900ms. One joined query cuts that to a single round trip.
    relationLoadStrategy: "join",
    include: {
      exam: true,
      tags: { select: { name: true } },
      solutions: {
        where: { userId: userId ?? "" },
        select: { aiAssisted: true },
      },
      attempts: {
        where: { userId: userId ?? "" },
        select: { kind: true, correct: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
