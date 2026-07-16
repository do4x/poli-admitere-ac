"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/app/probleme/query";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function toggleDepartajare(problemId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return;

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true, examId: true, isDepartajare: true },
  });
  if (!problem) return;

  await prisma.problem.update({
    where: { id: problem.id },
    data: { isDepartajare: !problem.isDepartajare },
  });

  revalidateTag(CATALOG_TAG);
  revalidatePath("/");
  revalidatePath("/exams");
  revalidatePath(`/exams/${problem.examId}`);
  revalidatePath(`/problems/${problem.id}`);
}
