"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseImportFile } from "@/lib/import/schema";
import { planAgainstDb, runImport } from "@/lib/import/run";
import type { ProblemAction } from "@/lib/import/plan";
import { examLabel } from "@/lib/format";

export interface PlanCounts {
  created: number;
  updated: number;
  skipped: number;
}

export type DryRunResult =
  | { ok: false; error: string }
  | {
      ok: true;
      examLabel: string;
      examExists: boolean;
      counts: PlanCounts;
      problems: {
        number: string;
        isDepartajare: boolean;
        action: ProblemAction;
        departajareChange?: { from: boolean; to: boolean };
      }[];
    };

export type CommitResult =
  | { ok: false; error: string }
  | { ok: true; examId: string; examCreated: boolean; counts: PlanCounts };

export async function dryRunImport(jsonText: string): Promise<DryRunResult> {
  const parsed = parseImportFile(jsonText);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  const plan = await planAgainstDb(prisma, parsed.file);
  return {
    ok: true,
    examLabel: examLabel(parsed.file.exam),
    examExists: plan.examExists,
    counts: plan.counts,
    problems: plan.problems.map((problem) => ({
      number: problem.number,
      isDepartajare: problem.isDepartajare,
      action: problem.action,
      departajareChange: problem.departajareChange,
    })),
  };
}

export async function commitImport(jsonText: string): Promise<CommitResult> {
  const parsed = parseImportFile(jsonText);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  const result = await runImport(prisma, parsed.file);
  revalidatePath("/");
  revalidatePath("/exams");
  revalidatePath(`/exams/${result.examId}`);
  return {
    ok: true,
    examId: result.examId,
    examCreated: result.examCreated,
    counts: result.counts,
  };
}
