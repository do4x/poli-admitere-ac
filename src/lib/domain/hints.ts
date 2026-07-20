import type { AttemptLike } from "./solveState";

/** The two halves a `trigger` is served as. */
export interface Hints {
  /** Level 1 — the signal to spot in the statement. Public. */
  signal: string;
  /** Level 2 — the move it licenses. Admin-only for now. */
  move: string;
}

/** Highest hint level that exists. */
export const MAX_HINT_LEVEL = 2;

const ARROW = "⟹";

/**
 * Split a grading's `trigger` into its two hints.
 *
 * Triggers are written as `semnal din enunț ⟹ mișcare` (DIFICULTATE.md §12),
 * so the arrow is the natural seam: hint 1 says where to look, hint 2 says what
 * to do. Splitting by character count would cut mid-sentence and leak the move
 * into the nudge.
 *
 * Returns null when the text has no arrow — such a trigger is one lump and
 * cannot be served as a progressive hint.
 */
export function splitHints(trigger: string | null | undefined): Hints | null {
  if (!trigger) return null;
  const at = trigger.indexOf(ARROW);
  if (at < 0) return null;

  const signal = trigger.slice(0, at).trim();
  const move = trigger.slice(at + ARROW.length).trim();
  if (!signal || !move) return null;
  return { signal, move };
}

/** The hint text for a level, or null when that level does not exist. */
export function hintAt(hints: Hints | null, level: number): string | null {
  if (!hints) return null;
  if (level === 1) return hints.signal;
  if (level === 2) return hints.move;
  return null;
}

/** An attempt carrying the timestamp needed to interleave it with hints. */
export type TimedAttemptLike = AttemptLike & { createdAt: Date };

/**
 * Fold hint reveals into the chronological attempt stream as REVEAL events.
 *
 * A hint is help, so the same rule the answer key already obeys applies: every
 * choice made AFTER it stops proving anything, while a correct answer given
 * BEFORE the hint still stands. Modelling it as a REVEAL rather than a new flag
 * means `solveState`, `grilaCountsAsDone` and the dashboard counter inherit the
 * behaviour unchanged — there is no second definition of "tainted" to keep in
 * sync.
 */
export function withHintTaint(
  attempts: readonly TimedAttemptLike[],
  hintDates: readonly Date[],
): AttemptLike[] {
  if (hintDates.length === 0) {
    return attempts.map(({ kind, correct }) => ({ kind, correct }));
  }

  const events: { at: number; attempt: AttemptLike }[] = [
    ...attempts.map((a) => ({
      at: a.createdAt.getTime(),
      attempt: { kind: a.kind, correct: a.correct },
    })),
    ...hintDates.map((at) => ({
      at: at.getTime(),
      attempt: { kind: "REVEAL" as const, correct: null },
    })),
  ];

  // Stable by timestamp; a hint opened in the same millisecond as an answer is
  // treated as coming first, which is the conservative reading.
  return events
    .sort((a, b) => a.at - b.at || (a.attempt.kind === "REVEAL" ? -1 : 1))
    .map((e) => e.attempt);
}
