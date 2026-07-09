"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function toggleDepartajare(problemId: string): Promise<void> {
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true, examId: true, isDepartajare: true },
  });
  if (!problem) return;

  await prisma.problem.update({
    where: { id: problem.id },
    data: { isDepartajare: !problem.isDepartajare },
  });

  revalidatePath("/");
  revalidatePath("/exams");
  revalidatePath(`/exams/${problem.examId}`);
  revalidatePath(`/problems/${problem.id}`);
}
