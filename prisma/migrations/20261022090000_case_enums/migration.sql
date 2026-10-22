-- Enum changes, in their own migration: Postgres can't use a newly added enum value
-- (DRAFT as a column default) in the same transaction that adds it.

-- CreateEnum
CREATE TYPE "ScanPart" AS ENUM ('UPPER', 'LOWER', 'BITE');

-- AlterEnum
ALTER TYPE "CaseEventType" ADD VALUE 'FILE_FAILED';

-- AlterEnum
ALTER TYPE "CaseStatus" ADD VALUE 'DRAFT' BEFORE 'SUBMITTED';

-- AlterEnum
BEGIN;
CREATE TYPE "UploadStatus_new" AS ENUM ('PENDING', 'UPLOADING', 'COMPLETE', 'FAILED');
ALTER TABLE "public"."case_file" ALTER COLUMN "uploadStatus" DROP DEFAULT;
ALTER TABLE "case_file" ALTER COLUMN "uploadStatus" TYPE "UploadStatus_new" USING ("uploadStatus"::text::"UploadStatus_new");
ALTER TYPE "UploadStatus" RENAME TO "UploadStatus_old";
ALTER TYPE "UploadStatus_new" RENAME TO "UploadStatus";
DROP TYPE "public"."UploadStatus_old";
ALTER TABLE "case_file" ALTER COLUMN "uploadStatus" SET DEFAULT 'PENDING';
COMMIT;
