import { describe, expect, it } from "vitest";
import { parseAnswersFile } from "./answersSchema";
import {
  planAnswerAssignments,
  type AnswersCurrentState,
} from "./answersPlan";
import { examKey } from "./tagsSchema";

const exam2024 = {
  year: 2024 as const,
  kind: "ADMITERE" as const,
  subject: "MATE" as const,
  session: "iulie",
};
const key2024 = examKey(exam2024);

function validFile() {
  // Copy the exam: one test deletes `session` and must not mutate the
  // shared fixture used by the planner tests below.
  return {
    assignments: [{ exam: { ...exam2024 }, number: "1", answer: "b" }],
  };
}

describe("parseAnswersFile", () => {
  it("parses a valid file and defaults missing session to null", () => {
    const file = validFile();
    delete (file.assignments[0].exam as { session?: string }).session;
    const result = parseAnswersFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.assignments[0].exam.session).toBeNull();
  });

  it("strips a leading BOM", () => {
    expect(parseAnswersFile("﻿" + JSON.stringify(validFile())).ok).toBe(true);
  });

  it("rejects answers outside a-f", () => {
    const file = validFile();
    file.assignments[0].answer = "g";
    expect(parseAnswersFile(JSON.stringify(file)).ok).toBe(false);
  });

  it("rejects duplicate (exam, number) pairs", () => {
    const file = validFile();
    file.assignments.push({ ...file.assignments[0], answer: "c" });
    const result = parseAnswersFile(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicat");
  });

  it("rejects invalid JSON and empty assignment lists", () => {
    expect(parseAnswersFile("{oops").ok).toBe(false);
    expect(parseAnswersFile(JSON.stringify({ assignments: [] })).ok).toBe(false);
  });
});

function state(entries: [string, { problemId: string; currentAnswer: string | null }][]): AnswersCurrentState {
  return new Map(entries);
}

describe("planAnswerAssignments", () => {
  const assignment = { exam: exam2024, number: "1", answer: "b" as const };

  it("plans a set when the stored key differs (incl. none)", () => {
    const plan = planAnswerAssignments(
      state([[`${key2024}#1`, { problemId: "p1", currentAnswer: null }]]),
      [assignment],
    );
    expect(plan.counts).toEqual({ set: 1, skipped: 0, unmatched: 0 });
    expect(plan.assignments[0]).toMatchObject({
      action: "set",
      from: null,
      to: "b",
      problemId: "p1",
    });
  });

  it("is idempotent — identical key plans as skip", () => {
    const plan = planAnswerAssignments(
      state([[`${key2024}#1`, { problemId: "p1", currentAnswer: "b" }]]),
      [assignment],
    );
    expect(plan.counts).toEqual({ set: 0, skipped: 1, unmatched: 0 });
  });

  it("reports unresolvable problems as unmatched", () => {
    const plan = planAnswerAssignments(state([]), [assignment]);
    expect(plan.counts.unmatched).toBe(1);
    expect(plan.assignments[0].problemId).toBeUndefined();
  });

  it("overwrites a different existing key (correction flow)", () => {
    const plan = planAnswerAssignments(
      state([[`${key2024}#1`, { problemId: "p1", currentAnswer: "d" }]]),
      [assignment],
    );
    expect(plan.assignments[0]).toMatchObject({ action: "set", from: "d", to: "b" });
  });
});
