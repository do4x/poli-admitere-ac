import { aiPhase, type AiMarkLike, type AiPhase } from "./aiMark";
import { isIndependent } from "./solutions";

/** The four solve states a problem can be in, for filtering on /probleme. */
export type SolveState = "nerezolvata" | "grila" | "doar_ai" | "singur";

/** An answer attempt reduced to what state derivation needs (chronological order). */
export interface AttemptLike {
  kind: "CHOICE" | "REVEAL";
  correct: boolean | null;
}

/**
 * Derive a problem's solve state (business rules 1–2 + grila ladder + the
 * 2026-07-18 AI-mark rules):
 * - ≥1 independent solution        → "singur" (done)
 * - AI mark redeemed               → "singur" when an uploaded solution backs
 *                                     it ("the initial submission reappears"),
 *                                     otherwise "grila" (rezolvat pe grilă)
 * - AI mark inside its 72h window  → "doar_ai"
 * - AI mark past due, unredeemed   → "nerezolvata" (the reset — de refăcut)
 * - AI solutions, no mark (legacy) → "doar_ai"
 * - correct grila answer submitted
 *   BEFORE any reveal              → "grila" (self-checked, no written proof)
 * - otherwise                      → "nerezolvata"
 *
 * A REVEAL taints all later attempts: once the key was seen, a correct
 * choice no longer demonstrates anything. Attempts must be passed in
 * chronological order. Redemption itself is stamped server-side at answer
 * time, so no attempt timestamps are needed here.
 */
export function solveState(
  solutions: readonly { aiAssisted: boolean }[],
  attempts: readonly AttemptLike[] = [],
  aiMark: AiMarkLike | null = null,
  now: Date = new Date(),
): SolveState {
  if (solutions.some(isIndependent)) return "singur";

  const phase = aiPhase(aiMark, now);
  if (phase === "redeemed") return solutions.length > 0 ? "singur" : "grila";
  if (phase === "window") return "doar_ai";
  if (phase === "due") return "nerezolvata";
  if (solutions.length > 0) return "doar_ai";

  let revealed = false;
  for (const attempt of attempts) {
    if (attempt.kind === "REVEAL") {
      revealed = true;
    } else if (attempt.correct === true && !revealed) {
      return "grila";
    }
  }
  return "nerezolvata";
}

/** A grila check counts toward the completion goal only when the correct
 * answer came this early (owner decision 2026-07-15). */
export const GRILA_MAX_TRIES = 2;

/**
 * True iff the first pre-reveal correct choice was among the first
 * `maxTries` choices. Guessing your way to green in 3+ tries keeps the
 * "grila" status but does NOT count as done — the counter stays put.
 * Attempts must be passed in chronological order; REVEAL taints everything
 * after it, same as in `solveState`. (Grila redemption of an AI mark is
 * exempt from the try limit — see `isDone`.)
 */
/**
 * True once the grila is closed for good: a correct choice is already in, so
 * re-answering proves nothing and only inflates the try history.
 *
 * The single exception is a past-due AI mark ("due"): there a correct answer
 * is the redemption path, so the grila must reopen even though an older
 * correct attempt exists.
 */
export function grilaLocked(
  attempts: readonly AttemptLike[],
  phase: AiPhase | null = null,
): boolean {
  if (phase === "due") return false;
  return attempts.some((a) => a.kind === "CHOICE" && a.correct === true);
}

export function grilaCountsAsDone(
  attempts: readonly AttemptLike[],
  maxTries: number = GRILA_MAX_TRIES,
): boolean {
  let revealed = false;
  let tries = 0;
  for (const attempt of attempts) {
    if (attempt.kind === "REVEAL") {
      revealed = true;
      continue;
    }
    tries++;
    if (attempt.correct === true && !revealed) {
      return tries <= maxTries;
    }
  }
  return false;
}
