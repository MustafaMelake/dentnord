import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";

// Public catalog reads for the marketing site. Cached ("use cache") so pages prerender;
// admin mutations must call `revalidateTag(<tag>)` / `updateTag(<tag>)` after writes.

export const CATALOG_TAGS = {
  services: "services",
  guideTypes: "guide-types",
  implantSystems: "implant-systems",
} as const;

export async function getPublishedServices() {
  "use cache";
  cacheTag(CATALOG_TAGS.services);
  cacheLife("hours");
  return db.service.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, title: true, summary: true },
  });
}

export async function getActiveGuideTypes() {
  "use cache";
  cacheTag(CATALOG_TAGS.guideTypes);
  cacheLife("hours");
  return db.guideType.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, name: true },
  });
}

export async function countActiveImplantSystems() {
  "use cache";
  cacheTag(CATALOG_TAGS.implantSystems);
  cacheLife("hours");
  return db.implantSystem.count({ where: { active: true } });
}
