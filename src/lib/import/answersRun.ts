import type { Prisma, PrismaClient } from "@prisma/client";
import { examKey } from "./tagsSchema";
import type { AnswersFile } from "./answersSchema";
import {
  planAnswerAssignments,
  type AnswersCurrentState,
  type AnswersPlan,
} from "./answersPlan";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Exams resolved with the findFirst pattern (session: null compiles to
 * IS NULL) — never upsert on the compound unique. See run.ts.
 */
async function resolve(db: Db, file: AnswersFile): Promise<AnswersCurrentState> {
  const examByKey = new Map<string, AnswersFile["assignments"][number]["exam"]>();
  for (const a of file.assignments) examByKey.set(examKey(a.exam), a.exam);

  const state: AnswersCurrentState = new Map();
  for (const [key, exam] of examByKey) {
    const row = await db.exam.findFirst({
      where: {
        year: exam.year,
        kind: exam.kind,
        subject: exam.subject,
        session: exam.session,
      },
      include: {
        problems: { select: { id: true, number: true, correctAnswer: true } },
      },
    });
    if (!row) continue; // missing exam → assignments fall through as unmatched
    for (const p of row.problems) {
      state.set(`${key}#${p.number}`, {
        problemId: p.id,
        currentAnswer: p.correctAnswer,
      });
    }
  }
  return state;
}

/** Dry-run: what would this answers import do? No writes. */
export async function planAnswersAgainstDb(
  db: Db,
  file: AnswersFile,
): Promise<AnswersPlan> {
  return planAnswerAssignments(await resolve(db, file), file.assignments);
}

/** Apply an answers import atomically. Idempotent: re-running is all skips. */
export async function runAnswersImport(
  db: PrismaClient,
  file: AnswersFile,
): Promise<AnswersPlan> {
  return db.$transaction(async (tx) => {
    const plan = planAnswerAssignments(await resolve(tx, file), file.assignments);
    for (const a of plan.assignments) {
      if (a.action !== "set" || !a.problemId) continue;
      await tx.problem.update({
        where: { id: a.problemId },
        data: { correctAnswer: a.to },
      });
    }
    return plan;
  });
}
