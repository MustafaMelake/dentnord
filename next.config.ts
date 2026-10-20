import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
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
