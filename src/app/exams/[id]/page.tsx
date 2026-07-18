import { notFound, permanentRedirect } from "next/navigation";
import { fetchCatalog } from "@/app/probleme/query";
import { examHref } from "@/lib/slug";

/**
 * Legacy /exams/{cuid} URLs 308-redirect to the canonical slug URL
 * (/mate/preadmitere/2026). Resolved from the cached catalog — no DB traffic.
 */
export default async function LegacyExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = (await fetchCatalog()).find((p) => p.exam.id === id);
  if (!problem) notFound();
  permanentRedirect(examHref(problem.exam));
}
