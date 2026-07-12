import { siteUrl } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkDueReviews } from "./checkDueReviews";
import { createResendSender } from "./send";

export interface DueReviewRunSummary {
  usersChecked: number;
  digestsSent: number;
}

/**
 * Production wiring for checkDueReviews, per user: each user with pending
 * AI-assisted solutions gets ONE digest to their own email. The engine's
 * notifiedAt dedupe is unchanged.
 */
export async function runDueReviewChecks(): Promise<DueReviewRunSummary> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    console.log(
      "[departaj] Notificări dezactivate — setează RESEND_API_KEY și RESEND_FROM.",
    );
    return { usersChecked: 0, digestsSent: 0 };
  }

  // Cheap pre-filter; dueSolutions() inside the engine makes the real call
  // (due date reached, no independent solution, not yet notified).
  const users = await prisma.user.findMany({
    where: {
      solutions: {
        some: { aiAssisted: true, reviewDueAt: { not: null }, notifiedAt: null },
      },
    },
    select: { id: true, email: true },
  });

  let digestsSent = 0;
  for (const user of users) {
    const send = createResendSender(user.email);
    if (!send) continue;
    try {
      const result = await checkDueReviews({
        now: () => new Date(),
        baseUrl: siteUrl(),
        loadProblems: () =>
          prisma.problem.findMany({
            where: { solutions: { some: { aiAssisted: true, userId: user.id } } },
            select: {
              id: true,
              number: true,
              exam: {
                select: { year: true, kind: true, subject: true, session: true },
              },
              solutions: {
                where: { userId: user.id },
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
            where: { id: { in: solutionIds }, userId: user.id },
            data: { notifiedAt: at },
          });
        },
      });
      if (result.sent) {
        digestsSent += 1;
        console.log(
          `[departaj] Digest trimis către ${user.email}: ${result.problemCount} probleme scadente.`,
        );
      }
    } catch (error) {
      // One user's failure must not block the others; retried next cycle.
      console.error(`[departaj] Digest eșuat pentru ${user.email}:`, error);
    }
  }

  return { usersChecked: users.length, digestsSent };
}
