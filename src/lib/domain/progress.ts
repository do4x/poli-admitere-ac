import type { AiMarkLike } from "./aiMark";
import {
  grilaCountsAsDone,
  solveState,
  type AttemptLike,
} from "./solveState";

export interface ProblemProgressInput {
  isDepartajare: boolean;
  solutions: readonly { aiAssisted: boolean }[];
  /** Chronological grila attempts; needed so a grila check counts as progress. */
  attempts?: readonly AttemptLike[];
  /** The user's AI mark, if any. */
  aiMark?: AiMarkLike | null;
}

/**
 * A departajare problem counts as done if it has an independent solution
 * ("singur") OR was verified correct on the grila before any reveal AND
 * within the first 2 tries ("grila", 1st/2nd choice).
 *
 * Owner decision (2026-07-15): a quick grila check counts toward progress even
 * when no written solution was submitted. Needing 3+ tries means you were
 * guessing: "grila" status but still remaining. Owner revision (2026-07-18):
 * redeeming an AI mark — a correct grila answer after the re-solve window — counts
 * regardless of the number of tries; solving with AI alone still never counts.
 */
export function isDone(
  problem: ProblemProgressInput,
  now: Date = new Date(),
): boolean {
  const attempts = problem.attempts ?? [];
  const aiMark = problem.aiMark ?? null;
  const state = solveState(problem.solutions, attempts, aiMark, now);
  if (state === "singur") return true;
  if (state !== "grila") return false;
  return grilaCountsAsDone(attempts) || aiMark?.redeemedAt != null;
}

/** Rule 3: THE counter — departajare problems not yet done (singur or grila). */
export function remainingCount(
  problems: readonly ProblemProgressInput[],
  now: Date = new Date(),
): number {
  return problems.filter((p) => p.isDepartajare && !isDone(p, now)).length;
}

export interface ExamProgress {
  done: number;
  total: number;
}

/** Departajare progress within one exam (non-departajare problems don't count). */
export function examProgress(
  problems: readonly ProblemProgressInput[],
  now: Date = new Date(),
): ExamProgress {
  const departajare = problems.filter((p) => p.isDepartajare);
  return {
    done: departajare.filter((p) => isDone(p, now)).length,
    total: departajare.length,
  };
}
