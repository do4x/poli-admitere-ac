import { hasIndependentSolution } from "./solutions";

export interface ProblemProgressInput {
  isDepartajare: boolean;
  solutions: readonly { aiAssisted: boolean }[];
}

export function isDone(problem: ProblemProgressInput): boolean {
  return hasIndependentSolution(problem);
}

/** Rule 3: THE counter — departajare problems with zero independent solutions. */
export function remainingCount(
  problems: readonly ProblemProgressInput[],
): number {
  return problems.filter(
    (p) => p.isDepartajare && !hasIndependentSolution(p),
  ).length;
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
