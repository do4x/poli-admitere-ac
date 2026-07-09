export type ProblemAction = "create" | "update" | "skip";

export interface ProblemFields {
  number: string;
  latex: string;
  isDepartajare: boolean;
}

export interface PlannedProblem extends ProblemFields {
  action: ProblemAction;
  /**
   * Present on updates that flip isDepartajare. Import follows upsert
   * semantics (file wins), so a re-import can silently revert a flag set via
   * the UI toggle — callers must surface this to the owner.
   */
  departajareChange?: { from: boolean; to: boolean };
}

export interface ImportPlan {
  examExists: boolean;
  problems: PlannedProblem[];
  counts: { created: number; updated: number; skipped: number };
}

/**
 * Decide, without touching the DB, what an import would do.
 * Idempotency contract: planning the same file against its own previous
 * import result yields only "skip" actions.
 */
export function planImport(
  existing: readonly ProblemFields[],
  incoming: readonly ProblemFields[],
  examExists: boolean,
): ImportPlan {
  const byNumber = new Map(existing.map((p) => [p.number, p]));
  const problems: PlannedProblem[] = incoming.map((p) => {
    const current = byNumber.get(p.number);
    let action: ProblemAction;
    if (!current) {
      action = "create";
    } else if (
      current.latex === p.latex &&
      current.isDepartajare === p.isDepartajare
    ) {
      action = "skip";
    } else {
      action = "update";
    }
    const planned: PlannedProblem = { ...p, action };
    if (current && current.isDepartajare !== p.isDepartajare) {
      planned.departajareChange = {
        from: current.isDepartajare,
        to: p.isDepartajare,
      };
    }
    return planned;
  });

  return {
    examExists,
    problems,
    counts: {
      created: problems.filter((p) => p.action === "create").length,
      updated: problems.filter((p) => p.action === "update").length,
      skipped: problems.filter((p) => p.action === "skip").length,
    },
  };
}
