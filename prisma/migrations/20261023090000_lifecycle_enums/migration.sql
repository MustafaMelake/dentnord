-- Enum values first, in their own migration: Postgres can't use a value added in the same transaction.

-- CreateEnum
CREATE TYPE "PlanDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- AlterEnum
ALTER TYPE "CaseEventType" ADD VALUE 'PLAN_CREATED';

-- AlterEnum
ALTER TYPE "CaseFileKind" ADD VALUE 'PLAN_3D';
