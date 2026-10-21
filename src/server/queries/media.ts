import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import { toBilingual, type Bilingual } from "@/lib/validation/admin";
import { TAGS } from "@/server/cache-tags";

/** An uploaded image as the public site needs it (next/image + alt in both languages). */
export type PublicImage = {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: Bilingual;
};

export const toPublicImage = (m: {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: unknown;
}): PublicImage => ({
  id: m.id,
  url: m.url,
  width: m.width,
  height: m.height,
  alt: toBilingual(m.alt),
});

export const publicImageSelect = {
  id: true,
  url: true,
  width: true,
  height: true,
  alt: true,
} as const;

/** Images by id (missing ids are simply absent). */
export async function getImages(ids: (string | null)[]): Promise<Record<string, PublicImage>> {
  "use cache";
  cacheTag(TAGS.media);
  cacheLife("hours");
  const wanted = [...new Set(ids.filter((id): id is string => !!id))].sort();
  if (wanted.length === 0) return {};
  const rows = await db.mediaAsset.findMany({
    where: { id: { in: wanted } },
    select: publicImageSelect,
  });
  return Object.fromEntries(rows.map((m) => [m.id, toPublicImage(m)]));
}
