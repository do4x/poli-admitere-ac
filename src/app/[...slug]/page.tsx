import { notFound } from "next/navigation";
import { ExamView } from "@/app/exams/[id]/ExamView";
import { ProblemView } from "@/app/problems/[id]/ProblemView";
import { fetchCatalog } from "@/app/probleme/query";
import {
  matchesParsedExamSlug,
  matchesParsedSlug,
  parseExamSlug,
  parseProblemSlug,
} from "@/lib/slug";

/**
 * Canonical slug URLs, resolved against the cached catalog (random bot probes
 * of unknown paths cost no DB traffic; anything ambiguous or unknown is a
 * plain 404):
 * - problems: /pb{număr}-{materie}/{fel}/{an} → /pb1-mate/preadmitere/2026
 * - exams:    /{materie}/{fel}/{an}           → /mate/preadmitere/2026
 */
export default async function SlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;

  const problemSlug = parseProblemSlug(slug);
  if (problemSlug) {
    const catalog = await fetchCatalog();
    const matches = catalog.filter((p) => matchesParsedSlug(problemSlug, p));
    if (matches.length !== 1) notFound();
    return (
      <ProblemView
        problemId={matches[0].id}
        searchParams={await searchParams}
      />
    );
  }

  const examSlug = parseExamSlug(slug);
  if (examSlug) {
    const catalog = await fetchCatalog();
    const examIds = new Set(
      catalog
        .filter((p) => matchesParsedExamSlug(examSlug, p.exam))
        .map((p) => p.exam.id),
    );
    if (examIds.size !== 1) notFound();
    return <ExamView examId={[...examIds][0]} />;
  }

  notFound();
}
