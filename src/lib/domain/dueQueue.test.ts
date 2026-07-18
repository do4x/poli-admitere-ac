import { describe, expect, it } from "vitest";
import { dueProblems, unnotified, type DueMarkInput } from "./dueQueue";

const NOW = new Date("2026-04-10T09:00:00.000Z");
const BEFORE = new Date("2026-04-09T09:00:00.000Z");
const AFTER = new Date("2026-04-11T09:00:00.000Z");

function mark(
  dueAt: Date,
  redeemedAt: Date | null = null,
  notifiedAt: Date | null = null,
): DueMarkInput {
  return { dueAt, redeemedAt, notifiedAt };
}

const ai = { aiAssisted: true };
const independent = { aiAssisted: false };

describe("dueProblems (rule 5, AI-mark revision)", () => {
  it("includes a mark past its window", () => {
    expect(
      dueProblems([{ solutions: [ai], aiMark: mark(BEFORE) }], NOW),
    ).toHaveLength(1);
  });

  it("includes a mark exactly at its deadline", () => {
    expect(
      dueProblems([{ solutions: [], aiMark: mark(NOW) }], NOW),
    ).toHaveLength(1);
  });

  it("excludes a mark still inside the window", () => {
    expect(
      dueProblems([{ solutions: [ai], aiMark: mark(AFTER) }], NOW),
    ).toHaveLength(0);
  });

  it("excludes problems without a mark", () => {
    expect(dueProblems([{ solutions: [ai], aiMark: null }], NOW)).toHaveLength(
      0,
    );
  });

  it("excludes redeemed marks — a correct re-solve settles it permanently", () => {
    expect(
      dueProblems([{ solutions: [ai], aiMark: mark(BEFORE, BEFORE) }], NOW),
    ).toHaveLength(0);
  });

  it("excludes problems that meanwhile got an independent solution", () => {
    expect(
      dueProblems(
        [{ solutions: [ai, independent], aiMark: mark(BEFORE) }],
        NOW,
      ),
    ).toHaveLength(0);
  });

  it("keeps only the actually due problems out of a mixed set", () => {
    const due = { solutions: [ai], aiMark: mark(BEFORE) };
    const open = { solutions: [ai], aiMark: mark(AFTER) };
    const settled = { solutions: [ai], aiMark: mark(BEFORE, NOW) };
    expect(dueProblems([due, open, settled], NOW)).toEqual([due]);
  });
});

describe("unnotified", () => {
  it("keeps problems whose mark was never emailed", () => {
    expect(
      unnotified([
        { aiMark: mark(BEFORE) },
        { aiMark: mark(BEFORE, null, NOW) },
      ]),
    ).toHaveLength(1);
  });

  it("drops problems without a mark", () => {
    expect(unnotified([{ aiMark: null }])).toHaveLength(0);
  });
});
