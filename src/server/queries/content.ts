import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import { toBilingual } from "@/lib/validation/admin";
import { TAGS } from "@/server/cache-tags";
import { publicImageSelect, toPublicImage } from "@/server/queries/media";

// Public reads for testimonials and the portfolio (cached, invalidated by the admin actions).

export async function getPublishedTestimonials() {
  "use cache";
  cacheTag(TAGS.testimonials);
  cacheLife("hours");
  const rows = await db.testimonial.findMany({
    // `consent` is enforced at publish time (form + DB CHECK); filtering on it too costs nothing.
    where: { published: true, consent: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, quote: true, authorName: true, clinic: true },
  });
  return rows.map((t) => ({ ...t, quote: toBilingual(t.quote) }));
}

const portfolioSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  implantCount: true,
  guideType: { select: { name: true } },
  images: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, caption: true, media: { select: publicImageSelect } },
  },
};

function toPortfolioCase(row: {
  id: string;
  slug: string;
  title: unknown;
  summary: unknown;
  implantCount: number | null;
  guideType: { name: unknown } | null;
  images: { id: string; caption: unknown; media: Parameters<typeof toPublicImage>[0] }[];
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: toBilingual(row.title),
    summary: toBilingual(row.summary),
    implantCount: row.implantCount,
    guideTypeName: row.guideType ? toBilingual(row.guideType.name) : null,
    images: row.images.map((i) => ({
      id: i.id,
      caption: toBilingual(i.caption),
      image: toPublicImage(i.media),
    })),
  };
}

export type PublicPortfolioCase = ReturnType<typeof toPortfolioCase>;

export async function getPublishedPortfolio() {
  "use cache";
  cacheTag(TAGS.portfolio, TAGS.media, TAGS.guideTypes);
  cacheLife("hours");
  const rows = await db.portfolioCase.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
    select: portfolioSelect,
  });
  return rows.map(toPortfolioCase);
}

export async function getPublishedPortfolioCase(slug: string) {
  "use cache";
  cacheTag(TAGS.portfolio, TAGS.media, TAGS.guideTypes);
  cacheLife("hours");
  const row = await db.portfolioCase.findFirst({
    where: { slug, published: true },
    select: portfolioSelect,
  });
  return row ? toPortfolioCase(row) : null;
}

export async function getPublishedPortfolioSlugs() {
  "use cache";
  cacheTag(TAGS.portfolio);
  cacheLife("hours");
  const rows = await db.portfolioCase.findMany({
    where: { published: true },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}
