import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runImport } from "./run";
import type { TagsFile } from "./tagsSchema";
import { planTagsAgainstDb, runTagsImport } from "./tagsRun";

/**
 * Integration tests on a real temp SQLite db — like run.test.ts, they prove the
 * null-session lookup and the tag many-to-many behave against real SQLite.
 */

let dir: string;
let db: PrismaClient;

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "departaj-tags-test-"));
  const dbPath = path.join(dir, "test.db").replace(/\\/g, "/");
  const sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { encoding: "utf8" },
  );
  db = new PrismaClient({ datasourceUrl: `file:${dbPath}` });
  for (const statement of sql.split(";")) {
    if (statement.trim()) {
      await db.$executeRawUnsafe(statement);
    }
  }
  // Seed an exam with a NULL session and two problems.
  await runImport(db, {
    exam: { year: 2024, kind: "ADMITERE", subject: "MATE", session: null },
    problems: [
      { number: "1", isDepartajare: true, latex: "Fie $\\int x\\,dx$." },
      { number: "2", isDepartajare: true, latex: "Fie sistemul." },
    ],
  });
}, 60_000);

afterAll(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const exam = {
  year: 2024 as const,
  kind: "ADMITERE" as const,
  subject: "MATE" as const,
  session: null,
};

function tagsFile(over?: Partial<TagsFile>): TagsFile {
  return {
    assignments: [
      { exam, number: "1", types: ["integrale"] },
      { exam, number: "2", types: ["sisteme"] },
    ],
    ...over,
  };
}

describe("runTagsImport", () => {
  it("creates tags and attaches them to matched problems (null session)", async () => {
    const report = await runTagsImport(db, tagsFile());
    expect(report.tagged).toBe(2);
    expect(report.unmatched).toHaveLength(0);
    expect(report.newTags).toHaveLength(2);

    const p1 = await db.problem.findFirstOrThrow({
      where: { number: "1" },
      include: { tags: true },
    });
    expect(p1.tags.map((t) => t.name).sort()).toEqual(["integrale"]);
    // Tags are subject-scoped.
    expect(p1.tags[0].subject).toBe("MATE");
  });

  it("re-import is a no-op (all skips, no new tags, no duplicate exam)", async () => {
    const report = await runTagsImport(db, tagsFile());
    expect(report.tagged).toBe(0);
    expect(report.skipped).toBe(2);
    expect(report.newTags).toHaveLength(0);
    expect(await db.tag.count()).toBe(2);
  });

  it("replaces a problem's tag set, leaving other problems untouched", async () => {
    const report = await runTagsImport(
      db,
      tagsFile({
        assignments: [{ exam, number: "1", types: ["polinoame"] }],
      }),
    );
    expect(report.tagged).toBe(1);
    const p1 = await db.problem.findFirstOrThrow({
      where: { number: "1" },
      include: { tags: true },
    });
    expect(p1.tags.map((t) => t.name)).toEqual(["polinoame"]);
    // Problem 2 keeps its tag because it was absent from this file.
    const p2 = await db.problem.findFirstOrThrow({
      where: { number: "2" },
      include: { tags: true },
    });
    expect(p2.tags.map((t) => t.name)).toEqual(["sisteme"]);
  });

  it("reports unmatched assignments and writes nothing for them", async () => {
    const before = await db.tag.count();
    const report = await runTagsImport(
      db,
      tagsFile({
        assignments: [{ exam, number: "999", types: ["inexistent"] }],
      }),
    );
    expect(report.unmatched).toHaveLength(1);
    expect(report.tagged).toBe(0);
    expect(await db.tag.count()).toBe(before);
  });

  it("seeds approved-but-unused types via the top-level tags list", async () => {
    const report = await runTagsImport(
      db,
      tagsFile({
        assignments: [{ exam, number: "1", types: ["polinoame"] }],
        tags: [{ subject: "INFO", name: "grafuri" }],
      }),
    );
    expect(report.newTags).toContainEqual({ subject: "INFO", name: "grafuri" });
    const grafuri = await db.tag.findFirstOrThrow({
      where: { name: "grafuri" },
      include: { problems: true },
    });
    expect(grafuri.subject).toBe("INFO");
    expect(grafuri.problems).toHaveLength(0);
  });
});

describe("planTagsAgainstDb", () => {
  it("reports a dry run without writing", async () => {
    const before = await db.tag.count();
    const plan = await planTagsAgainstDb(
      db,
      tagsFile({
        assignments: [{ exam, number: "2", types: ["nou-tip"] }],
      }),
    );
    expect(plan.counts.set).toBe(1);
    expect(plan.newTagsToCreate).toContainEqual({
      subject: "MATE",
      name: "nou-tip",
    });
    expect(await db.tag.count()).toBe(before);
  });
});
