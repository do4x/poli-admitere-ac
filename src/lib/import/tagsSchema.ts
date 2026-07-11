import { z } from "zod";
import { examKindSchema, subjectSchema } from "./schema";

/**
 * Tags-only import: Claude classifies problem statements outside the app and
 * writes the result here. This never carries LaTeX, so a tags import can
 * never clobber a problem statement.
 */

const tagNameSchema = z.string().trim().min(1).max(60);

const examKeySchema = z.object({
  year: z.number().int().min(2015).max(2026),
  kind: examKindSchema,
  subject: subjectSchema,
  session: z
    .string()
    .min(1)
    .max(200)
    .nullish()
    .transform((value) => value ?? null),
});

const seedTagSchema = z.object({
  subject: subjectSchema,
  name: tagNameSchema,
});

const assignmentSchema = z.object({
  exam: examKeySchema,
  number: z.string().min(1).max(32),
  types: z.array(tagNameSchema).min(1).max(3),
});

/** Stable string key for an exam, matching the compound unique (session incl. null). */
export function examKey(exam: {
  year: number;
  kind: string;
  subject: string;
  session: string | null;
}): string {
  return `${exam.year}|${exam.kind}|${exam.subject}|${exam.session ?? ""}`;
}

export const tagsFileSchema = z
  .object({
    tags: z.array(seedTagSchema).max(500).optional(),
    assignments: z.array(assignmentSchema).min(1).max(500),
  })
  .superRefine((file, ctx) => {
    const seenAssignment = new Set<string>();
    for (const assignment of file.assignments) {
      const key = `${examKey(assignment.exam)}#${assignment.number}`;
      if (seenAssignment.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assignments"],
          message: `Atribuire duplicată pentru problema "${assignment.number}" din același examen`,
        });
      }
      seenAssignment.add(key);
    }
    const seenSeed = new Set<string>();
    for (const seed of file.tags ?? []) {
      const key = `${seed.subject}|${seed.name}`;
      if (seenSeed.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tags"],
          message: `Tip duplicat în lista de bază: "${seed.name}" (${seed.subject})`,
        });
      }
      seenSeed.add(key);
    }
  });

export type TagsFile = z.infer<typeof tagsFileSchema>;
export type TagAssignment = TagsFile["assignments"][number];
export type SeedTag = { subject: string; name: string };

/**
 * Parse raw JSON text into a validated tags file.
 * As in schema.ts, JSON.parse already turns `\\` into `\` — nothing here may
 * unescape backslashes a second time.
 */
export function parseTagsFile(
  jsonText: string,
): { ok: true; file: TagsFile } | { ok: false; error: string } {
  let raw: unknown;
  try {
    // PowerShell 5.1's `-Encoding utf8` writes a BOM, which JSON.parse rejects.
    raw = JSON.parse(jsonText.replace(/^﻿/, ""));
  } catch (error) {
    return {
      ok: false,
      error: `JSON invalid: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const result = tagsFileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `Validare eșuată: ${issues}` };
  }
  return { ok: true, file: result.data };
}
