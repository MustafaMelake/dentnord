import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export function formatCaseNumber(year: number, sequence: number) {
  return `DN-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Allocates the next case number (DN-2026-0001, …). Call inside the transaction that creates the Case.
 * The upsert compiles to a single INSERT … ON CONFLICT DO UPDATE, so concurrent calls never collide.
 */
export async function allocateCaseNumber(tx: Prisma.TransactionClient, now = new Date()) {
  const year = now.getUTCFullYear();
  const { lastValue } = await tx.caseNumberSequence.upsert({
    where: { year },
    create: { year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
    select: { lastValue: true },
  });
  return formatCaseNumber(year, lastValue);
}
