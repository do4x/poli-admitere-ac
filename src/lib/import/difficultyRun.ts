import type { Prisma, PrismaClient } from "@prisma/client";
import { examKey } from "./tagsSchema";
import type { DifficultyFile } from "./difficultySchema";
import {
  planDifficultyGradings,
  type DifficultyCurrentState,
  type DifficultyPlan,
} from "./difficultyPlan";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Exams resolved with the findFirst pattern (session: null compiles to
 * IS NULL) — never upsert on the compound unique. See run.ts.
 */
async function resolve(
  db: Db,
  file: DifficultyFile,
): Promise<DifficultyCurrentState> {
  const examByKey = new Map<string, DifficultyFile["gradings"][number]["exam"]>();
  for (const g of file.gradings) examByKey.set(examKey(g.exam), g.exam);

  const state: DifficultyCurrentState = new Map();
  for (const [key, exam] of examByKey) {
    const row = await db.exam.findFirst({
      where: {
        year: exam.year,
        kind: exam.kind,
        subject: exam.subject,
        session: exam.session,
      },
      include: {
        problems: { select: { id: true, number: true, difficulty: true } },
      },
    });
    if (!row) continue; // missing exam → gradings fall through as unmatched
    for (const p of row.problems) {
      state.set(`${key}#${p.number}`, {
        problemId: p.id,
        current: p.difficulty,
      });
    }
  }
  return state;
}

/** Dry-run: what would this difficulty import do? No writes. */
export async function planDifficultyAgainstDb(
  db: Db,
  file: DifficultyFile,
): Promise<DifficultyPlan> {
  return planDifficultyGradings(await resolve(db, file), file.gradings);
}

/** Apply a difficulty import atomically. Idempotent: re-running is all skips. */
export async function runDifficultyImport(
  db: PrismaClient,
  file: DifficultyFile,
): Promise<DifficultyPlan> {
  return db.$transaction(async (tx) => {
    const plan = planDifficultyGradings(await resolve(tx, file), file.gradings);
    for (const a of plan.assignments) {
      if (a.action !== "set" || !a.problemId) continue;
      const { row } = a;
      await tx.difficulty.upsert({
        where: { problemId: a.problemId },
        create: { problemId: a.problemId, ...row },
        update: row,
      });
    }
    return plan;
  });
}
