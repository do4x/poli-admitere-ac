import type { MetadataRoute } from "next";
import { fetchCatalog } from "@/app/probleme/query";
import { siteUrl } from "@/lib/auth";

/**
 * Clean canonical URLs for crawlers — robots.ts blocks every query-string
 * URL, and problem pages are only ever linked with ?from=… context params,
 * so without this they would be undiscoverable. Reads the cached catalog:
 * zero extra DB egress.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const problems = await fetchCatalog();
  return [
    { url: base },
    { url: `${base}/probleme` },
    { url: `${base}/exams` },
    ...problems.map((problem) => ({
      url: `${base}/problems/${problem.id}`,
    })),
  ];
}
