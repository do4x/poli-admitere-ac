import { describe, expect, it } from "vitest";
import { solveState } from "./solveState";

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
