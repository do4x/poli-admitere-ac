import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/auth";

/**
 * Crawlers were enumerating the /probleme filter/pagination query space
 * (tag × an × materie × stare × pagina), each hit a full dynamic render.
 * Query-string URLs are blocked wholesale; the sitemap hands crawlers the
 * canonical clean URLs instead (problem pages are otherwise only linked
 * with ?from=… context params).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/*?",
          "/api/",
          "/login",
          "/cont",
          "/revizuire",
          "/import",
          "/auth/",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
