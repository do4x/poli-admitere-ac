import { z } from "zod";
import {
  AXIS_VALUES,
  K_VALUES,
  P_VALUES,
  T_VALUES,
  V_VALUES,
  computeDRaw,
} from "@/lib/domain";
import { examKindSchema, subjectSchema } from "./schema";
import { examKey } from "./tagsSchema";

/**
 * Difficulty-only import: the grading blocks produced offline per
 * DIFICULTATE.md, applied to problems that already exist. Carries no LaTeX
 * and no tags, so it can never clobber a statement or its classification.
 *
 * The file states only the six scores; `D_raw`, `nivel`, `banda_margine` and
 * `arhetip` are recomputed on import from `src/lib/domain/difficulty.ts`. If
 * the grader also supplies them they are treated as a checksum: a mismatch
 * fails validation rather than being silently overwritten. Arithmetic slips
 * in a hand-written grading block are exactly what this catches.
 */

const oneOf = (values: readonly number[], label: string) =>
  z.number().refine((n) => values.includes(n), {
    message: `${label} trebuie să fie una dintre ${values.join(", ")}`,
  });

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

const gradingSchema = z.object({
  exam: examKeySchema,
  number: z.string().min(1).max(32),

  R: oneOf(AXIS_VALUES, "R"),
  E: oneOf(AXIS_VALUES, "E"),
  T: oneOf(T_VALUES, "T"),
  P: oneOf(P_VALUES, "P"),
  K: oneOf(K_VALUES, "K"),
  V: oneOf(V_VALUES, "V"),

  /** Optional checksum — verified against the recomputed value. */
  D_raw: z.number().optional(),
  timp_tinta_min: z.number().int().min(1).max(120),
  declansator: z.string().min(1).max(500).nullish(),
  incertitudine: z.boolean().default(false),
});

export const difficultyFileSchema = z
  .object({
    gradings: z.array(gradingSchema).min(1).max(500),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.gradings.forEach((g, index) => {
      const key = `${examKey(g.exam)}#${g.number}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gradings", index],
          message: `Gradare duplicată pentru problema "${g.number}" din același examen`,
        });
      }
      seen.add(key);

      if (g.D_raw === undefined) return;
      const expected = computeDRaw({
        r: g.R,
        e: g.E,
        t: g.T,
        p: g.P,
        k: g.K,
        v: g.V,
      });
      if (Math.abs(g.D_raw - expected) > 0.005) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gradings", index, "D_raw"],
          message: `D_raw declarat ${g.D_raw} ≠ ${expected} calculat din R/E/T/P/K/V (problema "${g.number}")`,
        });
      }
    });
  });

export type DifficultyFile = z.infer<typeof difficultyFileSchema>;
export type DifficultyGrading = DifficultyFile["gradings"][number];

/** Parse raw JSON text into a validated difficulty file (BOM-tolerant). */
export function parseDifficultyFile(
  jsonText: string,
): { ok: true; file: DifficultyFile } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText.replace(/^﻿/, ""));
  } catch (error) {
    return {
      ok: false,
      error: `JSON invalid: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const result = difficultyFileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `Validare eșuată: ${issues}` };
  }
  return { ok: true, file: result.data };
}
