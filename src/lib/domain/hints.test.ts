import { describe, expect, it } from "vitest";
import { hintAt, splitHints, withHintTaint } from "./hints";
import { isDone } from "./progress";
import { grilaCountsAsDone, solveState } from "./solveState";

const TRIGGER =
  "„tangentă comună într-un punct comun” ⟹ sistem de două condiții: f(x₀) = g(x₀) ȘI f′(x₀) = g′(x₀)";

describe("splitHints", () => {
  it("cuts a trigger at the arrow, not at the middle character", () => {
    const hints = splitHints(TRIGGER);
    expect(hints).toEqual({
      signal: "„tangentă comună într-un punct comun”",
      move: "sistem de două condiții: f(x₀) = g(x₀) ȘI f′(x₀) = g′(x₀)",
    });
  });

  it("keeps later arrows inside the move", () => {
    const hints = splitHints("a ⟹ b ⟹ c");
    expect(hints?.signal).toBe("a");
    expect(hints?.move).toBe("b ⟹ c");
  });

  it("returns null for text it cannot split", () => {
    expect(splitHints(null)).toBeNull();
    expect(splitHints(undefined)).toBeNull();
    expect(splitHints("")).toBeNull();
    expect(splitHints("fără săgeată")).toBeNull();
    expect(splitHints("⟹ doar mișcarea")).toBeNull();
    expect(splitHints("doar semnalul ⟹")).toBeNull();
  });
});

describe("hintAt", () => {
  it("maps levels onto the two halves", () => {
    const hints = splitHints(TRIGGER);
    expect(hintAt(hints, 1)).toBe("„tangentă comună într-un punct comun”");
    expect(hintAt(hints, 2)).toContain("sistem de două condiții");
    expect(hintAt(hints, 3)).toBeNull();
    expect(hintAt(null, 1)).toBeNull();
  });
});

const at = (iso: string) => new Date(iso);
const choice = (iso: string, correct: boolean) => ({
  kind: "CHOICE" as const,
  correct,
  createdAt: at(iso),
});

describe("withHintTaint", () => {
  it("passes attempts through untouched when no hint was opened", () => {
    const attempts = [choice("2026-07-01T10:00:00Z", false)];
    expect(withHintTaint(attempts, [])).toEqual([
      { kind: "CHOICE", correct: false },
    ]);
  });

  it("interleaves a hint as a REVEAL at its own position in time", () => {
    const attempts = [
      choice("2026-07-01T10:00:00Z", false),
      choice("2026-07-01T12:00:00Z", true),
    ];
    expect(withHintTaint(attempts, [at("2026-07-01T11:00:00Z")])).toEqual([
      { kind: "CHOICE", correct: false },
      { kind: "REVEAL", correct: null },
      { kind: "CHOICE", correct: true },
    ]);
  });

  it("puts a hint before an answer made in the same millisecond", () => {
    const attempts = [choice("2026-07-01T10:00:00Z", true)];
    const merged = withHintTaint(attempts, [at("2026-07-01T10:00:00Z")]);
    expect(merged[0].kind).toBe("REVEAL");
  });
});

describe("a hint taints exactly like the answer key", () => {
  const solved = [choice("2026-07-01T10:00:00Z", true)];

  it("keeps a correct answer given BEFORE the hint", () => {
    const merged = withHintTaint(solved, [at("2026-07-01T11:00:00Z")]);
    expect(solveState([], merged)).toBe("grila");
    expect(grilaCountsAsDone(merged)).toBe(true);
    expect(isDone({ isDepartajare: true, solutions: [], attempts: merged })).toBe(
      true,
    );
  });

  it("voids a correct answer given AFTER the hint", () => {
    const merged = withHintTaint(solved, [at("2026-07-01T09:00:00Z")]);
    expect(solveState([], merged)).toBe("nerezolvata");
    expect(grilaCountsAsDone(merged)).toBe(false);
    expect(isDone({ isDepartajare: true, solutions: [], attempts: merged })).toBe(
      false,
    );
  });

  it("still lets an independent solution count after a hint", () => {
    // The counter must be able to reach 0: writing the solution yourself is
    // always proof, whatever help came before it.
    const merged = withHintTaint(solved, [at("2026-07-01T09:00:00Z")]);
    expect(
      isDone({
        isDepartajare: true,
        solutions: [{ aiAssisted: false }],
        attempts: merged,
      }),
    ).toBe(true);
  });

  it("treats either hint level the same — both are help", () => {
    const both = withHintTaint(solved, [
      at("2026-07-01T09:00:00Z"),
      at("2026-07-01T09:30:00Z"),
    ]);
    expect(solveState([], both)).toBe("nerezolvata");
  });
});
