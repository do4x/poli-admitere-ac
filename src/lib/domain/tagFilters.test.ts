import { describe, expect, it } from "vitest";
import {
  matchesFilters,
  tagCounts,
  type FilterableProblem,
} from "./tagFilters";

describe("tagCounts", () => {
  it("counts a problem under every tag it carries", () => {
    const { byTag } = tagCounts([
      { tags: [{ name: "integrale" }, { name: "sisteme" }] },
      { tags: [{ name: "integrale" }] },
    ]);
    expect(byTag).toEqual({ integrale: 2, sisteme: 1 });
  });

  it("reports problems with zero tags as neclasificat", () => {
    const result = tagCounts([
      { tags: [] },
      { tags: [] },
      { tags: [{ name: "grafuri" }] },
    ]);
    expect(result.neclasificat).toBe(2);
    expect(result.byTag).toEqual({ grafuri: 1 });
  });

  it("is empty for no problems", () => {
    expect(tagCounts([])).toEqual({ byTag: {}, neclasificat: 0 });
  });
});

function problem(over: Partial<FilterableProblem> = {}): FilterableProblem {
  return {
    isDepartajare: true,
    subject: "MATE",
    year: 2024,
    tags: [{ name: "integrale" }],
    solutions: [],
    ...over,
  };
}

describe("matchesFilters", () => {
  it("matches everything when no filters are active", () => {
    expect(matchesFilters(problem(), {})).toBe(true);
    expect(matchesFilters(problem({ tags: [] }), {})).toBe(true);
  });

  it("filters by a single dimension", () => {
    expect(matchesFilters(problem(), { subject: "INFO" })).toBe(false);
    expect(matchesFilters(problem(), { subject: "MATE" })).toBe(true);
    expect(matchesFilters(problem(), { year: 2023 })).toBe(false);
    expect(matchesFilters(problem(), { tagName: "sisteme" })).toBe(false);
    expect(matchesFilters(problem(), { tagName: "integrale" })).toBe(true);
  });

  it("requires ALL active filters to hold", () => {
    const p = problem({ subject: "INFO", tags: [{ name: "grafuri" }] });
    expect(matchesFilters(p, { subject: "INFO", tagName: "grafuri" })).toBe(true);
    expect(matchesFilters(p, { subject: "INFO", tagName: "integrale" })).toBe(
      false,
    );
  });

  it("filters by solve state via solveState", () => {
    const solved = problem({ solutions: [{ aiAssisted: false }] });
    expect(matchesFilters(solved, { stare: "singur" })).toBe(true);
    expect(matchesFilters(solved, { stare: "nerezolvata" })).toBe(false);
    expect(matchesFilters(problem({ solutions: [] }), { stare: "nerezolvata" })).toBe(
      true,
    );
  });

  it("neclasificat matches only problems with no tags", () => {
    expect(matchesFilters(problem({ tags: [] }), { neclasificat: true })).toBe(
      true,
    );
    expect(matchesFilters(problem(), { neclasificat: true })).toBe(false);
  });

  it("stare 'grila' matches via attempts, and attempts are optional", () => {
    const checked = problem({ attempts: [{ kind: "CHOICE", correct: true }] });
    expect(matchesFilters(checked, { stare: "grila" })).toBe(true);
    expect(matchesFilters(problem(), { stare: "grila" })).toBe(false);
    // a revealed problem never reaches 'grila'
    const tainted = problem({
      attempts: [
        { kind: "REVEAL", correct: null },
        { kind: "CHOICE", correct: true },
      ],
    });
    expect(matchesFilters(tainted, { stare: "grila" })).toBe(false);
    expect(matchesFilters(tainted, { stare: "nerezolvata" })).toBe(true);
  });

  it("departajareOnly excludes non-departajare problems regardless of other filters", () => {
    const regular = problem({ isDepartajare: false });
    expect(matchesFilters(regular, { departajareOnly: true })).toBe(false);
    expect(
      matchesFilters(regular, { departajareOnly: true, subject: "MATE" }),
    ).toBe(false);
    expect(matchesFilters(problem(), { departajareOnly: true })).toBe(true);
  });
});
