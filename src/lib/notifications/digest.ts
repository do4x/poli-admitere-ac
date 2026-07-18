import { problemHref } from "@/lib/slug";

export interface DigestProblem {
  id: string;
  number: string;
  exam: {
    year: number;
    kind: string;
    subject: string;
    session: string | null;
  };
}

export interface Digest {
  subject: string;
  text: string;
  problemCount: number;
}

export function digestSubject(problemCount: number): string {
  return `${problemCount} probleme de rezolvat singur — Departaj`;
}

function problemLabel(p: DigestProblem): string {
  const session = p.exam.session ? ` (${p.exam.session})` : "";
  return `Problema ${p.number} — ${p.exam.kind} ${p.exam.subject} ${p.exam.year}${session}`;
}

/**
 * One digest, not one email per problem. Problems appearing via several due
 * solutions are listed once.
 */
export function buildDigest(
  problems: readonly DigestProblem[],
  baseUrl = "http://localhost:3000",
): Digest {
  const unique: DigestProblem[] = [];
  const seen = new Set<string>();
  for (const p of problems) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    unique.push(p);
  }

  const lines = unique.map(
    (p) => `- ${problemLabel(p)}\n  ${baseUrl}${problemHref(p)}`,
  );
  const text = [
    `Au trecut 3 zile de când le-ai rezolvat cu AI — statutul lor s-a resetat:`,
    "",
    ...lines,
    "",
    `Rezolvă-le acum corect la grilă (fără să vezi răspunsul) sau încarcă`,
    `propria rezolvare — abia atunci contează ca rezolvate.`,
  ].join("\n");

  return {
    subject: digestSubject(unique.length),
    text,
    problemCount: unique.length,
  };
}
