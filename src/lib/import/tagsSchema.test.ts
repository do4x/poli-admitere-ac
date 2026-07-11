import { describe, expect, it } from "vitest";
import { examKey, parseTagsFile } from "./tagsSchema";

function validFile() {
  return {
    tags: [
      { subject: "MATE", name: "integrale" },
      { subject: "INFO", name: "grafuri" },
    ],
    assignments: [
      {
        exam: { year: 2024, kind: "ADMITERE", subject: "MATE", session: "iulie" },
        number: "1",
        types: ["integrale", "sisteme"],
      },
    ],
  };
}

describe("parseTagsFile", () => {
  it("parses a valid file", () => {
    const result = parseTagsFile(JSON.stringify(validFile()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.assignments).toHaveLength(1);
      expect(result.file.tags).toHaveLength(2);
    }
  });

  it("defaults a missing session to null", () => {
    const file = validFile();
    delete (file.assignments[0].exam as { session?: string }).session;
    const result = parseTagsFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.assignments[0].exam.session).toBeNull();
    }
  });

  it("strips a leading BOM before parsing", () => {
    const result = parseTagsFile("﻿" + JSON.stringify(validFile()));
    expect(result.ok).toBe(true);
  });

  it("does not double-unescape backslashes (tags carry no LaTeX, but must survive round-trip)", () => {
    const file = validFile();
    file.assignments[0].types = ["a\\b"];
    const json = JSON.stringify(file);
    const result = parseTagsFile(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.assignments[0].types[0]).toBe("a\\b");
    }
  });

  it("rejects invalid JSON", () => {
    const result = parseTagsFile("{not json");
    expect(result.ok).toBe(false);
  });

  it("rejects more than 3 types on one assignment", () => {
    const file = validFile();
    file.assignments[0].types = ["a", "b", "c", "d"];
    const result = parseTagsFile(JSON.stringify(file));
    expect(result.ok).toBe(false);
  });

  it("rejects an empty types array", () => {
    const file = validFile();
    file.assignments[0].types = [];
    const result = parseTagsFile(JSON.stringify(file));
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate (exam, number) assignments", () => {
    const file = validFile();
    file.assignments.push({ ...file.assignments[0], types: ["polinoame"] });
    const result = parseTagsFile(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicat");
  });

  it("rejects duplicate seed tags for the same subject", () => {
    const file = validFile();
    file.tags.push({ subject: "MATE", name: "integrale" });
    const result = parseTagsFile(JSON.stringify(file));
    expect(result.ok).toBe(false);
  });

  it("allows a file with no seed tags list", () => {
    const file = validFile();
    delete (file as { tags?: unknown }).tags;
    const result = parseTagsFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
  });
});

describe("examKey", () => {
  it("distinguishes a named session from the null session", () => {
    const base = { year: 2024, kind: "ADMITERE", subject: "MATE" };
    expect(examKey({ ...base, session: null })).not.toBe(
      examKey({ ...base, session: "iulie" }),
    );
  });
});
