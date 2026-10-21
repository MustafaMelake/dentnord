/*
  Warnings:

  - You are about to drop the column `coverImage` on the `portfolio_case` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `portfolio_case` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_REORDERED';
ALTER TYPE "AuditAction" ADD VALUE 'MEDIA_UPLOADED';

-- AlterTable
ALTER TABLE "portfolio_case" DROP COLUMN "coverImage",
DROP COLUMN "images",
ADD COLUMN     "guideTypeId" TEXT,
ADD COLUMN     "implantCount" INTEGER;

-- AlterTable
ALTER TABLE "service" ADD COLUMN     "imageId" TEXT,
ADD COLUMN     "priceFrom" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "portfolio_image" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "caption" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "portfolio_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonial" (
    "id" TEXT NOT NULL,
    "quote" JSONB NOT NULL,
    "authorName" TEXT NOT NULL,
    "clinic" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "alt" JSONB NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_image_caseId_sortOrder_idx" ON "portfolio_image"("caseId", "sortOrder");

-- CreateIndex
CREATE INDEX "portfolio_image_mediaId_idx" ON "portfolio_image"("mediaId");

-- CreateIndex
CREATE INDEX "testimonial_published_sortOrder_idx" ON "testimonial"("published", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_key_key" ON "media_asset"("key");

-- CreateIndex
CREATE INDEX "media_asset_createdAt_idx" ON "media_asset"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "media_asset_uploadedById_idx" ON "media_asset"("uploadedById");

-- CreateIndex
CREATE INDEX "portfolio_case_guideTypeId_idx" ON "portfolio_case"("guideTypeId");

-- CreateIndex
CREATE INDEX "service_imageId_idx" ON "service"("imageId");

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_case" ADD CONSTRAINT "portfolio_case_guideTypeId_fkey" FOREIGN KEY ("guideTypeId") REFERENCES "guide_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_image" ADD CONSTRAINT "portfolio_image_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "portfolio_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_image" ADD CONSTRAINT "portfolio_image_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────── Hand-written ─────────────

-- A testimonial can only be published with written consent (the admin form enforces this too).
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_published_requires_consent"
  CHECK (NOT "published" OR "consent");

-- Data: the "About the doctor" content moves from messages/*.json into the DB (SiteSetting "doctor").
-- Carries over the name and the four expertise rows that were on the site; everything that was a
-- [placeholder] starts empty (hidden on the site, listed in the admin content checklist).
INSERT INTO "site_setting" ("key", "value", "updatedAt") VALUES (
  'doctor',
  '{
    "name": "Dr. Hossam",
    "credentials": { "da": "", "en": "" },
    "bio": { "da": "", "en": "" },
    "city": "",
    "languages": { "da": "", "en": "" },
    "expertise": [
      { "id": "single", "title": { "da": "Enkelttandsimplantater", "en": "Single implants" }, "tag": { "da": "Tandstøttet", "en": "Tooth-supported" } },
      { "id": "full-arch", "title": { "da": "Helkæbe", "en": "Full-arch" }, "tag": { "da": "Stabelbare skabeloner", "en": "Stackable guides" } },
      { "id": "bone", "title": { "da": "Knoglestøttede skabeloner", "en": "Bone-supported guides" }, "tag": { "da": "Knogleforankret", "en": "Bone-anchored" } },
      { "id": "planning", "title": { "da": "Kun planlægning", "en": "Planning only" }, "tag": { "da": "Plan + rapport", "en": "Plan + report" } }
    ]
  }'::jsonb,
  CURRENT_TIMESTAMP
) ON CONFLICT ("key") DO NOTHING;
