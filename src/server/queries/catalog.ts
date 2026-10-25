import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import { TAGS } from "@/server/cache-tags";
import { publicImageSelect, toPublicImage } from "@/server/queries/media";

// Public catalog reads for the marketing site. Cached ("use cache") so pages prerender; admin Server
// Actions call `updateTag()` with the matching TAGS entry after every write.

export async function getPublishedServices() {
  "use cache";
  cacheTag(TAGS.services, TAGS.media);
  cacheLife("hours");
  const rows = await db.service.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      priceAmount: true,
      priceFrom: true,
      currency: true,
      priceNote: true,
      image: { select: publicImageSelect },
    },
  });
  return rows.map(({ image, ...s }) => ({ ...s, image: image ? toPublicImage(image) : null }));
}

export async function getActiveGuideTypes() {
  "use cache";
  cacheTag(TAGS.guideTypes);
  cacheLife("hours");
  return db.guideType.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, name: true },
  });
}

export async function countActiveImplantSystems() {
  "use cache";
  cacheTag(TAGS.implantSystems);
  cacheLife("hours");
  return db.implantSystem.count({ where: { active: true } });
}
