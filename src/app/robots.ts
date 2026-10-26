import type { MetadataRoute } from "next";

import { env } from "@/env";
import { ROBOTS_DISALLOW } from "@/lib/seo";

// /robots.txt. The admin and the portal also send `noindex` and sit behind a login; this keeps
// crawlers from trying at all.
export default function robots(): MetadataRoute.Robots {
  const origin = new URL(env.NEXT_PUBLIC_SITE_URL).origin;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
