"use server";

import { unlink } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { computeReviewDueAt } from "@/lib/domain";
import { savePdf, solutionAbsolutePath } from "@/lib/storage";

export interface UploadState {
  error: string | null;
  uploadedAt: number | null;
}

const PDF_MAGIC = "%PDF";

export async function uploadSolution(
  problemId: string,
  _previous: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Alege un fișier PDF.", uploadedAt: null };
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Fișierul trebuie să aibă extensia .pdf.", uploadedAt: null };
  }

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true },
  });
  if (!problem) {
    return { error: "Problema nu există.", uploadedAt: null };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, PDF_MAGIC.length).toString("latin1") !== PDF_MAGIC) {
    return { error: "Fișierul nu este un PDF valid.", uploadedAt: null };
  }

  const aiAssisted = formData.get("aiAssisted") === "on";
  // Rule 6: submittedAt is decided here, server-side, and is never editable.
  const submittedAt = new Date();
  const pdfPath = await savePdf(problem.id, bytes, submittedAt);

  try {
    await prisma.solution.create({
      data: {
        problemId: problem.id,
        pdfPath,
        submittedAt,
        aiAssisted,
        reviewDueAt: computeReviewDueAt(submittedAt, aiAssisted),
      },
    });
  } catch (error) {
    // Don't leave an orphaned PDF; surface the failure in the form instead
    // of crashing (e.g. SQLite locked by a concurrent CLI import).
    await unlink(solutionAbsolutePath(pdfPath)).catch(() => {});
    console.error("[departaj] Salvarea soluției a eșuat:", error);
    return {
      error: "Salvarea în baza de date a eșuat. Încearcă din nou.",
      uploadedAt: null,
    };
  }

  revalidatePath("/");
  revalidatePath("/exams");
  revalidatePath(`/problems/${problem.id}`);
  return { error: null, uploadedAt: submittedAt.getTime() };
}
