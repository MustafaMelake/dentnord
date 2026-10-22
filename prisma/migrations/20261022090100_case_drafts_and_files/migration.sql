-- Case drafts (no case number until submit), surgical kit per implant site, CaseFile upload details.
-- No cases exist yet in any environment, so dropping case.surgicalKitId loses nothing.

-- DropForeignKey
ALTER TABLE "case" DROP CONSTRAINT "case_surgicalKitId_fkey";

-- DropIndex
DROP INDEX "case_surgicalKitId_idx";

-- AlterTable
ALTER TABLE "case" DROP COLUMN "surgicalKitId",
ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "caseNumber" DROP NOT NULL,
ALTER COLUMN "patientCode" SET DEFAULT '',
ALTER COLUMN "status" SET DEFAULT 'DRAFT',
ALTER COLUMN "guideTypeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "case_file" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "scanPart" "ScanPart";

-- AlterTable
ALTER TABLE "case_implant" ADD COLUMN     "surgicalKitId" TEXT,
ALTER COLUMN "diameter" DROP NOT NULL,
ALTER COLUMN "length" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "case_dentistId_status_idx" ON "case"("dentistId", "status");

-- CreateIndex
CREATE INDEX "case_implant_surgicalKitId_idx" ON "case_implant"("surgicalKitId");

-- AddForeignKey
ALTER TABLE "case_implant" ADD CONSTRAINT "case_implant_surgicalKitId_fkey" FOREIGN KEY ("surgicalKitId") REFERENCES "surgical_kit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
