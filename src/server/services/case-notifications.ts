import "server-only";

import { buildCaseUpdateEmail, type CaseUpdateKind } from "@/emails/case-update";
import { emailLocale, type EmailLocale } from "@/emails/i18n";
import { env } from "@/env";
import type { TransitionId } from "@/lib/case-workflow-rules";
import { db } from "@/lib/db";
import { sendEmail, sendInBackground } from "@/lib/email";
import type { TransitionResult } from "@/server/services/case-workflow";

// Case lifecycle emails. Queued after the response (sendInBackground); a failed email never fails
// the action. Every email is recorded in EmailLog (kind, recipient, subject, case), which is also
// what throttles message emails (one per case and direction per 10 minutes) and what tests assert.
// The dentist gets theirs in their preferredLocale; the lab in the admin account's preference.

/** Which transition emails whom. */
const TRANSITION_EMAILS: Partial<
  Record<TransitionId, { to: "dentist" | "admin"; kind: CaseUpdateKind }>
> = {
  requestFiles: { to: "dentist", kind: "needsFiles" },
  sendPlan: { to: "dentist", kind: "planReady" },
  ship: { to: "dentist", kind: "shipped" },
  cancelByAdmin: { to: "dentist", kind: "cancelled" },
  resubmit: { to: "admin", kind: "resubmitted" },
  approvePlan: { to: "admin", kind: "planApproved" },
  requestChanges: { to: "admin", kind: "changesRequested" },
  cancelByDentist: { to: "admin", kind: "cancelledByDentist" },
};

export const MESSAGE_EMAIL_INTERVAL_MS = 10 * 60 * 1000;

const siteUrl = (path: string) => new URL(path, env.NEXT_PUBLIC_SITE_URL).toString();

async function recipients(caseId: string) {
  const c = await db.case.findUnique({
    where: { id: caseId },
    select: {
      caseNumber: true,
      shippingCarrier: true,
      trackingNumber: true,
      trackingUrl: true,
      dentist: { select: { email: true, name: true, clinicName: true, preferredLocale: true } },
    },
  });
  if (!c) return null;
  const admin = await db.user.findUnique({
    where: { email: env.ADMIN_EMAIL.toLowerCase() },
    select: { preferredLocale: true },
  });
  return { c, adminLocale: emailLocale(admin?.preferredLocale ?? "en") };
}

async function deliver(input: {
  kind: CaseUpdateKind;
  to: "dentist" | "admin";
  caseId: string;
  planVersion?: number;
}) {
  const r = await recipients(input.caseId);
  if (!r) return;
  const { c } = r;
  const caseNumber = c.caseNumber;
  if (!caseNumber) return;
  const dentistLocale: EmailLocale = emailLocale(c.dentist.preferredLocale);
  const locale = input.to === "dentist" ? dentistLocale : r.adminLocale;
  const email = buildCaseUpdateEmail({
    locale,
    kind: input.kind,
    caseNumber,
    caseUrl:
      input.to === "dentist"
        ? siteUrl(`/${dentistLocale}/portal/cases/${input.caseId}`)
        : siteUrl(`/admin/cases/${input.caseId}`),
    planVersion: input.planVersion,
    clinic: input.to === "admin" ? c.dentist.clinicName || c.dentist.name : undefined,
    shipping:
      input.kind === "shipped" && c.shippingCarrier && c.trackingNumber
        ? {
            carrier: c.shippingCarrier,
            trackingNumber: c.trackingNumber,
            trackingUrl: c.trackingUrl,
          }
        : undefined,
  });
  const to = input.to === "dentist" ? c.dentist.email : env.ADMIN_EMAIL;
  // Logged first: a second message a moment later then sees it and is throttled.
  await db.emailLog.create({
    data: { kind: input.kind, to, subject: email.subject, caseId: input.caseId },
  });
  await sendEmail({ to, ...email });
}

/** After a committed transition: email whoever has to act or know. */
export function notifyTransition(result: TransitionResult, actorRole: "ADMIN" | "DENTIST") {
  let target = TRANSITION_EMAILS[result.transition];
  // Delivery: whoever didn't confirm it hears about it.
  if (result.transition === "confirmDelivery") {
    target = actorRole === "DENTIST" ? { to: "admin", kind: "delivered" } : undefined;
  }
  if (!target) return;
  const { to, kind } = target;
  sendInBackground(() =>
    deliver({ kind, to, caseId: result.caseId, planVersion: result.plan?.version }),
  );
}

/**
 * A new message: email the other side, at most once per case and direction per 10 minutes (the
 * reader sees every message on the case page anyway). Internal notes never email anyone.
 */
export function notifyMessage(caseId: string, authorRole: "ADMIN" | "DENTIST") {
  const to = authorRole === "ADMIN" ? "dentist" : "admin";
  const kind: CaseUpdateKind = to === "dentist" ? "messageToDentist" : "messageToAdmin";
  sendInBackground(async () => {
    const recent = await db.emailLog.count({
      where: { caseId, kind, createdAt: { gt: new Date(Date.now() - MESSAGE_EMAIL_INTERVAL_MS) } },
    });
    if (recent) return;
    await deliver({ kind, to, caseId });
  });
}
