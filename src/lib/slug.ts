/**
 * Human-readable problem URLs: /pb{număr}-{materie}/{fel}/{an}, e.g.
 * /pb1-mate/preadmitere/2026 or /pb8-info/simulare/2024. "simulare" is not an
 * ExamKind — those exams are ADMITERE with a session starting "Simulare".
 * The 2015–2019 M1/M2 papers add a variant suffix (pb2-mate-m2/admitere/2018)
 * because year+kind+subject alone is ambiguous there. Slugs resolve against
 * the cached catalog, so no extra DB traffic.
 */

export interface SlugExam {
  year: number;
  kind: string;
  subject: string;
  session: string | null;
}

export interface SlugProblem {
  number: string;
  exam: SlugExam;
}

export type KindSlug = "admitere" | "preadmitere" | "simulare";

const M_VARIANT = /\bM([12])\b/;

function isSimulare(exam: SlugExam): boolean {
  return exam.kind === "ADMITERE" && /^simulare/i.test(exam.session ?? "");
}

export function examKindSlug(exam: SlugExam): KindSlug {
  if (isSimulare(exam)) return "simulare";
  return exam.kind === "PREADMITERE" ? "preadmitere" : "admitere";
}

/** "M1" | "M2" when the session names one of the split papers, else null. */
export function examVariant(exam: SlugExam): "M1" | "M2" | null {
  const match = M_VARIANT.exec(exam.session ?? "");
  return match ? (`M${match[1]}` as "M1" | "M2") : null;
}

/** "pb1-mate/preadmitere/2026" — no leading slash. */
export function problemSlug(problem: SlugProblem): string {
  const subject = problem.exam.subject.toLowerCase();
  const variant = examVariant(problem.exam);
  const pb = `pb${problem.number.toLowerCase()}-${subject}${
    variant ? `-${variant.toLowerCase()}` : ""
  }`;
  return `${pb}/${examKindSlug(problem.exam)}/${problem.exam.year}`;
}

/** Absolute-path href for a problem, optionally with a query string. */
export function problemHref(problem: SlugProblem, query?: string): string {
  const q = query ? `?${query}` : "";
  return `/${problemSlug(problem)}${q}`;
}

/** "mate/preadmitere/2026" — the exam's own page, no leading slash. */
export function examSlug(exam: SlugExam): string {
  const variant = examVariant(exam);
  const subject = `${exam.subject.toLowerCase()}${
    variant ? `-${variant.toLowerCase()}` : ""
  }`;
  return `${subject}/${examKindSlug(exam)}/${exam.year}`;
}

/** Absolute-path href for an exam page. */
export function examHref(exam: SlugExam): string {
  return `/${examSlug(exam)}`;
}

export interface ParsedSlug {
  number: string;
  subject: "MATE" | "INFO";
  kindSlug: KindSlug;
  variant: "M1" | "M2" | null;
  year: number;
}

export type ParsedExamSlug = Omit<ParsedSlug, "number">;

const PB_SEGMENT = /^pb([a-z0-9.]+)-(mate|info)(?:-(m[12]))?$/;
const SUBJECT_SEGMENT = /^(mate|info)(?:-(m[12]))?$/;
const KIND_SEGMENTS: readonly KindSlug[] = ["admitere", "preadmitere", "simulare"];

/** Parse ["pb1-mate", "preadmitere", "2026"] → typed parts, or null. */
export function parseProblemSlug(segments: readonly string[]): ParsedSlug | null {
  if (segments.length !== 3) return null;
  const [pbRaw, kindRaw, yearRaw] = segments.map((s) =>
    decodeURIComponent(s).toLowerCase(),
  );

  const pb = PB_SEGMENT.exec(pbRaw);
  if (!pb) return null;
  if (!(KIND_SEGMENTS as readonly string[]).includes(kindRaw)) return null;
  if (!/^\d{4}$/.test(yearRaw)) return null;

  return {
    number: pb[1],
    subject: pb[2].toUpperCase() as "MATE" | "INFO",
    kindSlug: kindRaw as KindSlug,
    variant: pb[3] ? (pb[3].toUpperCase() as "M1" | "M2") : null,
    year: Number(yearRaw),
  };
}

/** Parse ["mate", "preadmitere", "2026"] → typed parts, or null. */
export function parseExamSlug(
  segments: readonly string[],
): ParsedExamSlug | null {
  if (segments.length !== 3) return null;
  const [subjectRaw, kindRaw, yearRaw] = segments.map((s) =>
    decodeURIComponent(s).toLowerCase(),
  );

  const subject = SUBJECT_SEGMENT.exec(subjectRaw);
  if (!subject) return null;
  if (!(KIND_SEGMENTS as readonly string[]).includes(kindRaw)) return null;
  if (!/^\d{4}$/.test(yearRaw)) return null;

  return {
    subject: subject[1].toUpperCase() as "MATE" | "INFO",
    kindSlug: kindRaw as KindSlug,
    variant: subject[2] ? (subject[2].toUpperCase() as "M1" | "M2") : null,
    year: Number(yearRaw),
  };
}

/** Does this exam answer to the parsed slug (same rules as for problems)? */
export function matchesParsedExamSlug(
  parsed: ParsedExamSlug,
  exam: SlugExam,
): boolean {
  if (exam.subject !== parsed.subject) return false;
  if (exam.year !== parsed.year) return false;
  if (examKindSlug(exam) !== parsed.kindSlug) return false;
  if (parsed.variant !== null && examVariant(exam) !== parsed.variant) {
    return false;
  }
  return true;
}

/** Does this catalog problem answer to the parsed slug? */
export function matchesParsedSlug(
  parsed: ParsedSlug,
  problem: SlugProblem,
): boolean {
  if (problem.number.toLowerCase() !== parsed.number) return false;
  return matchesParsedExamSlug(parsed, problem.exam);
}
