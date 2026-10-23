"use server";

import { refresh } from "next/cache";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { CASE_STATUSES, TRANSITION_IDS, type Actor } from "@/lib/case-workflow-rules";
import { getSession } from "@/server/queries/session";
import {
  deleteMessage,
  editMessage,
  markRead,
  MessageError,
  sendMessage,
} from "@/server/services/case-messages";
import { notifyMessage, notifyTransition } from "@/server/services/case-notifications";
import { PlanError, savePlanNote, startPlanVersion } from "@/server/services/case-plans";
import { runTransition, WorkflowError } from "@/server/services/case-workflow";
import { CaseError } from "@/server/services/cases";

// Case lifecycle actions for both sides. The actor (role + id) always comes from the DB-checked
// session, never from the client; what that actor may do is decided by the workflow
// (case-workflow.ts), the message service and the plan service. Order: session → zod → service.

export type LifecycleResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

async function currentActor(): Promise<{ id: string; role: Actor } | null> {
  const session = await getSession();
  if (!session) return null;
  const { role, dentistStatus } = session.user as { role: string; dentistStatus: string };
  if (role === "ADMIN") return { id: session.user.id, role: "ADMIN" };
  if (role === "DENTIST" && dentistStatus === "APPROVED")
    return { id: session.user.id, role: "DENTIST" };
  return null;
}

async function run<T>(
  fn: (actor: { id: string; role: Actor }) => Promise<T>,
  allowed: Actor[] = ["ADMIN", "DENTIST"],
): Promise<LifecycleResult<T>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "unauthorized" };
  if (!allowed.includes(actor.role)) return { ok: false, error: "forbidden" };
  try {
    return { ok: true, data: await fn(actor) };
  } catch (error) {
    if (
      error instanceof WorkflowError ||
      error instanceof MessageError ||
      error instanceof CaseError
    ) {
      return { ok: false, error: error.code, fieldErrors: error.fieldErrors };
    }
    if (error instanceof PlanError) return { ok: false, error: error.code };
    if (error instanceof z.ZodError) return { ok: false, error: "invalid" };
    throw error;
  }
}

const transitionSchema = z.object({
  locale: z.string(),
  caseId: id,
  transition: z.enum(TRANSITION_IDS),
  expectedStatus: z.enum(CASE_STATUSES),
  input: z.record(z.string(), z.unknown()).optional(),
  planId: id.optional(),
});

/**
 * Any status change, from either side. Submit has its own action (the wizard); everything else
 * comes through here and is checked by the workflow against the session's role.
 */
export async function transitionCaseAction(raw: z.input<typeof transitionSchema>) {
  return run(async (actor) => {
    const input = transitionSchema.parse(raw);
    if (input.transition === "submit") throw new WorkflowError("forbidden");
    const locale = hasLocale(routing.locales, input.locale) ? input.locale : routing.defaultLocale;
    // Approving: store the exact statement the dentist confirmed, in the language they saw it.
    const approval =
      input.transition === "approvePlan"
        ? {
            statement: (await getTranslations({ locale, namespace: "cases.plans" }))(
              "approveStatement",
            ),
            locale,
          }
        : undefined;
    const result = await runTransition(actor, {
      caseId: input.caseId,
      transition: input.transition,
      expectedStatus: input.expectedStatus,
      input: input.input ?? {},
      planId: input.planId,
      approval,
    });
    notifyTransition(result, actor.role);
    refresh();
    return { status: result.to };
  });
}

/** Admin: start (or reopen) the plan version being prepared. */
export async function startPlanVersionAction(raw: { caseId: string }) {
  return run(
    async (actor) => {
      const plan = await startPlanVersion(actor.id, id.parse(raw.caseId));
      refresh();
      return plan;
    },
    ["ADMIN"],
  );
}

const noteSchema = z.object({
  planId: id,
  note: z.object({
    da: z.string().trim().max(2000, { error: "tooLong" }),
    en: z.string().trim().max(2000, { error: "tooLong" }),
  }),
});

/** Admin: the note for the dentist on the plan being prepared. */
export async function savePlanNoteAction(raw: z.input<typeof noteSchema>) {
  return run(async () => {
    const input = noteSchema.parse(raw);
    await savePlanNote(input.planId, input.note);
    return undefined;
  }, ["ADMIN"]);
}

/** Either side: a message on the case thread; the admin also writes internal notes. */
export async function sendMessageAction(raw: {
  caseId: string;
  body: unknown;
  internal?: boolean;
}) {
  return run(async (actor) => {
    const caseId = id.parse(raw.caseId);
    const internal = raw.internal === true;
    const message = await sendMessage(actor, { caseId, body: raw.body, internal });
    if (!message.internal) notifyMessage(caseId, actor.role);
    refresh();
    return { id: message.id };
  });
}

export async function editMessageAction(raw: { messageId: string; body: unknown }) {
  return run(async (actor) => {
    await editMessage(actor, { messageId: id.parse(raw.messageId), body: raw.body });
    refresh();
    return undefined;
  });
}

export async function deleteMessageAction(raw: { messageId: string }) {
  return run(async (actor) => {
    await deleteMessage(actor, id.parse(raw.messageId));
    refresh();
    return undefined;
  });
}

/** Called when the case thread is on screen. No refresh: the badge updates on the next navigation. */
export async function markMessagesReadAction(raw: { caseId: string }) {
  return run(async (actor) => {
    await markRead(actor, id.parse(raw.caseId));
    return undefined;
  });
}
