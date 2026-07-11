import { sameSet } from "./tagsPlan";

export type ProblemAction = "create" | "update" | "skip";

export interface ProblemFields {
  number: string;
  latex: string;
  isDepartajare: boolean;
}

/** An existing DB problem, optionally carrying its current tag names. */
export interface ExistingProblem extends ProblemFields {
  tags?: readonly { name: string }[];
}

/** An incoming problem from an import file, optionally specifying tag types. */
export interface IncomingProblem extends ProblemFields {
  /** Absent ⇒ tags untouched; present ⇒ tag set replaced with exactly these. */
  types?: readonly string[];
}

export interface PlannedProblem extends ProblemFields {
  action: ProblemAction;
  /**
   * Present on updates that flip isDepartajare. Import follows upsert
   * semantics (file wins), so a re-import can silently revert a flag set via
   * the UI toggle — callers must surface this to the owner.
   */
  departajareChange?: { from: boolean; to: boolean };
  /**
   * Present only when the file specified `types` AND the resulting tag set
   * differs from the current one. Carries the tag names to write.
   */
  tagChange?: { from: string[]; to: string[] };
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
  existing: readonly ExistingProblem[],
  incoming: readonly IncomingProblem[],
  examExists: boolean,
): ImportPlan {
  const byNumber = new Map(existing.map((p) => [p.number, p]));
  const problems: PlannedProblem[] = incoming.map((p) => {
    const current = byNumber.get(p.number);
    const currentTags = current?.tags?.map((t) => t.name) ?? [];
    const tagsSpecified = p.types !== undefined;
    const desiredTags = p.types ? [...p.types] : [];
    const tagsDiffer = tagsSpecified && !sameSet(currentTags, desiredTags);

    let action: ProblemAction;
    if (!current) {
      action = "create";
    } else if (
      current.latex === p.latex &&
      current.isDepartajare === p.isDepartajare &&
      !tagsDiffer
    ) {
      action = "skip";
    } else {
      action = "update";
    }

    const planned: PlannedProblem = {
      number: p.number,
      latex: p.latex,
      isDepartajare: p.isDepartajare,
      action,
    };
    if (current && current.isDepartajare !== p.isDepartajare) {
      planned.departajareChange = {
        from: current.isDepartajare,
        to: p.isDepartajare,
      };
    }
    // Write tags on create (when any are specified) or whenever they differ.
    if (tagsSpecified && (tagsDiffer || (!current && desiredTags.length > 0))) {
      planned.tagChange = { from: currentTags, to: desiredTags };
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
