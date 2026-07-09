import { describe, expect, it } from "vitest";
import { examProgress, isDone, remainingCount } from "./progress";

const independent = { aiAssisted: false };
const aiAssisted = { aiAssisted: true };

describe("remainingCount (rule 3 — THE counter)", () => {
  it("is 0 for an empty database (DoD 1)", () => {
    expect(remainingCount([])).toBe(0);
  });

  it("ignores non-departajare problems entirely", () => {
    expect(
      remainingCount([
        { isDepartajare: false, solutions: [] },
        { isDepartajare: false, solutions: [aiAssisted] },
      ]),
    ).toBe(0);
  });

  it("counts a departajare problem with no solutions", () => {
    expect(remainingCount([{ isDepartajare: true, solutions: [] }])).toBe(1);
  });

  it("still counts a departajare problem with only AI-assisted solutions (rule 2)", () => {
    expect(
      remainingCount([
        { isDepartajare: true, solutions: [aiAssisted, aiAssisted] },
      ]),
    ).toBe(1);
  });

  it("does not count a departajare problem with an independent solution", () => {
    expect(
      remainingCount([{ isDepartajare: true, solutions: [independent] }]),
    ).toBe(0);
  });

  it("a mix of AI and independent solutions counts as done", () => {
    expect(
      remainingCount([
        { isDepartajare: true, solutions: [aiAssisted, independent] },
      ]),
    ).toBe(0);
  });

  it("counts across many problems", () => {
    expect(
      remainingCount([
        { isDepartajare: true, solutions: [] }, // remaining
        { isDepartajare: true, solutions: [aiAssisted] }, // remaining
        { isDepartajare: true, solutions: [independent] }, // done
        { isDepartajare: false, solutions: [] }, // irrelevant
      ]),
    ).toBe(2);
  });
});

describe("isDone", () => {
  it("requires an independent solution", () => {
    expect(isDone({ isDepartajare: true, solutions: [aiAssisted] })).toBe(false);
    expect(isDone({ isDepartajare: true, solutions: [independent] })).toBe(true);
  });
});

describe("examProgress", () => {
  it("is 0/0 for an exam without departajare problems", () => {
    expect(
      examProgress([{ isDepartajare: false, solutions: [independent] }]),
    ).toEqual({ done: 0, total: 0 });
  });

  it("counts only departajare problems", () => {
    expect(
      examProgress([
        { isDepartajare: true, solutions: [independent] },
        { isDepartajare: true, solutions: [aiAssisted] },
        { isDepartajare: true, solutions: [] },
        { isDepartajare: false, solutions: [independent] },
      ]),
    ).toEqual({ done: 1, total: 3 });
  });
});
