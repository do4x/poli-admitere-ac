import { siteUrl } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkDueReviews } from "./checkDueReviews";
import { createResendSender } from "./send";

export interface DueReviewRunSummary {
  usersChecked: number;
  digestsSent: number;
}

/**
 * Production wiring for checkDueReviews, per user: each user with AI marks
 * past their re-solve window gets ONE digest to their own email. The engine's
 * notifiedAt dedupe is unchanged.
 */
export async function runDueReviewChecks(): Promise<DueReviewRunSummary> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    console.log(
      "[departaj] Notificări dezactivate — setează RESEND_API_KEY și RESEND_FROM.",
    );
    return { usersChecked: 0, digestsSent: 0 };
  }

  const now = new Date();
  // Cheap pre-filter; dueProblems() inside the engine makes the real call
  // (window passed, unredeemed, no independent solution, not yet notified).
  const users = await prisma.user.findMany({
    where: {
      aiMarks: {
        some: { notifiedAt: null, redeemedAt: null, dueAt: { lte: now } },
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
        loadProblems: async () => {
          const problems = await prisma.problem.findMany({
            where: { aiMarks: { some: { userId: user.id } } },
            select: {
              id: true,
              number: true,
              exam: {
                select: { year: true, kind: true, subject: true, session: true },
              },
              solutions: {
                where: { userId: user.id },
                select: { aiAssisted: true },
              },
              aiMarks: {
                where: { userId: user.id },
                select: {
                  id: true,
                  dueAt: true,
                  redeemedAt: true,
                  notifiedAt: true,
                },
              },
            },
          });
          return problems.map(({ aiMarks, ...problem }) => ({
            ...problem,
            aiMark: aiMarks[0] ?? null,
          }));
        },
        send,
        stampNotified: async (markIds, at) => {
          await prisma.aiMark.updateMany({
            where: { id: { in: markIds }, userId: user.id },
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
