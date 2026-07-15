import { describe, expect, it } from "vitest";
import { pageHref, parseFilters, parsePage, toggleParam } from "./searchFilters";

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

  it("drops the current page — a new filter invalidates the old position", () => {
    const q = toggleParam({ subject: "MATE", pagina: "3" }, "stare", "singur");
    expect(new URLSearchParams(q).get("pagina")).toBeNull();
  });
});

describe("parsePage", () => {
  it("defaults to 1 when absent", () => {
    expect(parsePage({})).toBe(1);
  });

  it("parses a valid page number", () => {
    expect(parsePage({ pagina: "3" })).toBe(3);
  });

  it("falls back to 1 for junk values", () => {
    expect(parsePage({ pagina: "0" })).toBe(1);
    expect(parsePage({ pagina: "-2" })).toBe(1);
    expect(parsePage({ pagina: "abc" })).toBe(1);
    expect(parsePage({ pagina: "2.5" })).toBe(1);
  });

  it("takes the first value when the param repeats", () => {
    expect(parsePage({ pagina: ["4", "9"] })).toBe(4);
  });
});

describe("pageHref", () => {
  it("omits pagina for page 1", () => {
    expect(pageHref({}, 1)).toBe("/probleme");
  });

  it("sets pagina for page > 1", () => {
    expect(pageHref({}, 2)).toBe("/probleme?pagina=2");
  });

  it("preserves other active params", () => {
    const href = pageHref({ subject: "MATE", an: "2024" }, 3);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("subject")).toBe("MATE");
    expect(params.get("an")).toBe("2024");
    expect(params.get("pagina")).toBe("3");
  });

  it("replaces any existing pagina rather than duplicating it", () => {
    const href = pageHref({ pagina: "5" }, 2);
    expect(href).toBe("/probleme?pagina=2");
  });
});
