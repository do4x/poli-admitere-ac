import { describe, expect, it } from "vitest";
import {
  REVIEW_DELAY_MS,
  computeReviewDueAt,
  hasIndependentSolution,
  isIndependent,
} from "./solutions";

describe("isIndependent (rule 1)", () => {
  it("is true for a solution without AI assistance", () => {
    expect(isIndependent({ aiAssisted: false })).toBe(true);
  });

  it("is false for an AI-assisted solution", () => {
    expect(isIndependent({ aiAssisted: true })).toBe(false);
  });
});

describe("hasIndependentSolution (rule 2)", () => {
  it("is false with no solutions at all", () => {
    expect(hasIndependentSolution({ solutions: [] })).toBe(false);
  });

  it("is false when every solution is AI-assisted — AI never counts", () => {
    expect(
      hasIndependentSolution({
        solutions: [{ aiAssisted: true }, { aiAssisted: true }],
      }),
    ).toBe(false);
  });

  it("is true when at least one independent solution exists", () => {
    expect(
      hasIndependentSolution({
        solutions: [{ aiAssisted: true }, { aiAssisted: false }],
      }),
    ).toBe(true);
  });
});

describe("computeReviewDueAt (rule 4)", () => {
  const submittedAt = new Date("2026-03-10T14:30:00.000Z");

  it("is null for an independent solution", () => {
    expect(computeReviewDueAt(submittedAt, false)).toBeNull();
  });

  it("is exactly 96 hours after submission for an AI-assisted solution", () => {
    const due = computeReviewDueAt(submittedAt, true);
    expect(due).not.toBeNull();
    expect(due!.getTime() - submittedAt.getTime()).toBe(96 * 60 * 60 * 1000);
    expect(due!.toISOString()).toBe("2026-03-14T14:30:00.000Z");
  });

  it("REVIEW_DELAY_MS is exactly 4 days", () => {
    expect(REVIEW_DELAY_MS).toBe(4 * 24 * 60 * 60 * 1000);
  });
});
