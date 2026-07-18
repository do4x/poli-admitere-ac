import { describe, expect, it } from "vitest";
import {
  examKindSlug,
  examVariant,
  matchesParsedSlug,
  parseProblemSlug,
  problemHref,
  problemSlug,
} from "./slug";

const preadmitere2026 = {
  year: 2026,
  kind: "PREADMITERE",
  subject: "MATE",
  session: "28 martie — Varianta B",
};
const simulare2024 = {
  year: 2024,
  kind: "ADMITERE",
  subject: "INFO",
  session: "Simulare 17 martie — Varianta A",
};
const admitere2024 = {
  year: 2024,
  kind: "ADMITERE",
  subject: "INFO",
  session: "22 iulie — Varianta A",
};
const m1_2018 = {
  year: 2018,
  kind: "ADMITERE",
  subject: "MATE",
  session: "iulie — M1 Varianta A",
};
const m2_2018 = { ...m1_2018, session: "iulie — M2 Varianta A" };
const m1b_2015 = {
  year: 2015,
  kind: "ADMITERE",
  subject: "MATE",
  session: "iulie — Varianta A (M1B)",
};

describe("examKindSlug", () => {
  it("maps a Simulare session of an ADMITERE exam to 'simulare'", () => {
    expect(examKindSlug(simulare2024)).toBe("simulare");
    expect(examKindSlug(admitere2024)).toBe("admitere");
    expect(examKindSlug(preadmitere2026)).toBe("preadmitere");
  });
});

describe("examVariant", () => {
  it("detects the M1/M2 split papers", () => {
    expect(examVariant(m1_2018)).toBe("M1");
    expect(examVariant(m2_2018)).toBe("M2");
    expect(examVariant(admitere2024)).toBeNull();
  });

  it("does not read 'M1B' as M1 — word boundary", () => {
    expect(examVariant(m1b_2015)).toBeNull();
  });
});

describe("problemSlug / problemHref", () => {
  it("builds the owner's example shapes", () => {
    expect(problemSlug({ number: "1", exam: preadmitere2026 })).toBe(
      "pb1-mate/preadmitere/2026",
    );
    expect(problemSlug({ number: "8", exam: simulare2024 })).toBe(
      "pb8-info/simulare/2024",
    );
  });

  it("adds the M-variant only when the session has one", () => {
    expect(problemSlug({ number: "2", exam: m2_2018 })).toBe(
      "pb2-mate-m2/admitere/2018",
    );
    expect(problemSlug({ number: "3", exam: m1b_2015 })).toBe(
      "pb3-mate/admitere/2015",
    );
  });

  it("problemHref prefixes a slash and carries the query", () => {
    expect(problemHref({ number: "1", exam: preadmitere2026 })).toBe(
      "/pb1-mate/preadmitere/2026",
    );
    expect(problemHref({ number: "1", exam: preadmitere2026 }, "from=exam")).toBe(
      "/pb1-mate/preadmitere/2026?from=exam",
    );
  });
});

describe("parseProblemSlug", () => {
  it("round-trips a generated slug", () => {
    const problem = { number: "8", exam: simulare2024 };
    const parsed = parseProblemSlug(problemSlug(problem).split("/"));
    expect(parsed).not.toBeNull();
    expect(matchesParsedSlug(parsed!, problem)).toBe(true);
  });

  it("rejects junk", () => {
    expect(parseProblemSlug(["wp-admin", "x", "y"])).toBeNull();
    expect(parseProblemSlug(["pb1-mate", "bacalaureat", "2026"])).toBeNull();
    expect(parseProblemSlug(["pb1-mate", "admitere", "20x6"])).toBeNull();
    expect(parseProblemSlug(["pb1-mate", "admitere"])).toBeNull();
    expect(parseProblemSlug(["pb1-fizica", "admitere", "2026"])).toBeNull();
  });

  it("is case-insensitive", () => {
    const parsed = parseProblemSlug(["PB8-INFO", "Simulare", "2024"]);
    expect(parsed).not.toBeNull();
    expect(matchesParsedSlug(parsed!, { number: "8", exam: simulare2024 })).toBe(
      true,
    );
  });
});

describe("matchesParsedSlug", () => {
  it("separates simulare from the July admitere of the same year", () => {
    const parsed = parseProblemSlug(["pb2-info", "simulare", "2024"]);
    expect(matchesParsedSlug(parsed!, { number: "2", exam: simulare2024 })).toBe(
      true,
    );
    expect(matchesParsedSlug(parsed!, { number: "2", exam: admitere2024 })).toBe(
      false,
    );
  });

  it("separates M1 from M2 within the same year", () => {
    const parsed = parseProblemSlug(["pb2-mate-m1", "admitere", "2018"]);
    expect(matchesParsedSlug(parsed!, { number: "2", exam: m1_2018 })).toBe(true);
    expect(matchesParsedSlug(parsed!, { number: "2", exam: m2_2018 })).toBe(
      false,
    );
  });

  it("a variant-less URL still matches an M-paper (caller must check uniqueness)", () => {
    const parsed = parseProblemSlug(["pb2-mate", "admitere", "2018"]);
    expect(matchesParsedSlug(parsed!, { number: "2", exam: m1_2018 })).toBe(true);
    expect(matchesParsedSlug(parsed!, { number: "2", exam: m2_2018 })).toBe(true);
  });
});
