const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

const globalMarker = globalThis as unknown as {
  departajReviewInterval?: ReturnType<typeof setInterval>;
};

/**
 * Dev-only convenience: check on boot + every 6h while running, since a
 * laptop app has no guaranteed uptime. In production the schedule belongs
 * to the external cron hitting /api/cron/reviews.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "development") return;

  const { runDueReviewChecks } = await import("@/lib/notifications/service");

  await runDueReviewChecks();

  if (!globalMarker.departajReviewInterval) {
    globalMarker.departajReviewInterval = setInterval(() => {
      void runDueReviewChecks();
    }, SIX_HOURS_MS);
  }
}
