import type { MetadataRoute } from "next";

// robots.txt and sitemap.xml (src/app/robots.ts, src/app/sitemap.ts). Pure, unit-tested.

/** Public marketing pages, without the locale prefix ("" = home). Portfolio cases come from the DB. */
export const PUBLIC_PATHS = [
  "",
  "/services",
  "/portfolio",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
] as const;

/** Never crawled: the admin, every dentist portal, and the API. */
export const ROBOTS_DISALLOW = ["/admin", "/*/portal", "/api"] as const;

/**
 * One sitemap entry per page and locale, each listing every language version (hreflang) plus
 * x-default (the default locale), as Google expects: every URL names all its alternates, itself
 * included.
 */
export function localizedSitemap(
  siteUrl: string,
  paths: readonly string[],
  locales: readonly string[],
  defaultLocale: string,
): MetadataRoute.Sitemap {
  const origin = new URL(siteUrl).origin;
  const url = (locale: string, path: string) => `${origin}/${locale}${path}`;
  return paths.flatMap((path) => {
    const languages: Record<string, string> = Object.fromEntries(
      locales.map((locale) => [locale, url(locale, path)]),
    );
    languages["x-default"] = url(defaultLocale, path);
    return locales.map((locale) => ({
      url: url(locale, path),
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : 0.7,
      alternates: { languages },
    }));
  });
}
