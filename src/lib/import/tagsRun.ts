import type { Prisma, PrismaClient, Subject } from "@prisma/client";
import { examKey, type SeedTag, type TagsFile } from "./tagsSchema";
import {
  planTagAssignments,
  type PlannedAssignment,
  type TagCurrentState,
  type TagPlan,
} from "./tagsPlan";

type Db = PrismaClient | Prisma.TransactionClient;

export interface TagsReport {
  tagged: number;
  skipped: number;
  /** Assignments whose exam or problem could not be resolved. */
  unmatched: PlannedAssignment[];
  newTags: SeedTag[];
}

interface Resolved {
  state: TagCurrentState;
  /** `${subject}|${name}` → tag id, for existing tags. */
  tagIdByIdentity: Map<string, string>;
}

/**
 * Read the current DB state the planner needs. Exams are looked up with
 * findFirst (session: null compiles to IS NULL) — never upsert, because
 * SQLite treats NULLs as distinct in the compound unique. See run.ts.
 */
async function resolve(db: Db, file: TagsFile): Promise<Resolved> {
  const examByKey = new Map<string, TagsFile["assignments"][number]["exam"]>();
  for (const a of file.assignments) examByKey.set(examKey(a.exam), a.exam);

  const problems: TagCurrentState["problems"] = new Map();
  for (const [key, exam] of examByKey) {
    const row = await db.exam.findFirst({
      where: {
        year: exam.year,
        kind: exam.kind,
        subject: exam.subject,
        session: exam.session,
      },
      include: {
        problems: {
          select: { id: true, number: true, tags: { select: { name: true } } },
        },
      },
    });
    if (!row) continue; // exam missing → its assignments fall through as unmatched
    for (const p of row.problems) {
      problems.set(`${key}#${p.number}`, {
        problemId: p.id,
        currentTypes: p.tags.map((t) => t.name),
      });
    }
  }

  const allTags = await db.tag.findMany({
    select: { id: true, name: true, subject: true },
  });
  const existingTags = new Set(allTags.map((t) => `${t.subject}|${t.name}`));
  const tagIdByIdentity = new Map(
    allTags.map((t) => [`${t.subject}|${t.name}`, t.id]),
  );

  return { state: { problems, existingTags }, tagIdByIdentity };
}

/** Dry-run: what would this tags import do? No writes. */
export async function planTagsAgainstDb(
  db: Db,
  file: TagsFile,
): Promise<TagPlan> {
  const { state } = await resolve(db, file);
  return planTagAssignments(state, file);
}

/** Apply a tags import atomically. Idempotent: re-running is all skips. */
export async function runTagsImport(
  db: PrismaClient,
  file: TagsFile,
): Promise<TagsReport> {
  return db.$transaction(async (tx) => {
    const { state, tagIdByIdentity } = await resolve(tx, file);
    const plan = planTagAssignments(state, file);

    for (const t of plan.newTagsToCreate) {
      const created = await tx.tag.create({
        data: { name: t.name, subject: t.subject as Subject },
      });
      tagIdByIdentity.set(`${t.subject}|${t.name}`, created.id);
    }

    for (const a of plan.assignments) {
      if (a.action !== "set" || !a.problemId) continue;
      const tagIds = a.to.map((name) => ({
        id: tagIdByIdentity.get(`${a.subject}|${name}`) as string,
      }));
      await tx.problem.update({
        where: { id: a.problemId },
        data: { tags: { set: tagIds } },
      });
    }

    return {
      tagged: plan.counts.set,
      skipped: plan.counts.skipped,
      unmatched: plan.assignments.filter((a) => a.action === "unmatched"),
      newTags: plan.newTagsToCreate,
    };
  });
}
