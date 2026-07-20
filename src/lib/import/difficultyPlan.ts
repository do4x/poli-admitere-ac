import { grade, type Archetype, type GradedDifficulty } from "@/lib/domain";
import { examKey } from "./tagsSchema";
import type { DifficultyGrading } from "./difficultySchema";

export type DifficultyPlanAction = "set" | "skip" | "unmatched";

/** The row a grading resolves to, ready for the DB. */
export interface DifficultyRow extends GradedDifficulty {
  targetMinutes: number;
  trigger: string | null;
  uncertain: boolean;
}

export interface PlannedDifficulty {
  examKey: string;
  number: string;
  action: DifficultyPlanAction;
  /** Level currently stored (null when ungraded/unmatched). */
  fromLevel: number | null;
  row: DifficultyRow;
  /** Present only when the problem was resolved. */
  problemId?: string;
}

export interface DifficultyPlan {
  assignments: PlannedDifficulty[];
  counts: { set: number; skipped: number; unmatched: number };
}

/**
 * A grading as it comes back out of the DB: same fields, but `level` is a
 * plain number there — Postgres does not know about the half-star union.
 */
export type StoredDifficulty = Omit<DifficultyRow, "level"> & {
  level: number;
  archetype: Archetype;
};

/** Resolvable problems keyed by `${examKey}#${number}`. */
export type DifficultyCurrentState = Map<
  string,
  { problemId: string; current: StoredDifficulty | null }
>;

/** Derive the full DB row from a grading block. */
export function toRow(g: DifficultyGrading): DifficultyRow {
  return {
    ...grade({ r: g.R, e: g.E, t: g.T, p: g.P, k: g.K, v: g.V }),
    targetMinutes: g.timp_tinta_min,
    trigger: g.declansator ?? null,
    uncertain: g.incertitudine,
  };
}

/** Two gradings are the same iff every stored field matches. */
function same(a: StoredDifficulty, b: DifficultyRow): boolean {
  return (
    a.r === b.r &&
    a.e === b.e &&
    a.t === b.t &&
    a.p === b.p &&
    a.k === b.k &&
    a.v === b.v &&
    a.dRaw === b.dRaw &&
    a.level === b.level &&
    a.bandMargin === b.bandMargin &&
    a.archetype === b.archetype &&
    a.targetMinutes === b.targetMinutes &&
    a.trigger === b.trigger &&
    a.uncertain === b.uncertain
  );
}

/**
 * Decide, without touching the DB, what a difficulty import would do.
 * Idempotency contract: planning a file against its own previous import
 * result yields only "skip" actions.
 */
export function planDifficultyGradings(
  state: DifficultyCurrentState,
  gradings: readonly DifficultyGrading[],
): DifficultyPlan {
  const planned: PlannedDifficulty[] = gradings.map((g) => {
    const key = examKey(g.exam);
    const row = toRow(g);
    const found = state.get(`${key}#${g.number}`);
    if (!found) {
      return {
        examKey: key,
        number: g.number,
        action: "unmatched",
        fromLevel: null,
        row,
      };
    }
    const unchanged = found.current !== null && same(found.current, row);
    return {
      examKey: key,
      number: g.number,
      action: unchanged ? "skip" : "set",
      fromLevel: found.current?.level ?? null,
      row,
      problemId: found.problemId,
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
