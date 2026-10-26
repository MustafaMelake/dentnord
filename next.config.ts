import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { R2_JURISDICTIONS, type R2Jurisdiction } from "./src/lib/r2-endpoint";
import { securityHeaders } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Site images are served from the public R2 media bucket (R2_MEDIA_PUBLIC_URL, e.g. a custom domain or
// the bucket's r2.dev URL). Read at build time; without it there are no remote images to allow.
function mediaRemotePatterns(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  const raw = process.env.R2_MEDIA_PUBLIC_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/+$/, "");
    return [{ protocol: "https", hostname: url.hostname, pathname: `${path}/**` }];
  } catch {
    return [];
  }
}

// Security headers for every response (src/lib/security-headers.ts). Read at build time, like the
// image patterns: changing an R2 or site URL needs a rebuild. CSP_REPORT_ONLY=1 sends the policy as
// Content-Security-Policy-Report-Only (report violations in the console, block nothing).
function headerInput() {
  const env = process.env;
  const jurisdiction = (R2_JURISDICTIONS as readonly string[]).includes(env.R2_JURISDICTION ?? "")
    ? (env.R2_JURISDICTION as R2Jurisdiction)
    : "eu";
  return {
    dev: env.NODE_ENV === "development",
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    r2AccountId: env.R2_ACCOUNT_ID,
    r2Jurisdiction: jurisdiction,
    r2Buckets: [env.R2_CASES_BUCKET || "dentnord-cases", env.R2_MEDIA_BUCKET || "dentnord-media"],
    mediaPublicUrl: env.R2_MEDIA_PUBLIC_URL,
    vercelPreview: env.VERCEL_ENV === "preview",
    reportOnly: env.CSP_REPORT_ONLY === "1",
  };
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  images: { remotePatterns: mediaRemotePatterns(), formats: ["image/avif", "image/webp"] },
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(headerInput()) }];
  },
  experimental: {
    // Vercel restores .next/cache between deploys. A restored Turbopack build cache once shipped the
    // previous compile of globals.css (Tailwind) alongside new code: wrong fonts, no theme tokens.
    // Always compile from scratch; scripts/check-build-css.mjs (run by `pnpm build`) guards the output.
    turbopackFileSystemCacheForBuild: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
