// The case state machine: every allowed status change, who may trigger it and what it needs.
// Pure (no DB): the server (server/services/case-workflow.ts, the ONLY code that changes
// Case.status) enforces it, the UI reads it to show only the actions allowed right now, and the
// unit tests check the full matrix.

import { z } from "zod";

export const CASE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "NEEDS_FILES",
  "IN_PLANNING",
  "AWAITING_APPROVAL",
  "CHANGES_REQUESTED",
  "APPROVED",
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type CaseStatusValue = (typeof CASE_STATUSES)[number];

export type Actor = "ADMIN" | "DENTIST";

export const FINAL_STATUSES = ["DELIVERED", "CANCELLED"] as const satisfies CaseStatusValue[];
export const isFinal = (s: CaseStatusValue) => (FINAL_STATUSES as readonly string[]).includes(s);

/** What a transition needs from the person triggering it (validated by `transitionInput`). */
export type Requirement = "message" | "reason" | "comment" | "consent" | "tracking";

/**
 * Preconditions the server checks against the database (not input):
 * - newFiles: the dentist added at least one COMPLETE file since the case entered NEEDS_FILES
 * - noPendingUploads: nothing is still uploading
 * - preparedPlan: an unsent plan version with a finished PLAN_REPORT (pdf)
 * - latestPlan: the decision is about the latest sent plan, which has no decision yet
 * - requiredFiles / validCase: the draft is complete (submit)
 */
export type Precondition =
  "newFiles" | "noPendingUploads" | "preparedPlan" | "latestPlan" | "requiredFiles" | "validCase";

export type TransitionRule = {
  id: TransitionId;
  from: readonly CaseStatusValue[];
  to: CaseStatusValue;
  actors: readonly Actor[];
  requires: readonly Requirement[];
  preconditions: readonly Precondition[];
};

export const TRANSITION_IDS = [
  "submit",
  "requestFiles",
  "resubmit",
  "startPlanning",
  "sendPlan",
  "approvePlan",
  "requestChanges",
  "startProduction",
  "ship",
  "confirmDelivery",
  "cancelByDentist",
  "cancelByAdmin",
] as const;
export type TransitionId = (typeof TRANSITION_IDS)[number];

const NON_FINAL_SUBMITTED: CaseStatusValue[] = CASE_STATUSES.filter(
  (s) => s !== "DRAFT" && !isFinal(s),
);

export const TRANSITIONS: readonly TransitionRule[] = [
  {
    id: "submit",
    from: ["DRAFT"],
    to: "SUBMITTED",
    actors: ["DENTIST"],
    requires: ["consent"],
    preconditions: ["validCase", "requiredFiles", "noPendingUploads"],
  },
  {
    id: "requestFiles",
    from: ["SUBMITTED"],
    to: "NEEDS_FILES",
    actors: ["ADMIN"],
    requires: ["message"],
    preconditions: [],
  },
  {
    id: "resubmit",
    from: ["NEEDS_FILES"],
    to: "SUBMITTED",
    actors: ["DENTIST"],
    requires: [],
    preconditions: ["newFiles", "noPendingUploads"],
  },
  {
    id: "startPlanning",
    from: ["SUBMITTED", "CHANGES_REQUESTED"],
    to: "IN_PLANNING",
    actors: ["ADMIN"],
    requires: [],
    preconditions: [],
  },
  {
    id: "sendPlan",
    from: ["IN_PLANNING"],
    to: "AWAITING_APPROVAL",
    actors: ["ADMIN"],
    requires: [],
    preconditions: ["preparedPlan", "noPendingUploads"],
  },
  {
    id: "approvePlan",
    from: ["AWAITING_APPROVAL"],
    to: "APPROVED",
    actors: ["DENTIST"],
    requires: ["consent"],
    preconditions: ["latestPlan"],
  },
  {
    id: "requestChanges",
    from: ["AWAITING_APPROVAL"],
    to: "CHANGES_REQUESTED",
    actors: ["DENTIST"],
    requires: ["comment"],
    preconditions: ["latestPlan"],
  },
  {
    id: "startProduction",
    from: ["APPROVED"],
    to: "IN_PRODUCTION",
    actors: ["ADMIN"],
    requires: [],
    preconditions: [],
  },
  {
    id: "ship",
    from: ["IN_PRODUCTION"],
    to: "SHIPPED",
    actors: ["ADMIN"],
    requires: ["tracking"],
    preconditions: [],
  },
  {
    id: "confirmDelivery",
    from: ["SHIPPED"],
    to: "DELIVERED",
    actors: ["DENTIST", "ADMIN"],
    requires: [],
    preconditions: [],
  },
  {
    id: "cancelByDentist",
    from: ["SUBMITTED", "NEEDS_FILES"],
    to: "CANCELLED",
    actors: ["DENTIST"],
    requires: [],
    preconditions: [],
  },
  {
    id: "cancelByAdmin",
    from: NON_FINAL_SUBMITTED,
    to: "CANCELLED",
    actors: ["ADMIN"],
    requires: ["reason"],
    preconditions: [],
  },
];

const byId = new Map(TRANSITIONS.map((t) => [t.id, t]));
export const transitionRule = (id: TransitionId) => byId.get(id)!;

export type TransitionCheck =
  | { ok: true; rule: TransitionRule }
  | { ok: false; reason: "unknown" | "forbidden" | "wrongState" };

/**
 * May `actor` run transition `id` while the case is `status`? "forbidden" = this role may never do
 * it; "wrongState" = not from this status (or the case moved on: the request is stale).
 */
export function checkTransition(
  id: string,
  status: CaseStatusValue,
  actor: Actor,
): TransitionCheck {
  const rule = byId.get(id as TransitionId);
  if (!rule) return { ok: false, reason: "unknown" };
  if (!rule.actors.includes(actor)) return { ok: false, reason: "forbidden" };
  if (!rule.from.includes(status)) return { ok: false, reason: "wrongState" };
  return { ok: true, rule };
}

/** The transitions `actor` may run now (the admin action panel, the dentist's "action needed"). */
export function allowedTransitions(status: CaseStatusValue, actor: Actor) {
  return TRANSITIONS.filter((t) => t.actors.includes(actor) && t.from.includes(status));
}

/** Whose turn it is: drives "waiting on us / waiting on dentist" and the dentist's action banner. */
export function waitingOn(status: CaseStatusValue): Actor | null {
  switch (status) {
    case "SUBMITTED":
    case "IN_PLANNING":
    case "CHANGES_REQUESTED":
    case "APPROVED":
    case "IN_PRODUCTION":
      return "ADMIN";
    case "DRAFT":
    case "NEEDS_FILES":
    case "AWAITING_APPROVAL":
    case "SHIPPED":
      return "DENTIST";
    default:
      return null;
  }
}

// ── Plan decisions ───────────────────────────────────────────────────────────

export type PlanSummary = {
  id: string;
  version: number;
  sentAt: Date | string | null;
  decision: "APPROVED" | "CHANGES_REQUESTED" | null;
};

/** The plan the dentist can decide on now: the latest SENT version, if it has no decision yet. */
export function decidablePlan(plans: readonly PlanSummary[]) {
  const sent = plans.filter((p) => p.sentAt !== null).sort((a, b) => b.version - a.version);
  const latest = sent[0];
  return latest && latest.decision === null ? latest : null;
}

/**
 * May the dentist decide on `planId`? Only the latest sent version, and only once.
 * "notSent" covers versions still being prepared (and ids of other cases' plans: not in the list).
 */
export function checkPlanDecision(
  plans: readonly PlanSummary[],
  planId: string,
): { ok: true } | { ok: false; reason: "notSent" | "notLatest" | "alreadyDecided" } {
  const plan = plans.find((p) => p.id === planId);
  if (!plan || plan.sentAt === null) return { ok: false, reason: "notSent" };
  if (plan.decision !== null) return { ok: false, reason: "alreadyDecided" };
  const latest = decidablePlan(plans);
  if (!latest || latest.id !== plan.id) return { ok: false, reason: "notLatest" };
  return { ok: true };
}

// ── Input per transition ─────────────────────────────────────────────────────

const text = (max: number) => z.string().trim().max(max, { error: "tooLong" });
const required = (max: number) => text(max).min(1, { error: "required" });

/** http(s) only: a tracking link must never be javascript: or similar. */
const trackingUrl = z
  .string()
  .trim()
  .max(500, { error: "tooLong" })
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), { error: "urlInvalid" });

export const transitionInputSchemas = {
  message: z.object({ message: required(2000) }),
  reason: z.object({ reason: required(1000) }),
  comment: z.object({ comment: required(2000) }),
  consent: z.object({ consent: z.literal(true, { error: "consentRequired" }) }),
  tracking: z.object({
    carrier: required(80),
    trackingNumber: required(80).regex(/^[A-Za-z0-9 ._/-]+$/, { error: "trackingInvalid" }),
    trackingUrl: trackingUrl.optional(),
  }),
} satisfies Record<Requirement, z.ZodType>;

export type TransitionInput = {
  message?: string;
  reason?: string;
  comment?: string;
  consent?: boolean;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
};

/** Validates exactly the fields this transition needs; returns them cleaned, or field errors. */
export function parseTransitionInput(rule: TransitionRule, raw: unknown) {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: TransitionInput = {};
  const errors: Record<string, string> = {};
  for (const req of rule.requires) {
    const parsed = transitionInputSchemas[req].safeParse(input);
    if (parsed.success) Object.assign(out, parsed.data);
    else for (const i of parsed.error.issues) errors[i.path.map(String).join(".")] ??= i.message;
  }
  // Optional free text: the dentist may give a reason when cancelling.
  if (rule.id === "cancelByDentist" && typeof input.reason === "string") {
    const r = text(1000).safeParse(input.reason);
    if (r.success) out.reason = r.data;
    else errors.reason = "tooLong";
  }
  return Object.keys(errors).length
    ? ({ ok: false, errors } as const)
    : ({ ok: true, data: out } as const);
}
