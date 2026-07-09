const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

const globalMarker = globalThis as unknown as {
  departajReviewInterval?: ReturnType<typeof setInterval>;
};

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runDueReviewCheck } = await import("@/lib/notifications/service");

  // On boot: the app has no guaranteed uptime, so catch up immediately.
  await runDueReviewCheck();

  // While running: every 6 hours (spec: plain setInterval, no cron dep).
  if (!globalMarker.departajReviewInterval) {
    globalMarker.departajReviewInterval = setInterval(() => {
      void runDueReviewCheck();
    }, SIX_HOURS_MS);
  }
}
