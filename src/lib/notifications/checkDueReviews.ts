import { dueProblems, unnotified } from "@/lib/domain";
import { buildDigest, type Digest } from "./digest";

export interface NotifiableMark {
  id: string;
  dueAt: Date;
  redeemedAt: Date | null;
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
  solutions: { aiAssisted: boolean }[];
  aiMark: NotifiableMark | null;
}

export interface CheckDueReviewsDeps {
  now: () => Date;
  /** Problems with the user's AI mark, solutions and exam info. */
  loadProblems: () => Promise<NotifiableProblem[]>;
  /** Send the digest email. Throwing aborts the run without stamping. */
  send: (digest: Digest) => Promise<void>;
  /** Stamp notifiedAt on the given AI marks — the dedupe. */
  stampNotified: (markIds: string[], at: Date) => Promise<void>;
  /** Origin used for problem links in the digest. */
  baseUrl?: string;
}

export interface CheckDueReviewsResult {
  sent: boolean;
  problemCount: number;
  markIds: string[];
}

/**
 * The engine behind the AI-reset review emails. Stamping happens only after a
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
  const toNotify = unnotified(dueProblems(problems, now));

  if (toNotify.length === 0) {
    return { sent: false, problemCount: 0, markIds: [] };
  }

  const digest = buildDigest(toNotify, deps.baseUrl);
  await deps.send(digest);

  const markIds = toNotify.map((p) => (p.aiMark as NotifiableMark).id);
  await deps.stampNotified(markIds, now);

  return { sent: true, problemCount: digest.problemCount, markIds };
}
