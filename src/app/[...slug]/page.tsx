import { notFound } from "next/navigation";
import { ProblemView } from "@/app/problems/[id]/ProblemView";
import { fetchCatalog } from "@/app/probleme/query";
import { matchesParsedSlug, parseProblemSlug } from "@/lib/slug";

/**
 * Canonical problem URLs: /pb{număr}-{materie}/{fel}/{an}, e.g.
 * /pb1-mate/preadmitere/2026. Resolution runs against the cached catalog, so
 * random bot probes of unknown paths cost no DB traffic. Anything that isn't
 * a well-formed, uniquely-matching slug is a plain 404.
 */
export default async function ProblemSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const parsed = parseProblemSlug(slug);
  if (!parsed) notFound();

  const catalog = await fetchCatalog();
  const matches = catalog.filter((p) => matchesParsedSlug(parsed, p));
  if (matches.length !== 1) notFound();

  return (
    <ProblemView problemId={matches[0].id} searchParams={await searchParams} />
  );
}
