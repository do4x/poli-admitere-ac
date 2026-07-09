import { prisma } from "@/lib/db";
import { checkDueReviews } from "./checkDueReviews";
import { createResendSender } from "./send";

/** Production wiring for checkDueReviews: Prisma + Resend + real clock. */
export async function runDueReviewCheck(): Promise<void> {
  const send = createResendSender();
  if (!send) {
    console.log(
      "[departaj] Notificări dezactivate — setează RESEND_API_KEY, NOTIFY_EMAIL și RESEND_FROM în .env.",
    );
    return;
  }

  try {
    const result = await checkDueReviews({
      now: () => new Date(),
      loadProblems: () =>
        prisma.problem.findMany({
          where: { solutions: { some: { aiAssisted: true } } },
          select: {
            id: true,
            number: true,
            exam: {
              select: { year: true, kind: true, subject: true, session: true },
            },
            solutions: {
              select: {
                id: true,
                aiAssisted: true,
                reviewDueAt: true,
                notifiedAt: true,
              },
            },
          },
        }),
      send,
      stampNotified: async (solutionIds, at) => {
        await prisma.solution.updateMany({
          where: { id: { in: solutionIds } },
          data: { notifiedAt: at },
        });
      },
    });
    if (result.sent) {
      console.log(
        `[departaj] Digest trimis: ${result.problemCount} probleme scadente.`,
      );
    }
  } catch (error) {
    console.error("[departaj] Verificarea recenziilor a eșuat:", error);
  }
}
