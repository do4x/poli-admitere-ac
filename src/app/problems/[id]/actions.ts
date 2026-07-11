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

const MAX_TAGS = 3;
const TAG_NAME_MAX = 60;

export interface TagActionState {
  error: string | null;
}

function revalidateProblem(problemId: string): void {
  revalidatePath(`/problems/${problemId}`);
  revalidatePath("/probleme");
}

/** Attach an existing tag to a problem (from the dropdown). */
export async function addTagAction(
  problemId: string,
  _previous: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  const tagId = String(formData.get("tagId") ?? "");
  if (!tagId) return { error: "Alege un tip." };

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: {
      exam: { select: { subject: true } },
      tags: { select: { id: true } },
    },
  });
  if (!problem) return { error: "Problema nu există." };

  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    select: { id: true, subject: true },
  });
  if (!tag) return { error: "Tipul nu există." };
  if (tag.subject !== problem.exam.subject) {
    return { error: "Tipul nu se potrivește cu materia problemei." };
  }
  if (problem.tags.some((t) => t.id === tag.id)) {
    return { error: null }; // already attached — nothing to do
  }
  if (problem.tags.length >= MAX_TAGS) {
    return { error: `Maxim ${MAX_TAGS} tipuri per problemă.` };
  }

  await prisma.problem.update({
    where: { id: problemId },
    data: { tags: { connect: { id: tag.id } } },
  });
  revalidateProblem(problemId);
  return { error: null };
}

/** Detach a tag from a problem. Never deletes the tag itself. */
export async function removeTagFromProblem(
  problemId: string,
  tagId: string,
): Promise<void> {
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true },
  });
  if (!problem) return;

  await prisma.problem.update({
    where: { id: problemId },
    data: { tags: { disconnect: { id: tagId } } },
  });
  revalidateProblem(problemId);
}

/** Create a new tag (subject = the problem's subject) and attach it. */
export async function createTagAction(
  problemId: string,
  _previous: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > TAG_NAME_MAX) {
    return { error: `Numele tipului trebuie să aibă 1–${TAG_NAME_MAX} caractere.` };
  }

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: {
      exam: { select: { subject: true } },
      tags: { select: { id: true } },
    },
  });
  if (!problem) return { error: "Problema nu există." };
  if (problem.tags.length >= MAX_TAGS) {
    return { error: `Maxim ${MAX_TAGS} tipuri per problemă.` };
  }

  const subject = problem.exam.subject;
  const existing = await prisma.tag.findUnique({
    where: { subject_name: { subject, name } },
    select: { id: true },
  });
  if (existing) {
    return {
      error: "Există deja un tip cu acest nume — alege-l din listă.",
    };
  }

  await prisma.problem.update({
    where: { id: problemId },
    data: { tags: { create: { subject, name } } },
  });
  revalidateProblem(problemId);
  return { error: null };
}
