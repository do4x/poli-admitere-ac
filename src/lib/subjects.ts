/**
 * The single source of truth for per-subject visual identity — the colored
 * spine on problem cards and the dot + label on the subject badge. Colors are
 * a FUNDAMENTAL, status-independent property of a problem: they say what the
 * problem *is*, never how far along you are with it.
 *
 * To add a subject later (e.g. physics), add its enum value to `Subject` in
 * the Prisma schema and one entry here — every list and card picks up the new
 * color automatically. Keep each subject's spine and dot the same hue.
 */
export interface SubjectStyle {
  /** Tailwind bg-* for the card's left spine. */
  spine: string;
  /** Tailwind bg-* for the small dot in the subject badge (same hue as spine). */
  dot: string;
  /** Human label shown next to the dot. */
  label: string;
}

const SUBJECTS: Record<string, SubjectStyle> = {
  MATE: { spine: "bg-blue-500", dot: "bg-blue-500", label: "Matematică" },
  INFO: { spine: "bg-violet-500", dot: "bg-violet-500", label: "Informatică" },
  // Future: FIZI: { spine: "bg-amber-500", dot: "bg-amber-500", label: "Fizică" },
};

/** Neutral fallback for a subject with no registered style (never expected). */
const FALLBACK: SubjectStyle = {
  spine: "bg-stone-400",
  dot: "bg-stone-400",
  label: "Materie",
};

export function subjectStyle(subject: string): SubjectStyle {
  return SUBJECTS[subject] ?? FALLBACK;
}
