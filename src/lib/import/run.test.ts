import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ImportFile } from "./schema";
import { planAgainstDb, runImport } from "./run";
import { createTestDb } from "./test-db";

/**
 * Integration tests on a real throwaway Postgres schema. They exist chiefly to
 * prove the null-session lookup works against actual NULL semantics (NULLs are
 * distinct in unique indexes), which no mock can demonstrate.
 */

let db: PrismaClient;
let drop: () => Promise<void>;

beforeAll(async () => {
  ({ db, drop } = await createTestDb());
}, 60_000);

afterAll(async () => {
  await drop();
});

function file(overrides?: Partial<ImportFile["exam"]>): ImportFile {
  return {
    exam: {
      year: 2024,
      kind: "ADMITERE",
      subject: "MATE",
      session: null,
      ...overrides,
    },
    problems: [
      { number: "1", isDepartajare: false, latex: "Fie $x^2=4$." },
      { number: "2", isDepartajare: true, latex: "Fie $\\mathbb{R}$." },
    ],
  };
}

describe("runImport", () => {
  it("creates exam and problems on first import (null session)", async () => {
    const result = await runImport(db, file());
    expect(result.examCreated).toBe(true);
    expect(result.counts).toEqual({ created: 2, updated: 0, skipped: 0 });
    expect(await db.problem.count()).toBe(2);
  });

  it("re-import is a no-op and does NOT duplicate the null-session exam", async () => {
    const result = await runImport(db, file());
    expect(result.examCreated).toBe(false);
    expect(result.counts).toEqual({ created: 0, updated: 0, skipped: 2 });
    // The trap: an upsert on the compound unique with session=null would
    // have created a second exam because SQLite treats NULLs as distinct.
    expect(
      await db.exam.count({
        where: { year: 2024, kind: "ADMITERE", subject: "MATE" },
      }),
    ).toBe(1);
    expect(await db.problem.count()).toBe(2);
  });

  it("updates changed problems in place", async () => {
    const changed = file();
    changed.problems[1] = {
      number: "2",
      isDepartajare: false,
      latex: "Fie $\\mathbb{R}$.",
    };
    const result = await runImport(db, changed);
    expect(result.counts).toEqual({ created: 0, updated: 1, skipped: 1 });
    const p2 = await db.problem.findFirstOrThrow({ where: { number: "2" } });
    expect(p2.isDepartajare).toBe(false);
  });

  it("keeps a named session separate from the null session", async () => {
    const result = await runImport(db, file({ session: "iulie" }));
    expect(result.examCreated).toBe(true);
    expect(
      await db.exam.count({
        where: { year: 2024, kind: "ADMITERE", subject: "MATE" },
      }),
    ).toBe(2);
  });

  it("preserves LaTeX backslashes through the DB round-trip", async () => {
    const p2 = await db.problem.findFirstOrThrow({
      where: { number: "2", exam: { session: null } },
    });
    expect(p2.latex).toBe("Fie $\\mathbb{R}$.");
  });
});

describe("planAgainstDb", () => {
  it("reports a dry run without writing", async () => {
    const before = await db.problem.count();
    const plan = await planAgainstDb(db, file({ year: 2023 }));
    expect(plan.examExists).toBe(false);
    expect(plan.counts).toEqual({ created: 2, updated: 0, skipped: 0 });
    expect(await db.problem.count()).toBe(before);
    expect(await db.exam.count({ where: { year: 2023 } })).toBe(0);
  });
});

describe("runImport with optional types", () => {
  function taggedFile(): ImportFile {
    return {
      exam: { year: 2020, kind: "ADMITERE", subject: "INFO", session: null },
      problems: [
        { number: "1", isDepartajare: true, latex: "Cod C++", types: ["grafuri", "dp"] },
        { number: "2", isDepartajare: false, latex: "Ce afișează?" }, // no types
      ],
    };
  }

  it("creates tags and attaches them on first import", async () => {
    const result = await runImport(db, taggedFile());
    expect(result.counts.created).toBe(2);
    const p1 = await db.problem.findFirstOrThrow({
      where: { number: "1", exam: { year: 2020 } },
      include: { tags: true },
    });
    expect(p1.tags.map((t) => t.name).sort()).toEqual(["dp", "grafuri"]);
    expect(p1.tags.every((t) => t.subject === "INFO")).toBe(true);
    const p2 = await db.problem.findFirstOrThrow({
      where: { number: "2", exam: { year: 2020 } },
      include: { tags: true },
    });
    expect(p2.tags).toHaveLength(0);
  });

  it("re-importing the identical file is a complete no-op", async () => {
    const result = await runImport(db, taggedFile());
    expect(result.counts).toEqual({ created: 0, updated: 0, skipped: 2 });
  });

  it("a types-less re-import never disturbs existing tags", async () => {
    const noTypes: ImportFile = {
      exam: { year: 2020, kind: "ADMITERE", subject: "INFO", session: null },
      problems: [
        { number: "1", isDepartajare: true, latex: "Cod C++ v2" }, // latex changed, no types
      ],
    };
    const result = await runImport(db, noTypes);
    expect(result.counts.updated).toBe(1);
    const p1 = await db.problem.findFirstOrThrow({
      where: { number: "1", exam: { year: 2020 } },
      include: { tags: true },
    });
    expect(p1.tags.map((t) => t.name).sort()).toEqual(["dp", "grafuri"]);
  });

  it("round-trips the optional answer key and preserves it on answer-less updates", async () => {
    const withAnswer: ImportFile = {
      exam: { year: 2019, kind: "PREADMITERE", subject: "MATE", session: null },
      problems: [{ number: "1", isDepartajare: true, latex: "$1+1$", answer: "d" }],
    };
    await runImport(db, withAnswer);
    let p = await db.problem.findFirstOrThrow({
      where: { number: "1", exam: { year: 2019 } },
    });
    expect(p.correctAnswer).toBe("d");

    // Identical re-import is a no-op.
    const again = await runImport(db, withAnswer);
    expect(again.counts).toEqual({ created: 0, updated: 0, skipped: 1 });

    // Answer-less latex update keeps the stored key.
    const noAnswer: ImportFile = {
      exam: { year: 2019, kind: "PREADMITERE", subject: "MATE", session: null },
      problems: [{ number: "1", isDepartajare: true, latex: "$1+2$" }],
    };
    await runImport(db, noAnswer);
    p = await db.problem.findFirstOrThrow({
      where: { number: "1", exam: { year: 2019 } },
    });
    expect(p.correctAnswer).toBe("d");
  });
});
