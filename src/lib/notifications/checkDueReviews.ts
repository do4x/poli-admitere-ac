import { dueSolutions, unnotified } from "@/lib/domain";
import { buildDigest, type Digest } from "./digest";

export interface NotifiableSolution {
  id: string;
  aiAssisted: boolean;
  reviewDueAt: Date | null;
  notifiedAt: Date | null;
}

export interface NotifiableProblem {
  id: string;
  number: string;
  exam: {
    year: number;
    kind: string;
    subject: string;
    session: string | null;
  };
  solutions: NotifiableSolution[];
}

export interface CheckDueReviewsDeps {
  now: () => Date;
  /** Problems with their solutions and exam info. */
  loadProblems: () => Promise<NotifiableProblem[]>;
  /** Send the digest email. Throwing aborts the run without stamping. */
  send: (digest: Digest) => Promise<void>;
  /** Stamp notifiedAt on the given solutions — the dedupe. */
  stampNotified: (solutionIds: string[], at: Date) => Promise<void>;
}

export interface CheckDueReviewsResult {
  sent: boolean;
  problemCount: number;
  solutionIds: string[];
}

/**
 * The engine behind the 4-day review emails. Stamping happens only after a
 * successful send, so a failed send retries on the next cycle; a successful
 * send never repeats (notifiedAt dedupe). Deliberate tradeoff: if the send
 * succeeds but stamping fails, the digest repeats next cycle (at-least-once)
 * — a duplicate nag beats a silently lost one.
 */
export async function checkDueReviews(
  deps: CheckDueReviewsDeps,
): Promise<CheckDueReviewsResult> {
  const now = deps.now();
  const problems = await deps.loadProblems();
  const toNotify = unnotified(dueSolutions(problems, now));

  if (toNotify.length === 0) {
    return { sent: false, problemCount: 0, solutionIds: [] };
  }

  const digest = buildDigest(toNotify.map((item) => item.problem));
  await deps.send(digest);

  const solutionIds = toNotify.map((item) => item.solution.id);
  await deps.stampNotified(solutionIds, now);

  return { sent: true, problemCount: digest.problemCount, solutionIds };
}
