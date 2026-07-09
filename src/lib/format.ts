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

const DATE_TIME = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_ONLY = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

export function formatDateTime(date: Date): string {
  return DATE_TIME.format(date);
}

export function formatDate(date: Date): string {
  return DATE_ONLY.format(date);
}
