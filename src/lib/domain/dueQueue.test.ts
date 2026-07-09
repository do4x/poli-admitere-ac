import { describe, expect, it } from "vitest";
import { dueSolutions, unnotified } from "./dueQueue";

const NOW = new Date("2026-04-01T12:00:00.000Z");
const BEFORE = new Date("2026-03-31T12:00:00.000Z");
const AFTER = new Date("2026-04-02T12:00:00.000Z");

function ai(reviewDueAt: Date | null, notifiedAt: Date | null = null) {
  return { aiAssisted: true, reviewDueAt, notifiedAt };
}
const independent = { aiAssisted: false, reviewDueAt: null, notifiedAt: null };

describe("dueSolutions (rule 5)", () => {
  it("returns an AI solution whose review date has passed", () => {
    const items = dueSolutions([{ solutions: [ai(BEFORE)] }], NOW);
    expect(items).toHaveLength(1);
  });

  it("includes a review due exactly now (<=, not <)", () => {
    expect(dueSolutions([{ solutions: [ai(NOW)] }], NOW)).toHaveLength(1);
  });

  it("excludes reviews due in the future", () => {
    expect(dueSolutions([{ solutions: [ai(AFTER)] }], NOW)).toHaveLength(0);
  });

  it("excludes solutions without a review date", () => {
    expect(dueSolutions([{ solutions: [ai(null)] }], NOW)).toHaveLength(0);
  });

  it("never includes independent solutions", () => {
    expect(dueSolutions([{ solutions: [independent] }], NOW)).toHaveLength(0);
  });

  it("an independent solution clears the whole problem from the queue permanently", () => {
    const items = dueSolutions(
      [{ solutions: [ai(BEFORE), independent] }],
      NOW,
    );
    expect(items).toHaveLength(0);
  });

  it("lists every due AI solution of a still-unsolved problem", () => {
    const items = dueSolutions(
      [{ solutions: [ai(BEFORE), ai(NOW), ai(AFTER)] }],
      NOW,
    );
    expect(items).toHaveLength(2);
  });

  it("handles multiple problems independently", () => {
    const solved = { solutions: [ai(BEFORE), independent] };
    const unsolved = { solutions: [ai(BEFORE)] };
    const notYetDue = { solutions: [ai(AFTER)] };
    expect(dueSolutions([solved, unsolved, notYetDue], NOW)).toHaveLength(1);
  });
});

describe("unnotified (digest dedupe input)", () => {
  it("keeps only items that were never emailed", () => {
    const problem = { solutions: [] };
    const items = [
      { problem, solution: ai(BEFORE, null) },
      { problem, solution: ai(BEFORE, BEFORE) },
    ];
    expect(unnotified(items)).toHaveLength(1);
    expect(unnotified(items)[0]!.solution.notifiedAt).toBeNull();
  });
});
