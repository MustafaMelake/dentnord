import type { MetadataRoute } from "next";

import { env } from "@/env";
import { routing } from "@/i18n/routing";
import { localizedSitemap, PUBLIC_PATHS } from "@/lib/seo";
import { getPublishedPortfolioSlugs } from "@/server/queries/content";

// /sitemap.xml: the public pages in Danish and English with hreflang alternates, plus every published
// portfolio case (cached query; publishing in /admin updates it through its cache tag).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getPublishedPortfolioSlugs();
  return localizedSitemap(
    env.NEXT_PUBLIC_SITE_URL,
    [...PUBLIC_PATHS, ...slugs.map((slug) => `/portfolio/${encodeURIComponent(slug)}`)],
    routing.locales,
    routing.defaultLocale,
  );
}
