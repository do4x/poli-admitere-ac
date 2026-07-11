import { examKey, type SeedTag, type TagAssignment } from "./tagsSchema";

export type TagPlanAction = "set" | "skip" | "unmatched";

export interface PlannedAssignment {
  examKey: string;
  number: string;
  subject: string;
  action: TagPlanAction;
  /** Current tag names on the problem (empty when unmatched). */
  from: string[];
  /** Desired tag names from the file. */
  to: string[];
  /** Present only when the problem was resolved. */
  problemId?: string;
}

export interface TagPlan {
  assignments: PlannedAssignment[];
  /** (subject, name) tag rows that do not yet exist and must be created. */
  newTagsToCreate: SeedTag[];
  counts: { set: number; skipped: number; unmatched: number };
}

/** A resolved problem: its id and the tag names currently attached. */
export interface CurrentProblem {
  problemId: string;
  currentTypes: string[];
}

export interface TagCurrentState {
  /** Resolvable problems keyed by `${examKey}#${number}`. */
  problems: Map<string, CurrentProblem>;
  /** Existing tag identities keyed by `${subject}|${name}`. */
  existingTags: Set<string>;
}

/** Order-insensitive set equality over tag names. */
export function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/**
 * Decide, without touching the DB, what a tags import would do.
 * Idempotency contract: planning a file against its own previous import result
 * yields only "skip" actions and no new tags.
 */
export function planTagAssignments(
  state: TagCurrentState,
  file: { tags?: readonly SeedTag[]; assignments: readonly TagAssignment[] },
): TagPlan {
  const assignments: PlannedAssignment[] = file.assignments.map((a) => {
    const key = examKey(a.exam);
    const lookupKey = `${key}#${a.number}`;
    const current = state.problems.get(lookupKey);
    const base = {
      examKey: key,
      number: a.number,
      subject: a.exam.subject,
      to: a.types,
    };
    if (!current) {
      return { ...base, action: "unmatched" as const, from: [] };
    }
    const action: TagPlanAction = sameSet(current.currentTypes, a.types)
      ? "skip"
      : "set";
    return {
      ...base,
      action,
      from: current.currentTypes,
      problemId: current.problemId,
    };
  });

  // Every (subject, name) the file wants: seed list + names used by matched
  // or matchable assignments. Unmatched assignments do not create tags —
  // there is no problem to attach them to.
  const wanted = new Set<string>();
  const newTagsToCreate: SeedTag[] = [];
  const remember = (subject: string, name: string) => {
    const identity = `${subject}|${name}`;
    if (state.existingTags.has(identity) || wanted.has(identity)) return;
    wanted.add(identity);
    newTagsToCreate.push({ subject, name });
  };
  for (const seed of file.tags ?? []) remember(seed.subject, seed.name);
  for (const planned of assignments) {
    if (planned.action === "unmatched") continue;
    for (const name of planned.to) remember(planned.subject, name);
  }

  return {
    assignments,
    newTagsToCreate,
    counts: {
      set: assignments.filter((a) => a.action === "set").length,
      skipped: assignments.filter((a) => a.action === "skip").length,
      unmatched: assignments.filter((a) => a.action === "unmatched").length,
    },
  };
}
