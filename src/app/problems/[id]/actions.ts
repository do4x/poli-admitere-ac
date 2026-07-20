"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/app/probleme/query";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aiPhase, computeAiDueAt, grilaLocked } from "@/lib/domain";
import {
  MAX_SOLUTION_BYTES,
  QUOTA_MAX_BYTES,
  QUOTA_MAX_FILES,
  detectSolutionMime,
  removeSolutionFile,
  uploadSolutionFile,
} from "@/lib/storage";

const NOT_ADMIN = "Doar administratorul poate modifica tipurile.";
const UPLOADS_PER_DAY = 20;

export interface UploadState {
  error: string | null;
  uploadedAt: number | null;
}

export async function uploadSolution(
  problemId: string,
  _previous: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Autentificare necesară pentru a încărca soluții.", uploadedAt: null };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Alege un fișier PDF sau o poză.", uploadedAt: null };
  }
  if (file.size > MAX_SOLUTION_BYTES) {
    return { error: "Fișierul depășește limita de 10 MB.", uploadedAt: null };
  }

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true },
  });
  if (!problem) {
    return { error: "Problema nu există.", uploadedAt: null };
  }

  const usage = await prisma.solution.aggregate({
    where: { userId: user.id },
    _count: true,
    _sum: { sizeBytes: true },
  });
  if (
    usage._count >= QUOTA_MAX_FILES ||
    (usage._sum.sizeBytes ?? 0) + file.size > QUOTA_MAX_BYTES
  ) {
    return {
      error: "Ai atins limita de stocare pentru soluții (100 fișiere / 500 MB).",
      uploadedAt: null,
    };
  }

  const lastDay = await prisma.solution.count({
    where: {
      userId: user.id,
      submittedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (lastDay >= UPLOADS_PER_DAY) {
    return {
      error: "Prea multe încărcări în 24h — continuă mâine.",
      uploadedAt: null,
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = detectSolutionMime(bytes);
  if (!mime) {
    return { error: "Fișierul trebuie să fie PDF, PNG sau JPG.", uploadedAt: null };
  }

  const aiAssisted = formData.get("aiAssisted") === "on";
  // Rule 6: submittedAt is decided here, server-side, and is never editable.
  const submittedAt = new Date();

  let filePath: string;
  try {
    filePath = await uploadSolutionFile(user.id, problem.id, bytes, submittedAt, mime);
  } catch (error) {
    console.error("[departaj] Upload-ul în Storage a eșuat:", error);
    return { error: "Încărcarea fișierului a eșuat. Încearcă din nou.", uploadedAt: null };
  }

  try {
    await prisma.solution.create({
      data: {
        problemId: problem.id,
        userId: user.id,
        pdfPath: filePath,
        sizeBytes: bytes.length,
        submittedAt,
        aiAssisted,
      },
    });
  } catch (error) {
    // Don't leave an orphaned file; surface the failure in the form.
    await removeSolutionFile(filePath).catch(() => {});
    console.error("[departaj] Salvarea soluției a eșuat:", error);
    return {
      error: "Salvarea în baza de date a eșuat. Încearcă din nou.",
      uploadedAt: null,
    };
  }

  if (aiAssisted) {
    // An AI upload opens (or joins) the 72h re-solve window. An existing mark
    // keeps its original clock — re-uploading never postpones the deadline.
    await prisma.aiMark.upsert({
      where: {
        problemId_userId: { problemId: problem.id, userId: user.id },
      },
      create: {
        problemId: problem.id,
        userId: user.id,
        markedAt: submittedAt,
        dueAt: computeAiDueAt(submittedAt),
      },
      update: {},
    });
  } else {
    // An independent upload settles any open AI mark for good.
    await prisma.aiMark.updateMany({
      where: { problemId: problem.id, userId: user.id, redeemedAt: null },
      data: { redeemedAt: submittedAt },
    });
  }

  revalidatePath("/");
  revalidatePath("/exams");
  revalidatePath("/cont");
  revalidatePath(`/problems/${problem.id}`);
  return { error: null, uploadedAt: submittedAt.getTime() };
}

export interface AiMarkState {
  error: string | null;
}

/** "Am rezolvat cu AI" without an upload: opens the 72h re-solve window. */
export async function markAiAction(
  problemId: string,
  _previous: AiMarkState,
): Promise<AiMarkState> {
  const user = await getSessionUser();
  if (!user) return { error: "Autentificare necesară." };

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true },
  });
  if (!problem) return { error: "Problema nu există." };

  const markedAt = new Date();
  await prisma.aiMark.upsert({
    where: { problemId_userId: { problemId, userId: user.id } },
    create: {
      problemId,
      userId: user.id,
      markedAt,
      dueAt: computeAiDueAt(markedAt),
    },
    update: {}, // already marked — the original clock stands
  });

  revalidatePath("/");
  revalidatePath("/cont");
  revalidateProblem(problemId);
  return { error: null };
}

/**
 * Undo an accidental AI mark — allowed only while the window is still open
 * and no AI-assisted upload backs the mark. Past dueAt the reset is a
 * commitment, not a preference.
 */
export async function unmarkAiAction(
  problemId: string,
  _previous: AiMarkState,
): Promise<AiMarkState> {
  const user = await getSessionUser();
  if (!user) return { error: "Autentificare necesară." };

  const mark = await prisma.aiMark.findUnique({
    where: { problemId_userId: { problemId, userId: user.id } },
    select: { id: true, dueAt: true, redeemedAt: true },
  });
  if (!mark) return { error: null };
  if (mark.redeemedAt !== null || mark.dueAt.getTime() <= Date.now()) {
    return { error: "Termenul a trecut — rezolv-o singur ca să conteze." };
  }

  const aiUploads = await prisma.solution.count({
    where: { problemId, userId: user.id, aiAssisted: true },
  });
  if (aiUploads > 0) {
    return {
      error: "Există o rezolvare încărcată cu AI — marcajul nu se poate anula.",
    };
  }

  await prisma.aiMark.delete({ where: { id: mark.id } });

  revalidatePath("/");
  revalidatePath("/cont");
  revalidateProblem(problemId);
  return { error: null };
}

export interface DeleteSolutionState {
  error: string | null;
}

/** Delete one of the caller's own solutions: DB row first (source of truth
 *  for quota and solve state), then the Storage object — an orphaned file is
 *  recoverable, a dangling DB row is not. */
export async function deleteSolutionAction(
  solutionId: string,
  _previous: DeleteSolutionState,
): Promise<DeleteSolutionState> {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Autentificare necesară." };
  }

  const solution = await prisma.solution.findUnique({
    where: { id: solutionId },
    select: { id: true, userId: true, problemId: true, pdfPath: true },
  });
  if (!solution || solution.userId !== user.id) {
    return { error: "Soluția nu există." };
  }

  await prisma.solution.delete({ where: { id: solution.id } });
  try {
    await removeSolutionFile(solution.pdfPath);
  } catch (error) {
    console.error("[departaj] Ștergerea fișierului din Storage a eșuat:", error);
  }

  revalidatePath("/");
  revalidatePath("/cont");
  revalidatePath(`/problems/${solution.problemId}`);
  return { error: null };
}

const MAX_TAGS = 3;
const TAG_NAME_MAX = 60;

const CHOICES = ["a", "b", "c", "d", "e", "f"] as const;
const ATTEMPTS_PER_MINUTE = 5;

export interface GrilaState {
  error: string | null;
  /** Set after a CHOICE submit: was it right? */
  correct?: boolean;
}

/**
 * Check a grila choice against the official key. The key is read and
 * compared HERE only — it must never travel to the client.
 */
export async function submitAnswerAction(
  problemId: string,
  _previous: GrilaState,
  formData: FormData,
): Promise<GrilaState> {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Autentifică-te pentru a verifica răspunsul." };
  }

  const choice = String(formData.get("choice") ?? "");
  if (!(CHOICES as readonly string[]).includes(choice)) {
    return { error: "Alege o variantă (a–f)." };
  }

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { correctAnswer: true },
  });
  if (!problem) return { error: "Problema nu există." };
  if (problem.correctAnswer === null) {
    return { error: "Răspunsul oficial nu este disponibil pentru această problemă." };
  }

  const answeredAt = new Date();
  const mark = await prisma.aiMark.findUnique({
    where: { problemId_userId: { problemId, userId: user.id } },
    select: { id: true, dueAt: true, redeemedAt: true },
  });
  const previous = await prisma.answerAttempt.findMany({
    where: { problemId, userId: user.id },
    select: { kind: true, correct: true },
    orderBy: { createdAt: "asc" },
  });
  // The grila closes for good on the first correct answer — re-answering a
  // solved problem proves nothing (the only way back in is redemption).
  if (grilaLocked(previous, aiPhase(mark, answeredAt))) {
    return { error: "Ai găsit deja răspunsul corect la această problemă." };
  }

  const recent = await prisma.answerAttempt.count({
    where: {
      problemId,
      userId: user.id,
      kind: "CHOICE",
      createdAt: { gte: new Date(Date.now() - 60_000) },
    },
  });
  if (recent >= ATTEMPTS_PER_MINUTE) {
    return { error: "Prea multe încercări — așteaptă un minut." };
  }

  const correct = choice === problem.correctAnswer;
  await prisma.answerAttempt.create({
    data: { problemId, userId: user.id, kind: "CHOICE", choice, correct },
  });

  if (correct) {
    // Redemption: a correct answer AFTER the 72h window closes settles the AI
    // mark — any number of tries, but never once the key was revealed.
    if (
      mark &&
      mark.redeemedAt === null &&
      mark.dueAt.getTime() <= answeredAt.getTime()
    ) {
      if (!previous.some((a) => a.kind === "REVEAL")) {
        await prisma.aiMark.update({
          where: { id: mark.id },
          data: { redeemedAt: answeredAt },
        });
        revalidatePath("/cont");
      }
    }
  }

  revalidateProblem(problemId);
  revalidatePath("/");
  return { error: null, correct };
}

/**
 * Reveal the official key. Recorded as a REVEAL attempt, which permanently
 * blocks the "verificată pe grilă" state for this problem (you can no longer
 * self-verify with a known answer). The page re-render shows the key.
 */
export async function revealAnswerAction(problemId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { correctAnswer: true },
  });
  if (!problem || problem.correctAnswer === null) return;

  await prisma.answerAttempt.create({
    data: { problemId, userId: user.id, kind: "REVEAL" },
  });

  revalidateProblem(problemId);
  revalidatePath("/");
}

export interface TagActionState {
  error: string | null;
}

function revalidateProblem(problemId: string): void {
  revalidatePath(`/problems/${problemId}`);
  revalidatePath("/probleme");
}

/** Tag edits change the shared catalog (grila attempts don't — those are
 *  per-user rows fetched outside the cache). */
function revalidateProblemTags(problemId: string): void {
  revalidateTag(CATALOG_TAG);
  revalidateProblem(problemId);
}

/** Attach an existing tag to a problem (from the dropdown). */
export async function addTagAction(
  problemId: string,
  _previous: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { error: NOT_ADMIN };

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
  revalidateProblemTags(problemId);
  return { error: null };
}

/** Detach a tag from a problem. Never deletes the tag itself. */
export async function removeTagFromProblem(
  problemId: string,
  tagId: string,
): Promise<void> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return;

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true },
  });
  if (!problem) return;

  await prisma.problem.update({
    where: { id: problemId },
    data: { tags: { disconnect: { id: tagId } } },
  });
  revalidateProblemTags(problemId);
}

/** Create a new tag (subject = the problem's subject) and attach it. */
export async function createTagAction(
  problemId: string,
  _previous: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { error: NOT_ADMIN };

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
  revalidateProblemTags(problemId);
  return { error: null };
}
