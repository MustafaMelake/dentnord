import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: { remotePatterns: mediaRemotePatterns(), formats: ["image/avif", "image/webp"] },
  partialPrefetching: true,
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
