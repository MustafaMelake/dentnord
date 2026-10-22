import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allowedTransitions,
  CASE_STATUSES,
  checkPlanDecision,
  checkTransition,
  decidablePlan,
  parseTransitionInput,
  TRANSITION_IDS,
  transitionRule,
  waitingOn,
  type Actor,
  type CaseStatusValue,
  type TransitionId,
} from "../../src/lib/case-workflow-rules";

// The full matrix, written out independently of the rule table: every (status, actor) pair lists
// exactly the transitions it may run. Anything not listed must be refused.
const EXPECTED: Record<CaseStatusValue, Partial<Record<Actor, TransitionId[]>>> = {
  DRAFT: { DENTIST: ["submit"] },
  SUBMITTED: {
    ADMIN: ["requestFiles", "startPlanning", "cancelByAdmin"],
    DENTIST: ["cancelByDentist"],
  },
  NEEDS_FILES: { DENTIST: ["resubmit", "cancelByDentist"], ADMIN: ["cancelByAdmin"] },
  IN_PLANNING: { ADMIN: ["sendPlan", "cancelByAdmin"] },
  AWAITING_APPROVAL: { DENTIST: ["approvePlan", "requestChanges"], ADMIN: ["cancelByAdmin"] },
  CHANGES_REQUESTED: { ADMIN: ["startPlanning", "cancelByAdmin"] },
  APPROVED: { ADMIN: ["startProduction", "cancelByAdmin"] },
  IN_PRODUCTION: { ADMIN: ["ship", "cancelByAdmin"] },
  SHIPPED: { ADMIN: ["confirmDelivery", "cancelByAdmin"], DENTIST: ["confirmDelivery"] },
  DELIVERED: {},
  CANCELLED: {},
};

const TARGET: Record<TransitionId, CaseStatusValue> = {
  submit: "SUBMITTED",
  requestFiles: "NEEDS_FILES",
  resubmit: "SUBMITTED",
  startPlanning: "IN_PLANNING",
  sendPlan: "AWAITING_APPROVAL",
  approvePlan: "APPROVED",
  requestChanges: "CHANGES_REQUESTED",
  startProduction: "IN_PRODUCTION",
  ship: "SHIPPED",
  confirmDelivery: "DELIVERED",
  cancelByDentist: "CANCELLED",
  cancelByAdmin: "CANCELLED",
};

const ACTORS: Actor[] = ["ADMIN", "DENTIST"];

describe("case state machine", () => {
  it("allows exactly the expected transitions for every status, actor and transition", () => {
    let checked = 0;
    for (const status of CASE_STATUSES) {
      for (const actor of ACTORS) {
        const expected = new Set(EXPECTED[status][actor] ?? []);
        for (const id of TRANSITION_IDS) {
          const result = checkTransition(id, status, actor);
          assert.equal(
            result.ok,
            expected.has(id),
            `${actor} ${id} from ${status}: expected ${expected.has(id) ? "allowed" : "refused"}`,
          );
          checked++;
        }
        assert.deepEqual(
          allowedTransitions(status, actor)
            .map((t) => t.id)
            .sort(),
          [...expected].sort(),
          `${actor} in ${status}`,
        );
      }
    }
    assert.equal(checked, CASE_STATUSES.length * ACTORS.length * TRANSITION_IDS.length);
  });

  it("every transition leads where the spec says", () => {
    for (const id of TRANSITION_IDS) assert.equal(transitionRule(id).to, TARGET[id], id);
  });

  it("a wrong role is 'forbidden', a wrong state is 'wrongState'", () => {
    // The dentist can never run admin transitions, in any state.
    for (const id of [
      "requestFiles",
      "startPlanning",
      "sendPlan",
      "startProduction",
      "ship",
      "cancelByAdmin",
    ] as const) {
      for (const status of CASE_STATUSES) {
        const r = checkTransition(id, status, "DENTIST");
        assert.deepEqual(r, { ok: false, reason: "forbidden" }, `${id} from ${status}`);
      }
    }
    // The admin can never decide on a plan, resubmit, submit or cancel as the dentist.
    for (const id of [
      "approvePlan",
      "requestChanges",
      "resubmit",
      "submit",
      "cancelByDentist",
    ] as const) {
      for (const status of CASE_STATUSES) {
        assert.deepEqual(checkTransition(id, status, "ADMIN"), { ok: false, reason: "forbidden" });
      }
    }
    assert.deepEqual(checkTransition("approvePlan", "IN_PLANNING", "DENTIST"), {
      ok: false,
      reason: "wrongState",
    });
    assert.deepEqual(checkTransition("nope", "SUBMITTED", "ADMIN"), {
      ok: false,
      reason: "unknown",
    });
  });

  it("final states have no way out, and drafts can't be cancelled through the workflow", () => {
    for (const status of ["DELIVERED", "CANCELLED"] as const) {
      for (const actor of ACTORS) assert.deepEqual(allowedTransitions(status, actor), []);
    }
    assert.equal(checkTransition("cancelByAdmin", "DRAFT", "ADMIN").ok, false);
    assert.equal(checkTransition("cancelByDentist", "DRAFT", "DENTIST").ok, false);
  });

  it("the dentist may cancel only while SUBMITTED or NEEDS_FILES", () => {
    const ok = CASE_STATUSES.filter((s) => checkTransition("cancelByDentist", s, "DENTIST").ok);
    assert.deepEqual(ok, ["SUBMITTED", "NEEDS_FILES"]);
  });

  it("knows whose turn it is", () => {
    assert.equal(waitingOn("NEEDS_FILES"), "DENTIST");
    assert.equal(waitingOn("AWAITING_APPROVAL"), "DENTIST");
    assert.equal(waitingOn("SHIPPED"), "DENTIST");
    assert.equal(waitingOn("SUBMITTED"), "ADMIN");
    assert.equal(waitingOn("CHANGES_REQUESTED"), "ADMIN");
    assert.equal(waitingOn("DELIVERED"), null);
    assert.equal(waitingOn("CANCELLED"), null);
  });
});

describe("transition input", () => {
  const parse = (id: TransitionId, input: unknown) =>
    parseTransitionInput(transitionRule(id), input);

  it("NEEDS_FILES needs a message saying what's missing", () => {
    assert.equal(parse("requestFiles", {}).ok, false);
    assert.equal(parse("requestFiles", { message: "   " }).ok, false);
    assert.deepEqual(parse("requestFiles", { message: " Please add the lower scan. " }), {
      ok: true,
      data: { message: "Please add the lower scan." },
    });
    assert.equal(parse("requestFiles", { message: "x".repeat(2001) }).ok, false);
  });

  it("the admin's cancel needs a reason; the dentist's reason is optional", () => {
    assert.equal(parse("cancelByAdmin", {}).ok, false);
    assert.equal(parse("cancelByAdmin", { reason: "Duplicate case" }).ok, true);
    assert.deepEqual(parse("cancelByDentist", {}), { ok: true, data: {} });
    assert.deepEqual(parse("cancelByDentist", { reason: "Patient moved" }), {
      ok: true,
      data: { reason: "Patient moved" },
    });
  });

  it("requesting changes needs a comment; approving needs the checkbox", () => {
    assert.equal(parse("requestChanges", { comment: "" }).ok, false);
    assert.equal(parse("requestChanges", { comment: "Move 36 distally" }).ok, true);
    assert.equal(parse("approvePlan", {}).ok, false);
    assert.equal(parse("approvePlan", { consent: "true" }).ok, false);
    assert.equal(parse("approvePlan", { consent: true }).ok, true);
  });

  it("shipping needs a carrier and tracking number; the link must be http(s)", () => {
    assert.equal(parse("ship", { carrier: "PostNord" }).ok, false);
    assert.equal(parse("ship", { carrier: "PostNord", trackingNumber: "00370 7231" }).ok, true);
    assert.equal(parse("ship", { carrier: "GLS", trackingNumber: "<script>" }).ok, false);
    assert.equal(
      parse("ship", { carrier: "GLS", trackingNumber: "123", trackingUrl: "javascript:alert(1)" })
        .ok,
      false,
    );
    assert.equal(
      parse("ship", {
        carrier: "GLS",
        trackingNumber: "123",
        trackingUrl: "https://gls-group.eu/track/123",
      }).ok,
      true,
    );
  });

  it("transitions without required input ignore what is sent", () => {
    assert.deepEqual(parse("startPlanning", { message: "x", role: "ADMIN" }), {
      ok: true,
      data: {},
    });
  });
});

describe("plan decisions", () => {
  const plans = [
    { id: "v1", version: 1, sentAt: "2026-10-01", decision: "CHANGES_REQUESTED" as const },
    { id: "v2", version: 2, sentAt: "2026-10-05", decision: null },
    { id: "v3", version: 3, sentAt: null, decision: null }, // being prepared
  ];

  it("only the latest SENT version can be decided, once", () => {
    assert.deepEqual(checkPlanDecision(plans, "v2"), { ok: true });
    assert.equal(decidablePlan(plans)?.id, "v2");
    assert.deepEqual(checkPlanDecision(plans, "v1"), { ok: false, reason: "alreadyDecided" });
    assert.deepEqual(checkPlanDecision(plans, "v3"), { ok: false, reason: "notSent" });
    assert.deepEqual(checkPlanDecision(plans, "other-case-plan"), { ok: false, reason: "notSent" });
  });

  it("an older undecided version can't be decided once a newer one is sent", () => {
    const stale = [
      { id: "a", version: 1, sentAt: "2026-10-01", decision: null },
      { id: "b", version: 2, sentAt: "2026-10-02", decision: null },
    ];
    assert.deepEqual(checkPlanDecision(stale, "a"), { ok: false, reason: "notLatest" });
    assert.deepEqual(checkPlanDecision(stale, "b"), { ok: true });
  });

  it("nothing is decidable once the latest version is decided", () => {
    const done = [{ id: "a", version: 1, sentAt: "2026-10-01", decision: "APPROVED" as const }];
    assert.equal(decidablePlan(done), null);
    assert.deepEqual(checkPlanDecision(done, "a"), { ok: false, reason: "alreadyDecided" });
  });
});
