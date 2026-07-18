import { notFound, permanentRedirect } from "next/navigation";
import { fetchCatalog } from "@/app/probleme/query";
import { problemHref } from "@/lib/slug";

/**
 * Legacy /problems/{cuid} URLs (bookmarks, old emails) 308-redirect to the
 * canonical slug URL, query string preserved. Resolved from the cached
 * catalog — no DB traffic.
 */
export default async function LegacyProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const problem = (await fetchCatalog()).find((p) => p.id === id);
  if (!problem) notFound();

  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) query.set(key, single);
  }
  permanentRedirect(problemHref(problem, query.toString() || undefined));
}
