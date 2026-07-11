import { describe, expect, it } from "vitest";
import { examKey, type TagsFile } from "./tagsSchema";
import { planTagAssignments, type TagCurrentState } from "./tagsPlan";

const exam2024 = {
  year: 2024 as const,
  kind: "ADMITERE" as const,
  subject: "MATE" as const,
  session: "iulie",
};
const key2024 = examKey(exam2024);

function state(over: Partial<TagCurrentState> = {}): TagCurrentState {
  return {
    problems: new Map([
      [`${key2024}#1`, { problemId: "p1", currentTypes: [] }],
    ]),
    existingTags: new Set<string>(),
    ...over,
  };
}

function file(over: Partial<TagsFile> = {}): TagsFile {
  return {
    assignments: [{ exam: exam2024, number: "1", types: ["integrale"] }],
    ...over,
  };
}

describe("planTagAssignments", () => {
  it("plans a 'set' for a matched problem with different tags", () => {
    const plan = planTagAssignments(state(), file());
    expect(plan.counts).toEqual({ set: 1, skipped: 0, unmatched: 0 });
    expect(plan.assignments[0]).toMatchObject({
      action: "set",
      problemId: "p1",
      from: [],
      to: ["integrale"],
    });
    expect(plan.newTagsToCreate).toEqual([
      { subject: "MATE", name: "integrale" },
    ]);
  });

  it("is idempotent — identical existing tags plan as skip, no new tags", () => {
    const s = state({
      problems: new Map([
        [`${key2024}#1`, { problemId: "p1", currentTypes: ["integrale"] }],
      ]),
      existingTags: new Set(["MATE|integrale"]),
    });
    const plan = planTagAssignments(s, file());
    expect(plan.counts).toEqual({ set: 0, skipped: 1, unmatched: 0 });
    expect(plan.newTagsToCreate).toEqual([]);
  });

  it("treats tag order as insignificant when deciding skip", () => {
    const s = state({
      problems: new Map([
        [
          `${key2024}#1`,
          { problemId: "p1", currentTypes: ["sisteme", "integrale"] },
        ],
      ]),
      existingTags: new Set(["MATE|integrale", "MATE|sisteme"]),
    });
    const plan = planTagAssignments(
      s,
      file({
        assignments: [
          { exam: exam2024, number: "1", types: ["integrale", "sisteme"] },
        ],
      }),
    );
    expect(plan.assignments[0].action).toBe("skip");
  });

  it("reports assignments whose problem cannot be found as unmatched", () => {
    const plan = planTagAssignments(
      state(),
      file({ assignments: [{ exam: exam2024, number: "99", types: ["x"] }] }),
    );
    expect(plan.counts.unmatched).toBe(1);
    expect(plan.assignments[0].action).toBe("unmatched");
    // Unmatched assignments never create tags — nowhere to attach them.
    expect(plan.newTagsToCreate).toEqual([]);
  });

  it("creates seed tags even when no assignment uses them", () => {
    const plan = planTagAssignments(
      state(),
      file({ tags: [{ subject: "INFO", name: "grafuri" }] }),
    );
    const names = plan.newTagsToCreate.map((t) => `${t.subject}|${t.name}`);
    expect(names).toContain("INFO|grafuri");
    expect(names).toContain("MATE|integrale");
  });

  it("does not re-create tags that already exist in the DB", () => {
    const plan = planTagAssignments(
      state({ existingTags: new Set(["MATE|integrale"]) }),
      file({ tags: [{ subject: "MATE", name: "integrale" }] }),
    );
    expect(plan.newTagsToCreate).toEqual([]);
  });

  it("deduplicates a tag referenced by both seed list and an assignment", () => {
    const plan = planTagAssignments(
      state(),
      file({ tags: [{ subject: "MATE", name: "integrale" }] }),
    );
    expect(
      plan.newTagsToCreate.filter((t) => t.name === "integrale"),
    ).toHaveLength(1);
  });
});
