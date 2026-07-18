import { describe, expect, it } from "vitest";
import {
  REVIEW_DELAY_MS,
  computeAiDueAt,
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

describe("computeAiDueAt (rule 4, 72h revision 2026-07-18)", () => {
  const markedAt = new Date("2026-03-10T14:30:00.000Z");

  it("is exactly 72 hours after the mark", () => {
    const due = computeAiDueAt(markedAt);
    expect(due.getTime() - markedAt.getTime()).toBe(72 * 60 * 60 * 1000);
    expect(due.toISOString()).toBe("2026-03-13T14:30:00.000Z");
  });

  it("REVIEW_DELAY_MS is exactly 3 days", () => {
    expect(REVIEW_DELAY_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });
});
