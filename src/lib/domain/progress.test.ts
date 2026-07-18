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

describe("grila counts as progress (owner decision 2026-07-15)", () => {
  it("a pre-reveal correct grila check (no solution submitted) is done", () => {
    expect(
      isDone({
        isDepartajare: true,
        solutions: [],
        attempts: [{ kind: "CHOICE", correct: true }],
      }),
    ).toBe(true);
  });

  it("correct on the 2nd try is still done", () => {
    expect(
      isDone({
        isDepartajare: true,
        solutions: [],
        attempts: [
          { kind: "CHOICE", correct: false },
          { kind: "CHOICE", correct: true },
        ],
      }),
    ).toBe(true);
  });

  it("correct on the 3rd try is NOT done — still counts as remaining", () => {
    const guessed = {
      isDepartajare: true,
      solutions: [],
      attempts: [
        { kind: "CHOICE", correct: false },
        { kind: "CHOICE", correct: false },
        { kind: "CHOICE", correct: true },
      ],
    } as const;
    expect(isDone(guessed)).toBe(false);
    expect(remainingCount([guessed])).toBe(1);
    expect(examProgress([guessed])).toEqual({ done: 0, total: 1 });
  });

  it("a revealed-then-correct grila is NOT done (taint)", () => {
    expect(
      isDone({
        isDepartajare: true,
        solutions: [],
        attempts: [
          { kind: "REVEAL", correct: null },
          { kind: "CHOICE", correct: true },
        ],
      }),
    ).toBe(false);
  });

  it("a grila-verified departajare problem is not remaining", () => {
    expect(
      remainingCount([
        {
          isDepartajare: true,
          solutions: [],
          attempts: [{ kind: "CHOICE", correct: true }],
        },
      ]),
    ).toBe(0);
  });

  it("an AI-only solution still counts as remaining even with a grila check", () => {
    expect(
      remainingCount([
        {
          isDepartajare: true,
          solutions: [aiAssisted],
          attempts: [{ kind: "CHOICE", correct: true }],
        },
      ]),
    ).toBe(1);
  });

  it("examProgress counts grila alongside singur", () => {
    expect(
      examProgress([
        { isDepartajare: true, solutions: [independent] }, // singur
        {
          isDepartajare: true,
          solutions: [],
          attempts: [{ kind: "CHOICE", correct: true }],
        }, // grila
        { isDepartajare: true, solutions: [] }, // remaining
      ]),
    ).toEqual({ done: 2, total: 3 });
  });
});

describe("AI marks and the counter (owner revision 2026-07-18)", () => {
  const NOW = new Date("2026-04-10T09:00:00.000Z");
  const PAST = new Date("2026-04-09T09:00:00.000Z");
  const FUTURE = new Date("2026-04-11T09:00:00.000Z");
  const correct = { kind: "CHOICE", correct: true } as const;
  const wrong = { kind: "CHOICE", correct: false } as const;

  it("a mark alone never counts as done — window open or passed", () => {
    expect(
      isDone(
        {
          isDepartajare: true,
          solutions: [],
          aiMark: { dueAt: FUTURE, redeemedAt: null },
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isDone(
        {
          isDepartajare: true,
          solutions: [aiAssisted],
          aiMark: { dueAt: PAST, redeemedAt: null },
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("a redeemed mark with an AI upload counts as done (singur)", () => {
    expect(
      isDone(
        {
          isDepartajare: true,
          solutions: [aiAssisted],
          aiMark: { dueAt: PAST, redeemedAt: NOW },
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("grila redemption counts regardless of the number of tries", () => {
    expect(
      isDone(
        {
          isDepartajare: true,
          solutions: [],
          attempts: [wrong, wrong, wrong, correct], // 4 tries — still counts
          aiMark: { dueAt: PAST, redeemedAt: NOW },
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("remainingCount reflects a reset mark", () => {
    expect(
      remainingCount(
        [
          {
            isDepartajare: true,
            solutions: [aiAssisted],
            aiMark: { dueAt: PAST, redeemedAt: null },
          },
        ],
        NOW,
      ),
    ).toBe(1);
  });
});
