import { describe, expect, it } from "vitest";
import { parseImportFile } from "./schema";
import { planImport } from "./plan";

const validFile = {
  exam: { year: 2024, kind: "ADMITERE", subject: "MATE", session: "iulie" },
  problems: [
    { number: "1", isDepartajare: false, latex: "Fie $x^2=4$." },
    { number: "2", isDepartajare: true, latex: "Calculați $\\int_0^1 x\\,dx$." },
  ],
};

describe("parseImportFile", () => {
  it("accepts a valid file", () => {
    const result = parseImportFile(JSON.stringify(validFile));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.exam.year).toBe(2024);
      expect(result.file.problems).toHaveLength(2);
    }
  });

  it("preserves LaTeX backslashes exactly once (no double-unescape)", () => {
    // On disk: "latex": "$\\mathbb{R}$" — JSON.parse yields $\mathbb{R}$.
    const jsonText = `{
      "exam": { "year": 2025, "kind": "PREADMITERE", "subject": "MATE" },
      "problems": [{ "number": "1", "isDepartajare": false, "latex": "$\\\\mathbb{R}$" }]
    }`;
    const result = parseImportFile(jsonText);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.problems[0]!.latex).toBe("$\\mathbb{R}$");
    }
  });

  it("defaults a missing session to null", () => {
    const noSession = { ...validFile, exam: { year: 2024, kind: "ADMITERE", subject: "MATE" } };
    const result = parseImportFile(JSON.stringify(noSession));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.exam.session).toBeNull();
  });

  it("defaults a missing isDepartajare to false", () => {
    const file = {
      exam: { year: 2024, kind: "ADMITERE", subject: "INFO" },
      problems: [{ number: "1", latex: "Ce afișează programul?" }],
    };
    const result = parseImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.problems[0]!.isDepartajare).toBe(false);
  });

  it("rejects malformed JSON (e.g. an empty file)", () => {
    expect(parseImportFile("").ok).toBe(false);
    expect(parseImportFile("{").ok).toBe(false);
  });

  it("rejects an unknown exam kind", () => {
    const bad = { ...validFile, exam: { ...validFile.exam, kind: "BAC" } };
    expect(parseImportFile(JSON.stringify(bad)).ok).toBe(false);
  });

  it("rejects a year outside 2015–2026", () => {
    const bad = { ...validFile, exam: { ...validFile.exam, year: 2014 } };
    expect(parseImportFile(JSON.stringify(bad)).ok).toBe(false);
  });

  it("rejects an empty problems array", () => {
    const bad = { ...validFile, problems: [] };
    expect(parseImportFile(JSON.stringify(bad)).ok).toBe(false);
  });

  it("rejects duplicate problem numbers within one file", () => {
    const bad = {
      ...validFile,
      problems: [
        { number: "1", isDepartajare: false, latex: "a" },
        { number: "1", isDepartajare: true, latex: "b" },
      ],
    };
    expect(parseImportFile(JSON.stringify(bad)).ok).toBe(false);
  });

  it("accepts an optional types array on a problem", () => {
    const file = {
      ...validFile,
      problems: [
        {
          number: "1",
          isDepartajare: false,
          latex: "$x$",
          types: ["integrale", "sisteme"],
        },
      ],
    };
    const result = parseImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.problems[0]!.types).toEqual([
      "integrale",
      "sisteme",
    ]);
  });

  it("leaves types undefined when the field is absent (legacy files)", () => {
    const result = parseImportFile(JSON.stringify(validFile));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.problems[0]!.types).toBeUndefined();
  });

  it("rejects more than 3 types or empty type strings", () => {
    const tooMany = {
      ...validFile,
      problems: [
        { number: "1", isDepartajare: false, latex: "$x$", types: ["a", "b", "c", "d"] },
      ],
    };
    expect(parseImportFile(JSON.stringify(tooMany)).ok).toBe(false);
    const empty = {
      ...validFile,
      problems: [
        { number: "1", isDepartajare: false, latex: "$x$", types: [""] },
      ],
    };
    expect(parseImportFile(JSON.stringify(empty)).ok).toBe(false);
  });
});

describe("planImport", () => {
  const incoming = [
    { number: "1", latex: "a", isDepartajare: false },
    { number: "2", latex: "b", isDepartajare: true },
  ];

  it("creates everything for a new exam", () => {
    const plan = planImport([], incoming, false);
    expect(plan.counts).toEqual({ created: 2, updated: 0, skipped: 0 });
  });

  it("is a no-op when re-importing identical content (DoD 2)", () => {
    const plan = planImport(incoming, incoming, true);
    expect(plan.counts).toEqual({ created: 0, updated: 0, skipped: 2 });
    expect(plan.problems.every((p) => p.action === "skip")).toBe(true);
  });

  it("updates when latex changed", () => {
    const plan = planImport(
      [{ number: "1", latex: "old", isDepartajare: false }],
      [{ number: "1", latex: "new", isDepartajare: false }],
      true,
    );
    expect(plan.problems[0]!.action).toBe("update");
  });

  it("updates when only isDepartajare changed", () => {
    const plan = planImport(
      [{ number: "1", latex: "a", isDepartajare: false }],
      [{ number: "1", latex: "a", isDepartajare: true }],
      true,
    );
    expect(plan.problems[0]!.action).toBe("update");
  });

  it("mixes create/update/skip correctly", () => {
    const plan = planImport(
      [
        { number: "1", latex: "same", isDepartajare: false },
        { number: "2", latex: "old", isDepartajare: false },
      ],
      [
        { number: "1", latex: "same", isDepartajare: false }, // skip
        { number: "2", latex: "new", isDepartajare: false }, // update
        { number: "3", latex: "brand new", isDepartajare: true }, // create
      ],
      true,
    );
    expect(plan.counts).toEqual({ created: 1, updated: 1, skipped: 1 });
  });

  it("leaves tags untouched when types is absent, even on a latex update", () => {
    const plan = planImport(
      [{ number: "1", latex: "old", isDepartajare: false, tags: [{ name: "integrale" }] }],
      [{ number: "1", latex: "new", isDepartajare: false }],
      true,
    );
    expect(plan.problems[0]!.action).toBe("update");
    expect(plan.problems[0]!.tagChange).toBeUndefined();
  });

  it("plans a tag change (as an update) when types differ though latex is identical", () => {
    const plan = planImport(
      [{ number: "1", latex: "same", isDepartajare: false, tags: [{ name: "integrale" }] }],
      [{ number: "1", latex: "same", isDepartajare: false, types: ["polinoame"] }],
      true,
    );
    expect(plan.problems[0]!.action).toBe("update");
    expect(plan.problems[0]!.tagChange).toEqual({
      from: ["integrale"],
      to: ["polinoame"],
    });
  });

  it("skips when types match the current tags (order-insensitive) — idempotent", () => {
    const plan = planImport(
      [
        {
          number: "1",
          latex: "same",
          isDepartajare: false,
          tags: [{ name: "sisteme" }, { name: "integrale" }],
        },
      ],
      [{ number: "1", latex: "same", isDepartajare: false, types: ["integrale", "sisteme"] }],
      true,
    );
    expect(plan.problems[0]!.action).toBe("skip");
    expect(plan.problems[0]!.tagChange).toBeUndefined();
  });

  it("sets tags on a freshly created problem when types are given", () => {
    const plan = planImport(
      [],
      [{ number: "1", latex: "a", isDepartajare: true, types: ["grafuri"] }],
      false,
    );
    expect(plan.problems[0]!.action).toBe("create");
    expect(plan.problems[0]!.tagChange).toEqual({ from: [], to: ["grafuri"] });
  });
});

describe("review hardening (session 2 findings)", () => {
  it("tolerates a UTF-8 BOM (PowerShell 5.1 Out-File writes one)", () => {
    const result = parseImportFile("\uFEFF" + JSON.stringify(validFile));
    expect(result.ok).toBe(true);
  });

  it("rejects oversized latex fields", () => {
    const bloated = {
      ...validFile,
      problems: [
        { number: "1", isDepartajare: false, latex: "x".repeat(50_001) },
      ],
    };
    expect(parseImportFile(JSON.stringify(bloated)).ok).toBe(false);
  });

  it("rejects more than 500 problems in one file", () => {
    const many = {
      ...validFile,
      problems: Array.from({ length: 501 }, (_, i) => ({
        number: String(i + 1),
        isDepartajare: false,
        latex: "$x$",
      })),
    };
    expect(parseImportFile(JSON.stringify(many)).ok).toBe(false);
  });

  it("flags isDepartajare flips on update so callers can warn the owner", () => {
    const plan = planImport(
      [{ number: "3", latex: "L", isDepartajare: true }],
      [{ number: "3", latex: "L", isDepartajare: false }],
      true,
    );
    expect(plan.problems[0]!.action).toBe("update");
    expect(plan.problems[0]!.departajareChange).toEqual({
      from: true,
      to: false,
    });
  });

  it("does not flag departajareChange on latex-only updates", () => {
    const plan = planImport(
      [{ number: "3", latex: "old", isDepartajare: true }],
      [{ number: "3", latex: "new", isDepartajare: true }],
      true,
    );
    expect(plan.problems[0]!.action).toBe("update");
    expect(plan.problems[0]!.departajareChange).toBeUndefined();
  });
});
