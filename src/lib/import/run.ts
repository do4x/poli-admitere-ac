import type { Prisma, PrismaClient, Subject } from "@prisma/client";
import type { ImportFile } from "./schema";
import { planImport, type ImportPlan, type PlannedProblem } from "./plan";

type Db = PrismaClient | Prisma.TransactionClient;

export interface RunImportResult {
  examCreated: boolean;
  examId: string;
  counts: ImportPlan["counts"];
  problems: PlannedProblem[];
}

/**
 * `session` is part of the compound unique but nullable; SQLite treats NULLs
 * as distinct, so Prisma cannot `upsert` on that key when session is null.
 * Always look up with findFirst (where `session: null` compiles to IS NULL)
 * and branch on the result.
 */
async function findExam(db: Db, exam: ImportFile["exam"]) {
  return db.exam.findFirst({
    where: {
      year: exam.year,
      kind: exam.kind,
      subject: exam.subject,
      session: exam.session,
    },
    include: {
      problems: {
        select: {
          number: true,
          latex: true,
          isDepartajare: true,
          tags: { select: { name: true } },
        },
      },
    },
  });
}

/** Dry-run: what would this import do? No writes. */
export async function planAgainstDb(
  db: Db,
  file: ImportFile,
): Promise<ImportPlan> {
  const exam = await findExam(db, file.exam);
  return planImport(exam?.problems ?? [], file.problems, exam !== null);
}

/** Apply an import atomically. Idempotent: re-running is all skips. */
export async function runImport(
  db: PrismaClient,
  file: ImportFile,
): Promise<RunImportResult> {
  return db.$transaction(async (tx) => {
    const exam = await findExam(tx, file.exam);
    const plan = planImport(exam?.problems ?? [], file.problems, exam !== null);
    const examRow = exam ?? (await tx.exam.create({ data: file.exam }));

    // Resolve tag names to ids within this exam's subject, creating any that
    // are missing. Cached so a name used by several problems is created once.
    const tagIdByName = new Map<string, string>();
    async function tagIdsFor(names: readonly string[]): Promise<{ id: string }[]> {
      const ids: { id: string }[] = [];
      for (const name of names) {
        let id = tagIdByName.get(name);
        if (!id) {
          const existing = await tx.tag.findFirst({
            where: { subject: file.exam.subject as Subject, name },
            select: { id: true },
          });
          id =
            existing?.id ??
            (
              await tx.tag.create({
                data: { subject: file.exam.subject as Subject, name },
                select: { id: true },
              })
            ).id;
          tagIdByName.set(name, id);
        }
        ids.push({ id });
      }
      return ids;
    }

    for (const problem of plan.problems) {
      if (problem.action === "create") {
        const created = await tx.problem.create({
          data: {
            examId: examRow.id,
            number: problem.number,
            latex: problem.latex,
            isDepartajare: problem.isDepartajare,
          },
          select: { id: true },
        });
        if (problem.tagChange) {
          await tx.problem.update({
            where: { id: created.id },
            data: { tags: { set: await tagIdsFor(problem.tagChange.to) } },
          });
        }
      } else if (problem.action === "update") {
        await tx.problem.update({
          where: {
            examId_number: { examId: examRow.id, number: problem.number },
          },
          data: { latex: problem.latex, isDepartajare: problem.isDepartajare },
        });
        if (problem.tagChange) {
          await tx.problem.update({
            where: {
              examId_number: { examId: examRow.id, number: problem.number },
            },
            data: { tags: { set: await tagIdsFor(problem.tagChange.to) } },
          });
        }
      }
    }

    return {
      examCreated: exam === null,
      examId: examRow.id,
      counts: plan.counts,
      problems: plan.problems,
    };
  });
}
