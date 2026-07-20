export interface ExamLabelInput {
  year: number;
  kind: string;
  subject: string;
  session: string | null;
}

export function examLabel(exam: ExamLabelInput): string {
  const kind = exam.kind === "ADMITERE" ? "Admitere" : "Pre-admitere";
  const subject = exam.subject === "MATE" ? "Matematică" : "Informatică";
  const session = exam.session ? ` — ${exam.session}` : "";
  return `${kind} ${subject} ${exam.year}${session}`;
}

/** Every user is in Romania and the server runs in UTC — pin the zone so a
 *  12:18 upload never renders as 09:18. */
const TIME_ZONE = "Europe/Bucharest";

const DATE_TIME = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

const DATE_ONLY = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeZone: TIME_ZONE,
});

export function formatDateTime(date: Date): string {
  return DATE_TIME.format(date);
}

export function formatDate(date: Date): string {
  return DATE_ONLY.format(date);
}

/** Numeric-aware ordering so "2" sorts before "10" and "M1.3" stays sane. */
export function problemNumberCompare(a: string, b: string): number {
  return a.localeCompare(b, "ro", { numeric: true });
}

/**
 * A solution file is a PDF or an image (png/jpg); the kind is encoded in the
 * stored path's extension. Drives the iframe-vs-img viewer branch.
 */
export function solutionIsImage(path: string): boolean {
  return /\.(png|jpe?g)$/i.test(path);
}
