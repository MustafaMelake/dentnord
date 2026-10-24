-- Case lifecycle: plan versions, shipping, message threads (incl. internal notes), email log.

-- DropIndex
DROP INDEX "case_message_caseId_createdAt_idx";

-- AlterTable
ALTER TABLE "case" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippingCarrier" TEXT,
ADD COLUMN     "statusChangedAt" TIMESTAMP(3),
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- Existing submitted cases: their status last changed when they were submitted.
UPDATE "case" SET "statusChangedAt" = COALESCE("submittedAt", "updatedAt") WHERE "status" <> 'DRAFT';

-- AlterTable
ALTER TABLE "case_file" ADD COLUMN     "planId" TEXT;

-- AlterTable (the temporary default only fills rows that already exist)
ALTER TABLE "case_message" ADD COLUMN     "authorRole" "Role" NOT NULL DEFAULT 'DENTIST',
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "internal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "case_message" ALTER COLUMN "authorRole" DROP DEFAULT;

-- CreateTable
CREATE TABLE "case_plan" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "note" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "decision" "PlanDecision",
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "approvalStatement" TEXT,
    "approvalLocale" TEXT,

    CONSTRAINT "case_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_log" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "caseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_plan_caseId_sentAt_idx" ON "case_plan"("caseId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "case_plan_caseId_version_key" ON "case_plan"("caseId", "version");

-- CreateIndex
CREATE INDEX "email_log_caseId_kind_createdAt_idx" ON "email_log"("caseId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "case_file_planId_idx" ON "case_file"("planId");

-- CreateIndex
CREATE INDEX "case_message_caseId_internal_createdAt_idx" ON "case_message"("caseId", "internal", "createdAt");

-- AddForeignKey
ALTER TABLE "case_file" ADD CONSTRAINT "case_file_planId_fkey" FOREIGN KEY ("planId") REFERENCES "case_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_plan" ADD CONSTRAINT "case_plan_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_plan" ADD CONSTRAINT "case_plan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_plan" ADD CONSTRAINT "case_plan_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A decision is a legal record. Once a plan has a decision, nothing about the plan or its decision
-- may change; a plan that was sent can't be un-sent. Enforced in the database, under the app.
CREATE FUNCTION case_plan_guard() RETURNS trigger AS $$
BEGIN
  IF OLD."decision" IS NOT NULL THEN
    RAISE EXCEPTION 'case_plan %: a decided plan is immutable', OLD."id" USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."sentAt" IS NOT NULL AND (
       NEW."sentAt" IS DISTINCT FROM OLD."sentAt"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."caseId" IS DISTINCT FROM OLD."caseId"
    OR NEW."note" IS DISTINCT FROM OLD."note"
  ) THEN
    RAISE EXCEPTION 'case_plan %: a sent plan can only receive a decision', OLD."id" USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."decision" IS NOT NULL AND OLD."sentAt" IS NULL THEN
    RAISE EXCEPTION 'case_plan %: an unsent plan can''t be decided', OLD."id" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER case_plan_guard BEFORE UPDATE ON "case_plan"
  FOR EACH ROW EXECUTE FUNCTION case_plan_guard();
