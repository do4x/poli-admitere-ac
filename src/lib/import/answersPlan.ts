import { examKey } from "./tagsSchema";
import type { AnswerAssignment } from "./answersSchema";

export type AnswerPlanAction = "set" | "skip" | "unmatched";

export interface PlannedAnswer {
  examKey: string;
  number: string;
  action: AnswerPlanAction;
  /** Current key on the problem (null when none/unmatched). */
  from: string | null;
  /** Desired key from the file. */
  to: string;
  /** Present only when the problem was resolved. */
  problemId?: string;
}

export interface AnswersPlan {
  assignments: PlannedAnswer[];
  counts: { set: number; skipped: number; unmatched: number };
}

/** Resolvable problems keyed by `${examKey}#${number}`. */
export type AnswersCurrentState = Map<
  string,
  { problemId: string; currentAnswer: string | null }
>;

/**
 * Decide, without touching the DB, what an answers import would do.
 * Idempotency contract: planning a file against its own previous import
 * result yields only "skip" actions.
 */
export function planAnswerAssignments(
  state: AnswersCurrentState,
  assignments: readonly AnswerAssignment[],
): AnswersPlan {
  const planned: PlannedAnswer[] = assignments.map((a) => {
    const key = examKey(a.exam);
    const current = state.get(`${key}#${a.number}`);
    if (!current) {
      return { examKey: key, number: a.number, action: "unmatched", from: null, to: a.answer };
    }
    return {
      examKey: key,
      number: a.number,
      action: current.currentAnswer === a.answer ? "skip" : "set",
      from: current.currentAnswer,
      to: a.answer,
      problemId: current.problemId,
    };
  });

  return {
    assignments: planned,
    counts: {
      set: planned.filter((a) => a.action === "set").length,
      skipped: planned.filter((a) => a.action === "skip").length,
      unmatched: planned.filter((a) => a.action === "unmatched").length,
    },
  };
}
