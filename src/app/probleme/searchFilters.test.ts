import { describe, expect, it } from "vitest";
import { parseFilters, toggleParam } from "./searchFilters";

describe("parseFilters", () => {
  it("returns no filters for empty params", () => {
    expect(parseFilters({})).toEqual({});
  });

  it("parses each valid dimension", () => {
    expect(
      parseFilters({
        tag: "integrale",
        subject: "MATE",
        an: "2024",
        stare: "singur",
        neclasificat: "1",
        toate: "1",
      }),
    ).toEqual({
      tagName: "integrale",
      subject: "MATE",
      year: 2024,
      stare: "singur",
      neclasificat: true,
      toate: true,
    });
  });

  it("drops invalid values silently", () => {
    expect(
      parseFilters({
        subject: "PHYSICS",
        an: "not-a-year",
        stare: "bogus",
        neclasificat: "yes",
        toate: "true",
      }),
    ).toEqual({});
  });

  it("accepts the grila state", () => {
    expect(parseFilters({ stare: "grila" })).toEqual({ stare: "grila" });
  });

  it("rejects years outside 2015–2026", () => {
    expect(parseFilters({ an: "1999" })).toEqual({});
    expect(parseFilters({ an: "2026" })).toEqual({ year: 2026 });
  });

  it("takes the first value when a param repeats", () => {
    expect(parseFilters({ subject: ["MATE", "INFO"] })).toEqual({
      subject: "MATE",
    });
  });

  it("ignores an empty tag", () => {
    expect(parseFilters({ tag: "   " })).toEqual({});
  });
});

describe("toggleParam", () => {
  it("adds a param when it is not active", () => {
    expect(toggleParam({}, "subject", "MATE")).toBe("?subject=MATE");
  });

  it("removes a param when the same value is already active", () => {
    expect(toggleParam({ subject: "MATE" }, "subject", "MATE")).toBe("");
  });

  it("replaces a param when a different value is chosen", () => {
    expect(toggleParam({ subject: "MATE" }, "subject", "INFO")).toBe(
      "?subject=INFO",
    );
  });

  it("preserves other active params when toggling one", () => {
    const q = toggleParam({ subject: "MATE", an: "2024" }, "stare", "singur");
    const params = new URLSearchParams(q);
    expect(params.get("subject")).toBe("MATE");
    expect(params.get("an")).toBe("2024");
    expect(params.get("stare")).toBe("singur");
  });

  it("round-trips a tag name with spaces through encoding", () => {
    const q = toggleParam({}, "tag", "numere complexe");
    expect(new URLSearchParams(q).get("tag")).toBe("numere complexe");
  });

  it("toggling off the last param yields an empty string", () => {
    expect(toggleParam({ toate: "1" }, "toate", "1")).toBe("");
  });
});
