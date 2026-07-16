"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { Subject } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CATALOG_TAG } from "./query";

const TAG_NAME_MAX = 60;
const NOT_ADMIN = "Doar administratorul poate modifica taxonomia.";

export interface TaxonomyActionState {
  error: string | null;
}

function revalidateTaxonomy(): void {
  revalidateTag(CATALOG_TAG); // tag names live in the cached catalog
  revalidatePath("/probleme");
}

/** Create a new tag type without visiting a problem. */
export async function createTag(
  _previous: TaxonomyActionState,
  formData: FormData,
): Promise<TaxonomyActionState> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { error: NOT_ADMIN };

  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "");
  if (subject !== "MATE" && subject !== "INFO") {
    return { error: "Materie invalidă." };
  }
  if (name.length < 1 || name.length > TAG_NAME_MAX) {
    return { error: `Numele tipului trebuie să aibă 1–${TAG_NAME_MAX} caractere.` };
  }

  const existing = await prisma.tag.findUnique({
    where: { subject_name: { subject: subject as Subject, name } },
    select: { id: true },
  });
  if (existing) return { error: "Există deja un tip cu acest nume." };

  await prisma.tag.create({ data: { subject: subject as Subject, name } });
  revalidateTaxonomy();
  return { error: null };
}

/** Rename a tag; the new name must stay unique within its subject. */
export async function renameTag(
  tagId: string,
  _previous: TaxonomyActionState,
  formData: FormData,
): Promise<TaxonomyActionState> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { error: NOT_ADMIN };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > TAG_NAME_MAX) {
    return { error: `Numele tipului trebuie să aibă 1–${TAG_NAME_MAX} caractere.` };
  }

  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    select: { subject: true },
  });
  if (!tag) return { error: "Tipul nu există." };

  const clash = await prisma.tag.findUnique({
    where: { subject_name: { subject: tag.subject, name } },
    select: { id: true },
  });
  if (clash && clash.id !== tagId) {
    return { error: "Există deja un tip cu acest nume." };
  }

  await prisma.tag.update({ where: { id: tagId }, data: { name } });
  revalidateTaxonomy();
  return { error: null };
}

/**
 * Delete a tag. Implicit many-to-many means the join rows vanish with it;
 * the problems themselves stay, merely untagged from this type. The UI
 * requires an explicit confirmation before calling when problems are attached.
 */
export async function deleteTag(tagId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return;

  await prisma.tag.delete({ where: { id: tagId } }).catch(() => {});
  revalidateTaxonomy();
}
