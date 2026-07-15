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
}

/**
 * A departajare problem counts as done if it has an independent solution
 * ("singur") OR was verified correct on the grila before any reveal AND
 * within the first 2 tries ("grila", 1st/2nd choice).
 *
 * Owner decision (2026-07-15): a quick grila check counts toward progress even
 * when no written solution was submitted — sometimes you just confirm the
 * answer and move on. But needing 3+ tries means you were guessing: the
 * problem keeps its "grila" status yet stays in the remaining counter.
 * AI-only ("doar_ai") still does NOT count (rule 4 review still holds).
 */
export function isDone(problem: ProblemProgressInput): boolean {
  const attempts = problem.attempts ?? [];
  const state = solveState(problem.solutions, attempts);
  if (state === "singur") return true;
  return state === "grila" && grilaCountsAsDone(attempts);
}

/** Rule 3: THE counter — departajare problems not yet done (singur or grila). */
export function remainingCount(
  problems: readonly ProblemProgressInput[],
): number {
  return problems.filter((p) => p.isDepartajare && !isDone(p)).length;
}

export interface ExamProgress {
  done: number;
  total: number;
}

/** Departajare progress within one exam (non-departajare problems don't count). */
export function examProgress(
  problems: readonly ProblemProgressInput[],
): ExamProgress {
  const departajare = problems.filter((p) => p.isDepartajare);
  return {
    done: departajare.filter(isDone).length,
    total: departajare.length,
  };
}
