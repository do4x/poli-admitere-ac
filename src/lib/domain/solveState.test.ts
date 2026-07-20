import { describe, expect, it } from "vitest";
import {
  grilaCountsAsDone,
  grilaLocked,
  solveState,
  visibleAttempts,
} from "./solveState";

const independent = { aiAssisted: false };
const aiAssisted = { aiAssisted: true };

describe("solveState", () => {
  it("is 'nerezolvata' when there are no solutions", () => {
    expect(solveState([])).toBe("nerezolvata");
  });

  it("is 'singur' when at least one solution is independent", () => {
    expect(solveState([independent])).toBe("singur");
  });

  it("is 'singur' even when AI-assisted solutions are also present (rule 2)", () => {
    expect(solveState([aiAssisted, independent])).toBe("singur");
    expect(solveState([independent, aiAssisted])).toBe("singur");
  });

  it("is 'doar_ai' when solutions exist but all are AI-assisted", () => {
    expect(solveState([aiAssisted])).toBe("doar_ai");
    expect(solveState([aiAssisted, aiAssisted])).toBe("doar_ai");
  });
});

const correct = { kind: "CHOICE", correct: true } as const;
const wrong = { kind: "CHOICE", correct: false } as const;
const reveal = { kind: "REVEAL", correct: null } as const;

describe("solveState — grila ladder", () => {
  it("is 'grila' after a correct choice with no solutions", () => {
    expect(solveState([], [correct])).toBe("grila");
    expect(solveState([], [wrong, wrong, correct])).toBe("grila");
  });

  it("stays 'nerezolvata' on wrong attempts only", () => {
    expect(solveState([], [wrong, wrong])).toBe("nerezolvata");
  });

  it("a reveal taints later correct attempts", () => {
    expect(solveState([], [reveal, correct])).toBe("nerezolvata");
    expect(solveState([], [wrong, reveal, correct])).toBe("nerezolvata");
  });

  it("a correct attempt BEFORE the reveal still counts", () => {
    expect(solveState([], [correct, reveal])).toBe("grila");
  });

  it("solutions outrank grila: any solution wins over attempts", () => {
    expect(solveState([aiAssisted], [correct])).toBe("doar_ai");
    expect(solveState([independent], [reveal, correct])).toBe("singur");
  });

  it("attempts alone never produce 'singur' (commitment device intact)", () => {
    expect(solveState([], [correct, correct, correct])).not.toBe("singur");
  });
});

describe("grilaCountsAsDone — the 2-try budget (owner decision 2026-07-15)", () => {
  it("correct on the 1st try counts", () => {
    expect(grilaCountsAsDone([correct])).toBe(true);
  });

  it("correct on the 2nd try counts", () => {
    expect(grilaCountsAsDone([wrong, correct])).toBe(true);
  });

  it("correct on the 3rd try does NOT count (status stays 'grila' though)", () => {
    expect(grilaCountsAsDone([wrong, wrong, correct])).toBe(false);
    expect(solveState([], [wrong, wrong, correct])).toBe("grila");
  });

  it("no correct attempt never counts", () => {
    expect(grilaCountsAsDone([])).toBe(false);
    expect(grilaCountsAsDone([wrong, wrong])).toBe(false);
  });

  it("a reveal taints later correct attempts", () => {
    expect(grilaCountsAsDone([reveal, correct])).toBe(false);
    expect(grilaCountsAsDone([wrong, reveal, correct])).toBe(false);
  });

  it("a reveal does not consume a try — only choices count", () => {
    expect(grilaCountsAsDone([correct, reveal])).toBe(true);
  });
});

describe("grilaLocked — one correct answer closes the grila (2026-07-20)", () => {
  it("is open while nothing correct has been submitted", () => {
    expect(grilaLocked([])).toBe(false);
    expect(grilaLocked([wrong, wrong])).toBe(false);
  });

  it("locks on the first correct choice, whichever try it came on", () => {
    expect(grilaLocked([correct])).toBe(true);
    expect(grilaLocked([wrong, wrong, wrong, correct])).toBe(true);
  });

  it("stays locked after a reveal — no re-answering a solved problem", () => {
    expect(grilaLocked([correct, reveal])).toBe(true);
  });

  it("a reveal alone does not lock: the key is shown, attempts are moot", () => {
    expect(grilaLocked([reveal])).toBe(false);
  });

  it("reopens while an AI mark is past due — that is the redemption path", () => {
    expect(grilaLocked([correct], "due")).toBe(false);
  });

  it("stays locked in every other AI phase", () => {
    expect(grilaLocked([correct], "window")).toBe(true);
    expect(grilaLocked([correct], "redeemed")).toBe(true);
  });
});

describe("visibleAttempts — a reset forgets the answer (2026-07-20)", () => {
  const history = [wrong, correct] as const;

  it("hides everything while the grila is reopened by a reset", () => {
    expect(visibleAttempts(history, "due")).toEqual([]);
  });

  it("shows everything in every other phase, including none at all", () => {
    expect(visibleAttempts(history, null)).toEqual(history);
    expect(visibleAttempts(history, "window")).toEqual(history);
    expect(visibleAttempts(history, "redeemed")).toEqual(history);
  });

  it("pairs with grilaLocked: hidden history, open grila", () => {
    expect(visibleAttempts(history, "due")).toEqual([]);
    expect(grilaLocked(history, "due")).toBe(false);
  });
});

describe("solveState — AI marks (owner revision 2026-07-18)", () => {
  const NOW = new Date("2026-04-10T09:00:00.000Z");
  const PAST = new Date("2026-04-09T09:00:00.000Z");
  const FUTURE = new Date("2026-04-11T09:00:00.000Z");

  it("is 'doar_ai' inside the re-solve window, even without an upload", () => {
    expect(solveState([], [], { dueAt: FUTURE, redeemedAt: null }, NOW)).toBe(
      "doar_ai",
    );
    expect(
      solveState([aiAssisted], [], { dueAt: FUTURE, redeemedAt: null }, NOW),
    ).toBe("doar_ai");
  });

  it("resets to 'nerezolvata' once the window passes unredeemed", () => {
    expect(solveState([], [], { dueAt: PAST, redeemedAt: null }, NOW)).toBe(
      "nerezolvata",
    );
    expect(
      solveState([aiAssisted], [], { dueAt: PAST, redeemedAt: null }, NOW),
    ).toBe("nerezolvata");
  });

  it("a redeemed mark with an uploaded solution becomes 'singur' — the submission reappears", () => {
    expect(
      solveState([aiAssisted], [], { dueAt: PAST, redeemedAt: NOW }, NOW),
    ).toBe("singur");
  });

  it("a redeemed mark without an upload becomes 'grila' — rezolvat pe grilă", () => {
    expect(solveState([], [], { dueAt: PAST, redeemedAt: NOW }, NOW)).toBe(
      "grila",
    );
  });

  it("redemption stands even if the key is revealed afterwards", () => {
    expect(
      solveState([], [reveal], { dueAt: PAST, redeemedAt: PAST }, NOW),
    ).toBe("grila");
  });

  it("an independent solution always wins over the mark", () => {
    expect(
      solveState([independent], [], { dueAt: PAST, redeemedAt: null }, NOW),
    ).toBe("singur");
  });

  it("the mark dominates a pre-existing grila verify", () => {
    expect(
      solveState([], [correct], { dueAt: FUTURE, redeemedAt: null }, NOW),
    ).toBe("doar_ai");
    expect(
      solveState([], [correct], { dueAt: PAST, redeemedAt: null }, NOW),
    ).toBe("nerezolvata");
  });
});
