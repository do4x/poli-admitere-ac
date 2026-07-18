import { hasIndependentSolution } from "./solutions";

/** An AI mark reduced to what the due queue and digest need. notifiedAt only
 *  matters to `unnotified`; callers that never touch the digest may omit it. */
export interface DueMarkInput {
  dueAt: Date;
  redeemedAt: Date | null;
  notifiedAt?: Date | null;
}

export interface DueProblemInput {
  solutions: readonly { aiAssisted: boolean }[];
  aiMark: DueMarkInput | null;
}

/**
 * Rule 5 (2026-07-18 revision): the due queue — AI marks past their 72h
 * window, on problems that still have no independent solution and were not
 * redeemed via grila. Redemption (stamped server-side) or an independent
 * upload clears the problem from the queue permanently.
 */
export function dueProblems<P extends DueProblemInput>(
  problems: readonly P[],
  now: Date,
): P[] {
  return problems.filter(
    (p) =>
      p.aiMark !== null &&
      p.aiMark.redeemedAt === null &&
      p.aiMark.dueAt.getTime() <= now.getTime() &&
      !hasIndependentSolution(p),
  );
}

/** Digest candidates: due problems whose review email was never sent. */
export function unnotified<P extends { aiMark: DueMarkInput | null }>(
  problems: readonly P[],
): P[] {
  return problems.filter((p) => p.aiMark != null && p.aiMark.notifiedAt == null);
}
