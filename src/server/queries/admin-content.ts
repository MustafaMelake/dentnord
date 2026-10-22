import "server-only";

import { notFound } from "next/navigation";

import { looksLikeExample } from "@/lib/content-fields";
import { db } from "@/lib/db";
import { toBilingual } from "@/lib/validation/admin";
import { mediaStorageStatus } from "@/lib/media-storage";
import { publicImageSelect, toPublicImage } from "@/server/queries/media";
import { requireAdmin } from "@/server/queries/session";

// Admin reads for content management. Each function re-checks the admin session itself.
// `usage` counts decide between hard delete and archive (rows referenced by cases are archived).

export async function adminMediaStatus() {
  await requireAdmin();
  return { configured: mediaStorageStatus().configured };
}

export async function listAdminServices() {
  await requireAdmin();
  const rows = await db.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      priceAmount: true,
      priceFrom: true,
      priceNote: true,
      published: true,
      image: { select: publicImageSelect },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: toBilingual(s.title),
    published: s.published,
    priceAmount: s.priceAmount,
    priceFrom: s.priceFrom,
    image: s.image ? toPublicImage(s.image) : null,
    isExample: looksLikeExample(s.summary, s.description),
  }));
}

export async function getAdminService(id: string) {
  await requireAdmin();
  const s = await db.service.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      summary: true,
      description: true,
      priceAmount: true,
      priceFrom: true,
      priceNote: true,
      published: true,
      image: { select: publicImageSelect },
    },
  });
  if (!s) notFound();
  return {
    id: s.id,
    title: toBilingual(s.title),
    summary: toBilingual(s.summary),
    description: toBilingual(s.description),
    priceAmount: s.priceAmount,
    priceFrom: s.priceFrom,
    priceNote: toBilingual(s.priceNote),
    published: s.published,
    image: s.image ? toPublicImage(s.image) : null,
    isExample: looksLikeExample(s.summary, s.description),
  };
}

export async function listAdminGuideTypes() {
  await requireAdmin();
  const rows = await db.guideType.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      _count: { select: { cases: true } },
    },
  });
  return rows.map((g) => ({
    id: g.id,
    name: toBilingual(g.name),
    description: toBilingual(g.description),
    active: g.active,
    usage: g._count.cases,
    isExample: looksLikeExample(g.description),
  }));
}

export async function listAdminImplantSystems() {
  await requireAdmin();
  const rows = await db.implantSystem.findMany({
    orderBy: [{ sortOrder: "asc" }, { brand: "asc" }, { line: "asc" }],
    select: {
      id: true,
      brand: true,
      line: true,
      diameters: true,
      lengths: true,
      notes: true,
      active: true,
      _count: { select: { implants: true } },
    },
  });
  return rows.map(({ _count, notes, ...s }) => ({
    ...s,
    usage: _count.implants,
    isExample: looksLikeExample(notes),
  }));
}

export async function listAdminSurgicalKits() {
  await requireAdmin();
  const rows = await db.surgicalKit.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      manufacturer: true,
      description: true,
      active: true,
      implantSystems: { select: { id: true } },
      _count: { select: { implants: true } },
    },
  });
  return rows.map((k) => ({
    id: k.id,
    name: k.name,
    manufacturer: k.manufacturer ?? "",
    active: k.active,
    implantSystemIds: k.implantSystems.map((s) => s.id),
    usage: k._count.implants,
    isExample: looksLikeExample(k.description),
  }));
}

export async function listAdminTestimonials() {
  await requireAdmin();
  const rows = await db.testimonial.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    quote: toBilingual(r.quote),
    authorName: r.authorName,
    clinic: r.clinic ?? "",
    consent: r.consent,
    published: r.published,
  }));
}

export async function listAdminPortfolio() {
  await requireAdmin();
  const rows = await db.portfolioCase.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      implantCount: true,
      guideType: { select: { name: true } },
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { media: { select: publicImageSelect } },
      },
      _count: { select: { images: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: toBilingual(p.title),
    published: p.published,
    implantCount: p.implantCount,
    guideTypeName: p.guideType ? toBilingual(p.guideType.name) : null,
    cover: p.images[0] ? toPublicImage(p.images[0].media) : null,
    imageCount: p._count.images,
  }));
}

export async function getAdminPortfolioCase(id: string) {
  await requireAdmin();
  const p = await db.portfolioCase.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      guideTypeId: true,
      implantCount: true,
      published: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: { caption: true, media: { select: publicImageSelect } },
      },
    },
  });
  if (!p) notFound();
  return {
    id: p.id,
    slug: p.slug,
    title: toBilingual(p.title),
    summary: toBilingual(p.summary),
    guideTypeId: p.guideTypeId,
    implantCount: p.implantCount,
    published: p.published,
    images: p.images.map((i) => ({
      caption: toBilingual(i.caption),
      image: toPublicImage(i.media),
    })),
  };
}

/** Options for selects (all rows, archived ones marked). */
export async function guideTypeOptions() {
  await requireAdmin();
  const rows = await db.guideType.findMany({
    orderBy: [{ sortOrder: "asc" }],
    select: { id: true, name: true, active: true },
  });
  return rows.map((g) => ({ id: g.id, name: toBilingual(g.name), active: g.active }));
}

/** Recent uploads for the image picker's library. */
export async function listMediaLibrary(take = 60) {
  await requireAdmin();
  const rows = await db.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: publicImageSelect,
  });
  return rows.map(toPublicImage);
}
