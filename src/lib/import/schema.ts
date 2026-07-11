import { z } from "zod";

export const examKindSchema = z.enum(["ADMITERE", "PREADMITERE"]);
export const subjectSchema = z.enum(["MATE", "INFO"]);

// Size caps: the server-action body limit is 50 MB, so without per-field
// bounds any LAN peer could bloat the DB / stall the KaTeX renderer.
export const importProblemSchema = z.object({
  number: z.string().min(1).max(32),
  isDepartajare: z.boolean().default(false),
  latex: z.string().min(1).max(50_000),
  // Optional topic tags. Absent ⇒ the problem's tags are left untouched on
  // import; present ⇒ the tag set is replaced with exactly these.
  types: z.array(z.string().trim().min(1).max(60)).max(3).optional(),
});

export const importFileSchema = z
  .object({
    exam: z.object({
      year: z.number().int().min(2015).max(2026),
      kind: examKindSchema,
      subject: subjectSchema,
      session: z
        .string()
        .min(1)
        .max(200)
        .nullish()
        .transform((value) => value ?? null),
    }),
    problems: z.array(importProblemSchema).min(1).max(500),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    for (const problem of file.problems) {
      if (seen.has(problem.number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["problems"],
          message: `Număr de problemă duplicat în fișier: "${problem.number}"`,
        });
      }
      seen.add(problem.number);
    }
  });

export type ImportFile = z.infer<typeof importFileSchema>;
export type ImportProblem = ImportFile["problems"][number];

/**
 * Parse raw JSON text into a validated import file.
 * JSON.parse already turns `\\mathbb` into `\mathbb` — nothing here may
 * unescape backslashes a second time.
 */
export function parseImportFile(
  jsonText: string,
):
  | { ok: true; file: ImportFile }
  | { ok: false; error: string } {
  let raw: unknown;
  try {
    // PowerShell 5.1's `-Encoding utf8` writes a BOM, which JSON.parse rejects.
    raw = JSON.parse(jsonText.replace(/^\uFEFF/, ""));
  } catch (error) {
    return {
      ok: false,
      error: `JSON invalid: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const result = importFileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `Validare eșuată: ${issues}` };
  }
  return { ok: true, file: result.data };
}
