import { describe, expect, it } from "vitest";
import { DEFAULT_SORT, needsDifficulty, sortProblems, type SortKey } from "./sorting";

interface P {
  id: string;
  number: string;
  exam: { year: number };
  difficulty?: { dRaw: number } | null;
}

const p = (
  id: string,
  year: number,
  number: string,
  dRaw?: number,
): P => ({
  id,
  number,
  exam: { year },
  difficulty: dRaw === undefined ? null : { dRaw },
});

const SET: P[] = [
  p("a", 2019, "3", 4.15),
  p("b", 2024, "1", 6.7),
  p("c", 2024, "10", 2.4),
  p("d", 2015, "13", 8.1),
];

const ids = (list: P[]) => list.map((x) => x.id).join("");

describe("sortProblems", () => {
  it("defaults to newest exam first, then problem number", () => {
    // "10" must sort after "1", not before it (numeric, not lexicographic).
    expect(ids(sortProblems(SET))).toBe("bcad");
    expect(ids(sortProblems(SET, DEFAULT_SORT))).toBe("bcad");
  });

  it("reverses chronology for `vechi`", () => {
    // Oldest year first; inside 2024, "1" still precedes "10".
    expect(ids(sortProblems(SET, "vechi"))).toBe("dabc");
  });

  it("orders by D_raw, not by star band", () => {
    expect(ids(sortProblems(SET, "greu"))).toBe("dbac");
    expect(ids(sortProblems(SET, "usor"))).toBe("cabd");
  });

  it("separates problems inside the same band", () => {
    // Both are 3★ (3.91–4.60) but D_raw differs — the harder one leads.
    const band = [p("x", 2020, "1", 3.95), p("y", 2020, "2", 4.55)];
    expect(ids(sortProblems(band, "greu"))).toBe("yx");
  });

  it("sinks ungraded problems to the bottom of both difficulty sorts", () => {
    const mixed = [p("u", 2024, "1"), p("g", 2018, "2", 3)];
    expect(ids(sortProblems(mixed, "greu"))).toBe("gu");
    expect(ids(sortProblems(mixed, "usor"))).toBe("gu");
  });

  it("keeps ungraded problems in default order among themselves", () => {
    const none = [p("old", 2015, "1"), p("new", 2026, "1")];
    expect(ids(sortProblems(none, "greu"))).toBe("newold");
  });

  it("orders by solver count for `relevanta`", () => {
    const counts = new Map([
      ["a", 7],
      ["b", 2],
      ["c", 9],
    ]);
    // d has no entry ⇒ 0 solvers ⇒ last.
    expect(ids(sortProblems(SET, "relevanta", { solveCounts: counts }))).toBe("cabd");
  });

  it("falls back to the default order when no counts are supplied", () => {
    expect(ids(sortProblems(SET, "relevanta"))).toBe("bcad");
  });

  it("breaks every tie with the default order, so the list is deterministic", () => {
    const tied = [p("s", 2019, "2", 5), p("t", 2024, "1", 5)];
    expect(ids(sortProblems(tied, "greu"))).toBe("ts");
    expect(ids(sortProblems(tied, "usor"))).toBe("ts");
    const counts = new Map([["s", 3], ["t", 3]]);
    expect(ids(sortProblems(tied, "relevanta", { solveCounts: counts }))).toBe("ts");
  });

  it("does not mutate its input", () => {
    const original = [...SET];
    sortProblems(SET, "vechi");
    expect(SET).toEqual(original);
  });

  it("falls back to the default for an unknown key", () => {
    expect(ids(sortProblems(SET, "bogus" as SortKey))).toBe("bcad");
  });
});

describe("needsDifficulty", () => {
  it("flags exactly the two difficulty sorts", () => {
    expect(needsDifficulty("greu")).toBe(true);
    expect(needsDifficulty("usor")).toBe(true);
    expect(needsDifficulty("relevanta")).toBe(false);
    expect(needsDifficulty("recente")).toBe(false);
    expect(needsDifficulty("vechi")).toBe(false);
  });
});
