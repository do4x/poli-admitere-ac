import { runDueReviewChecks } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

/**
 * Cron target (GitHub Actions, every 6h): runs the per-user review digests.
 * Guarded by CRON_SECRET — without the header, the endpoint does not exist.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return new Response("Not found", { status: 404 });
  }

  const summary = await runDueReviewChecks();
  return Response.json(summary);
}
