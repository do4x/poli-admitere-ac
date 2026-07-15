import { describe, expect, it } from "vitest";
import { grilaCountsAsDone, solveState } from "./solveState";

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
