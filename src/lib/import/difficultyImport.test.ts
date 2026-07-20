import { describe, expect, it } from "vitest";
import { parseDifficultyFile } from "./difficultySchema";
import {
  planDifficultyGradings,
  toRow,
  type DifficultyCurrentState,
} from "./difficultyPlan";

const EXAM = {
  year: 2025,
  kind: "PREADMITERE",
  subject: "MATE",
  session: "varianta A",
} as const;

/** P3 of the calibration set — INSIGHT, band-margin 3.5★. */
const P3 = {
  exam: EXAM,
  number: "3",
  R: 4,
  E: 2,
  T: 0.5,
  P: 0.5,
  K: 0.25,
  V: -0.25,
  timp_tinta_min: 7,
  declansator:
    "variabile în ℕ* cu exponent fracționar p/q ⟹ baza e putere perfectă de ordin q",
};

function file(gradings: unknown[]): string {
  return JSON.stringify({ gradings });
}

describe("parseDifficultyFile", () => {
  it("accepts a grading block and defaults `incertitudine`", () => {
    const parsed = parseDifficultyFile(file([P3]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.gradings[0].incertitudine).toBe(false);
  });

  it("rejects off-scale axis values", () => {
    const parsed = parseDifficultyFile(file([{ ...P3, R: 4.25 }]));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain("R trebuie să fie");
  });

  it("rejects a modifier outside its own scale", () => {
    // 0.75 is legal for T but not for P.
    expect(parseDifficultyFile(file([{ ...P3, P: 0.75 }])).ok).toBe(false);
    expect(parseDifficultyFile(file([{ ...P3, T: 0.75 }])).ok).toBe(true);
  });

  it("treats a declared D_raw as a checksum", () => {
    expect(parseDifficultyFile(file([{ ...P3, D_raw: 5.4 }])).ok).toBe(true);

    const wrong = parseDifficultyFile(file([{ ...P3, D_raw: 5.9 }]));
    expect(wrong.ok).toBe(false);
    if (wrong.ok) return;
    expect(wrong.error).toContain("5.4");
  });

  it("rejects two gradings for the same problem", () => {
    const parsed = parseDifficultyFile(file([P3, { ...P3, R: 3 }]));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain("duplicat");
  });

  it("reports junk JSON instead of throwing", () => {
    expect(parseDifficultyFile("{nope").ok).toBe(false);
  });
});

describe("toRow", () => {
  it("derives every stored field from the six scores", () => {
    const parsed = parseDifficultyFile(file([P3]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const row = toRow(parsed.file.gradings[0]);
    expect(row.dRaw).toBe(5.4);
    expect(row.level).toBe(3.5);
    expect(row.bandMargin).toBe(true);
    expect(row.archetype).toBe("INSIGHT");
    expect(row.uncertain).toBe(false);
  });
});

describe("planDifficultyGradings", () => {
  const key = "2025|PREADMITERE|MATE|varianta A#3";
  const gradings = (() => {
    const parsed = parseDifficultyFile(file([P3]));
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.file.gradings;
  })();

  it("sets a grading on an ungraded problem", () => {
    const state: DifficultyCurrentState = new Map([
      [key, { problemId: "p1", current: null }],
    ]);
    const plan = planDifficultyGradings(state, gradings);
    expect(plan.counts).toEqual({ set: 1, skipped: 0, unmatched: 0 });
    expect(plan.assignments[0].problemId).toBe("p1");
    expect(plan.assignments[0].fromLevel).toBeNull();
  });

  it("is idempotent: re-importing the same grading is a skip", () => {
    const state: DifficultyCurrentState = new Map([
      [key, { problemId: "p1", current: toRow(gradings[0]) }],
    ]);
    const plan = planDifficultyGradings(state, gradings);
    expect(plan.counts).toEqual({ set: 0, skipped: 1, unmatched: 0 });
  });

  it("re-sets when any stored field drifts", () => {
    const state: DifficultyCurrentState = new Map([
      [key, { problemId: "p1", current: { ...toRow(gradings[0]), targetMinutes: 99 } }],
    ]);
    const plan = planDifficultyGradings(state, gradings);
    expect(plan.counts.set).toBe(1);
    expect(plan.assignments[0].fromLevel).toBe(3.5);
  });

  it("reports a grading whose problem does not exist", () => {
    const plan = planDifficultyGradings(new Map(), gradings);
    expect(plan.counts).toEqual({ set: 0, skipped: 0, unmatched: 1 });
    expect(plan.assignments[0].problemId).toBeUndefined();
  });
});
