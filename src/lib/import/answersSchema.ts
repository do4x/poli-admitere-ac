import { z } from "zod";
import { answerChoiceSchema, examKindSchema, subjectSchema } from "./schema";
import { examKey } from "./tagsSchema";

/**
 * Answers-only import: official grila keys extracted from the published
 * baremuri, applied to existing problems. Carries no LaTeX and no tags,
 * so it can never clobber statements or classification.
 */

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

const assignmentSchema = z.object({
  exam: examKeySchema,
  number: z.string().min(1).max(32),
  answer: answerChoiceSchema,
});

export const answersFileSchema = z
  .object({
    assignments: z.array(assignmentSchema).min(1).max(500),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    for (const assignment of file.assignments) {
      const key = `${examKey(assignment.exam)}#${assignment.number}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assignments"],
          message: `Răspuns duplicat pentru problema "${assignment.number}" din același examen`,
        });
      }
      seen.add(key);
    }
  });

export type AnswersFile = z.infer<typeof answersFileSchema>;
export type AnswerAssignment = AnswersFile["assignments"][number];

/** Parse raw JSON text into a validated answers file (BOM-tolerant). */
export function parseAnswersFile(
  jsonText: string,
): { ok: true; file: AnswersFile } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText.replace(/^﻿/, ""));
  } catch (error) {
    return {
      ok: false,
      error: `JSON invalid: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const result = answersFileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `Validare eșuată: ${issues}` };
  }
  return { ok: true, file: result.data };
}
