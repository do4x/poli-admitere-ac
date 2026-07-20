/** An AI mark reduced to what state derivation needs. */
export interface AiMarkLike {
  dueAt: Date;
  redeemedAt: Date | null;
}

export type AiPhase = "window" | "due" | "redeemed";

/**
 * Where a user's AI mark stands at `now`:
 * - "window"   — inside the re-solve window; the problem shows "doar cu AI".
 * - "due"      — window passed, not redeemed: the problem resets to unsolved
 *                and its AI solutions hide until redemption.
 * - "redeemed" — a correct grila answer after dueAt (untainted by reveal) or
 *                an independent upload settled it; stamped server-side.
 */
export function aiPhase(
  mark: AiMarkLike | null | undefined,
  now: Date,
): AiPhase | null {
  if (!mark) return null;
  if (mark.redeemedAt !== null) return "redeemed";
  return now.getTime() < mark.dueAt.getTime() ? "window" : "due";
}
