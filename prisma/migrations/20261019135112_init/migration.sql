-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DENTIST');

-- CreateEnum
CREATE TYPE "DentistStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('SUBMITTED', 'NEEDS_FILES', 'IN_PLANNING', 'AWAITING_APPROVAL', 'CHANGES_REQUESTED', 'APPROVED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CaseFileKind" AS ENUM ('CBCT', 'INTRAORAL_SCAN', 'PHOTO', 'PLAN_REPORT', 'GUIDE_STL', 'OTHER');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'COMPLETED', 'FAILED', 'ABORTED');

-- CreateEnum
CREATE TYPE "CaseEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'FILE_ADDED', 'FILE_REMOVED', 'PLAN_APPROVED', 'CHANGES_REQUESTED', 'UPDATED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DENTIST',
    "dentistStatus" "DentistStatus" NOT NULL DEFAULT 'PENDING',
    "clinicName" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "address" TEXT,
    "preferredLocale" TEXT NOT NULL DEFAULT 'da',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "patientCode" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "surgeryDate" DATE,
    "notes" TEXT,
    "dentistId" TEXT NOT NULL,
    "guideTypeId" TEXT NOT NULL,
    "surgicalKitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_number_sequence" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "case_number_sequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "case_implant" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fdiTooth" INTEGER NOT NULL,
    "implantSystemId" TEXT,
    "implantSystemOther" TEXT,
    "diameter" DOUBLE PRECISION NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "case_implant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_file" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "CaseFileKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "uploadId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_event" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "CaseEventType" NOT NULL,
    "fromStatus" "CaseStatus",
    "toStatus" "CaseStatus",
    "actorId" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_message" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "summary" JSONB,
    "description" JSONB,
    "priceAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'DKK',
    "priceNote" JSONB,
    "icon" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_type" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "priceAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'DKK',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "implant_system" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "diameters" DOUBLE PRECISION[],
    "lengths" DOUBLE PRECISION[],
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "implant_system_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surgical_kit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "description" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surgical_kit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_case" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "summary" JSONB,
    "body" JSONB,
    "coverImage" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "tags" TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "_ImplantSystemToSurgicalKit" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ImplantSystemToSurgicalKit_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_dentistStatus_idx" ON "user"("role", "dentistStatus");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "case_caseNumber_key" ON "case"("caseNumber");

-- CreateIndex
CREATE INDEX "case_dentistId_createdAt_idx" ON "case"("dentistId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "case_dentistId_patientCode_idx" ON "case"("dentistId", "patientCode");

-- CreateIndex
CREATE INDEX "case_status_updatedAt_idx" ON "case"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "case_guideTypeId_idx" ON "case"("guideTypeId");

-- CreateIndex
CREATE INDEX "case_surgicalKitId_idx" ON "case"("surgicalKitId");

-- CreateIndex
CREATE INDEX "case_implant_implantSystemId_idx" ON "case_implant"("implantSystemId");

-- CreateIndex
CREATE UNIQUE INDEX "case_implant_caseId_fdiTooth_key" ON "case_implant"("caseId", "fdiTooth");

-- CreateIndex
CREATE UNIQUE INDEX "case_file_storageKey_key" ON "case_file"("storageKey");

-- CreateIndex
CREATE INDEX "case_file_caseId_kind_idx" ON "case_file"("caseId", "kind");

-- CreateIndex
CREATE INDEX "case_file_uploadedById_idx" ON "case_file"("uploadedById");

-- CreateIndex
CREATE INDEX "case_file_uploadStatus_createdAt_idx" ON "case_file"("uploadStatus", "createdAt");

-- CreateIndex
CREATE INDEX "case_event_caseId_createdAt_idx" ON "case_event"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "case_event_actorId_idx" ON "case_event"("actorId");

-- CreateIndex
CREATE INDEX "case_message_caseId_createdAt_idx" ON "case_message"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "case_message_authorId_idx" ON "case_message"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "service_slug_key" ON "service"("slug");

-- CreateIndex
CREATE INDEX "service_published_sortOrder_idx" ON "service"("published", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "guide_type_slug_key" ON "guide_type"("slug");

-- CreateIndex
CREATE INDEX "guide_type_active_sortOrder_idx" ON "guide_type"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "implant_system_active_brand_idx" ON "implant_system"("active", "brand");

-- CreateIndex
CREATE UNIQUE INDEX "implant_system_brand_line_key" ON "implant_system"("brand", "line");

-- CreateIndex
CREATE UNIQUE INDEX "surgical_kit_name_key" ON "surgical_kit"("name");

-- CreateIndex
CREATE INDEX "surgical_kit_active_sortOrder_idx" ON "surgical_kit"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_case_slug_key" ON "portfolio_case"("slug");

-- CreateIndex
CREATE INDEX "portfolio_case_published_sortOrder_idx" ON "portfolio_case"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "_ImplantSystemToSurgicalKit_B_index" ON "_ImplantSystemToSurgicalKit"("B");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_guideTypeId_fkey" FOREIGN KEY ("guideTypeId") REFERENCES "guide_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_surgicalKitId_fkey" FOREIGN KEY ("surgicalKitId") REFERENCES "surgical_kit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_implant" ADD CONSTRAINT "case_implant_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_implant" ADD CONSTRAINT "case_implant_implantSystemId_fkey" FOREIGN KEY ("implantSystemId") REFERENCES "implant_system"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_file" ADD CONSTRAINT "case_file_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_file" ADD CONSTRAINT "case_file_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_message" ADD CONSTRAINT "case_message_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_message" ADD CONSTRAINT "case_message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ImplantSystemToSurgicalKit" ADD CONSTRAINT "_ImplantSystemToSurgicalKit_A_fkey" FOREIGN KEY ("A") REFERENCES "implant_system"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ImplantSystemToSurgicalKit" ADD CONSTRAINT "_ImplantSystemToSurgicalKit_B_fkey" FOREIGN KEY ("B") REFERENCES "surgical_kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
