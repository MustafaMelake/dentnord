import { expect, test, type BrowserContext, type Page, type Request } from "@playwright/test";

import {
  cleanupE2EUsers,
  createUser,
  getCase,
  getEmailLog,
  getMessages,
  getPlans,
  getTrail,
} from "./support/db";
import { login, newUser } from "./support/helpers";
import { uploadFile as file } from "./support/uploads";

// The full case lifecycle against a production build, the dev database and the real bucket (under
// test/): dentist ↔ lab through every status, plans, 3D viewer, messages, emails (EmailLog) and
// badges; plus isolation and forged requests.

test.describe.configure({ timeout: 900_000 });

// A tiny but valid ASCII STL (one triangle), so the 3D viewer can actually parse it.
const STL = (name: string) =>
  Buffer.from(
    `solid ${name}\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 0 10 0\nendloop\nendfacet\nendsolid ${name}\n`,
  );
const PDF = Buffer.from("%PDF-1.4\n% dentnord e2e plan report\n%%EOF\n");

let dentist: ReturnType<typeof createUser>;
let other: ReturnType<typeof createUser>;
let admin: ReturnType<typeof createUser>;

test.beforeAll(() => {
  cleanupE2EUsers();
  dentist = createUser({ label: "life-a", name: "E2E Lifecycle Dentist" });
  other = createUser({ label: "life-b", name: "E2E Other Dentist" });
  admin = createUser({ label: "life-admin", role: "ADMIN", name: "E2E Lifecycle Admin" });
});

async function signIn(
  browser: Parameters<typeof newUser>[0],
  user: { email: string; password: string },
) {
  const session = await newUser(browser);
  await login(session.page, user.email, user.password);
  await expect(session.page).toHaveURL(/\/(portal|admin)\//);
  await session.page.waitForLoadState("networkidle");
  return session;
}

/** Wizard → SUBMITTED, with a CBCT zip and an upper scan. Returns the case id. */
async function submitCase(page: Page, code: string) {
  await page.goto("/en/portal/cases/new");
  await page.getByLabel("Patient code").fill(code);
  await page.locator('input[name="guideTypeId"]').first().check();
  await page.waitForURL(/\/cases\/[^/]+\/edit\?step=1/);
  const caseId = /\/cases\/([^/]+)\/edit/.exec(page.url())![1];
  await page.getByRole("button", { name: "Next" }).click();
  await page.locator('[data-tooth="36"]').click();
  const system = page.locator('select[id$=".implantSystemId"]').first();
  await system.selectOption(
    (await system.locator("optgroup option").first().getAttribute("value"))!,
  );
  await page.getByRole("button", { name: "Next" }).click();
  await file(page, "", "CBCT", "dicom.zip", Buffer.alloc(20_000, 1));
  await file(page, "", "INTRAORAL_SCAN", "upper.stl", STL("upper"));
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(/I confirm that the patient/).check();
  await page.getByRole("button", { name: "Submit case" }).click();
  await expect(page.locator("[data-case-number]")).toBeVisible({ timeout: 30_000 });
  return caseId;
}

const stepper = (page: Page, status: string) => page.locator(`[data-stepper="${status}"]`);

async function openAdminCase(page: Page, caseId: string, status: string) {
  await page.goto(`/admin/cases/${caseId}`);
  await expect(stepper(page, status)).toBeVisible();
}

/** Admin: start (next) plan version, upload the report (+ a 3D model), send it. */
async function prepareAndSendPlan(page: Page, version: number, with3d: boolean) {
  await page.locator('[data-action="startPlanVersion"]').click();
  const prep = `[data-plan-prep="${version}"]`;
  await expect(page.locator(prep)).toBeVisible();
  await file(page, prep, "PLAN_REPORT", `plan-v${version}.pdf`, PDF);
  if (with3d)
    await file(page, prep, "PLAN_3D", `implants-v${version}.stl`, STL(`implants${version}`));
  await page.locator(prep).getByRole("textbox").first().fill(`Plan v${version} på dansk`);
  await page.locator('[data-action="sendPlan"]').click();
  await expect(stepper(page, "AWAITING_APPROVAL")).toBeVisible();
}

/** Records the next Server Action POST (to replay it with forged arguments). */
function captureAction(page: Page) {
  return new Promise<{ url: string; headers: Record<string, string> }>((resolve) => {
    const onRequest = (req: Request) => {
      const headers = req.headers();
      if (req.method() === "POST" && headers["next-action"]) {
        page.off("request", onRequest);
        resolve({ url: req.url(), headers });
      }
    };
    page.on("request", onRequest);
  });
}

/** Calls a captured Server Action with other arguments; returns the raw RSC response text. */
async function forge(
  context: BrowserContext,
  action: { url: string; headers: Record<string, string> },
  args: unknown[],
) {
  const pick = ["next-action", "next-router-state-tree", "accept"];
  const headers = Object.fromEntries(
    pick.filter((h) => action.headers[h]).map((h) => [h, action.headers[h]]),
  );
  const res = await context.request.post(action.url, {
    headers: { ...headers, "content-type": "text/plain;charset=UTF-8" },
    data: JSON.stringify(args),
    failOnStatusCode: false,
  });
  return res.text();
}

test("full lifecycle: files requested → plan v1 → changes → plan v2 → approved → shipped → delivered", async ({
  browser,
}) => {
  const d = await signIn(browser, dentist);
  const caseId = await submitCase(d.page, "E2E-LIFE-1");
  const a = await signIn(browser, admin);

  // ── Lab asks for more files ──
  await openAdminCase(a.page, caseId, "SUBMITTED");
  await a.page.locator('[data-form="requestFiles"] textarea').fill("Please add the lower scan.");
  await a.page
    .locator('[data-form="requestFiles"]')
    .getByRole("button", { name: "Request files" })
    .click();
  await expect(stepper(a.page, "NEEDS_FILES")).toBeVisible();

  // ── Dentist: dashboard says so; the banner shows the lab's message; upload + resubmit ──
  await d.page.goto("/en/portal/dashboard");
  await expect(d.page.locator("[data-action-needed-list]")).toContainText(
    "Upload the missing files",
  );
  await d.page.goto(`/en/portal/cases/${caseId}`);
  await expect(d.page.locator("[data-needs-files-note]")).toHaveText("Please add the lower scan.");
  await expect(d.page.locator('[data-action="resubmit"]')).toBeDisabled();
  await file(d.page, "[data-action-needed]", "INTRAORAL_SCAN", "lower.stl", STL("lower"));
  const resubmit = captureAction(d.page);
  await d.page.locator('[data-action="resubmit"]').click();
  const transitionAction = await resubmit;
  await expect(stepper(d.page, "SUBMITTED")).toBeVisible();

  // ── Lab plans v1 and sends it ──
  await openAdminCase(a.page, caseId, "SUBMITTED");
  await a.page.locator('[data-action="startPlanning"]').click();
  await expect(stepper(a.page, "IN_PLANNING")).toBeVisible();
  await prepareAndSendPlan(a.page, 1, true);

  // ── Dentist reviews and requests changes ──
  await d.page.goto(`/en/portal/cases/${caseId}`);
  // The note was written in Danish only: the English page falls back to it.
  await expect(d.page.locator('[data-plan-version="1"]')).toContainText("Plan v1 på dansk");
  await d.page.locator("#changes-comment").fill("Move 36 one millimetre distally.");
  await d.page.locator('[data-action="requestChanges"]').click();
  await expect(stepper(d.page, "CHANGES_REQUESTED")).toBeVisible();

  // ── Lab: back to planning, v2 (not visible to the dentist until sent) ──
  await openAdminCase(a.page, caseId, "CHANGES_REQUESTED");
  await a.page.locator('[data-action="startPlanning"]').click();
  await expect(stepper(a.page, "IN_PLANNING")).toBeVisible();
  await a.page.locator('[data-action="startPlanVersion"]').click();
  await expect(a.page.locator('[data-plan-prep="2"]')).toBeVisible();
  await file(a.page, '[data-plan-prep="2"]', "PLAN_REPORT", "plan-v2.pdf", PDF);
  const unsentReport = getPlans(caseId).find((p) => p.version === 2)!.files[0].id;
  // The dentist can't see or download a plan that is still being prepared.
  await d.page.goto(`/en/portal/cases/${caseId}`);
  await expect(d.page.locator('[data-plan-version="2"]')).toHaveCount(0);
  const hidden = await d.context.request.get(`/api/uploads/files/${unsentReport}/download`, {
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  expect(hidden.status()).toBe(404);
  await a.page.locator('[data-action="sendPlan"]').click();
  await expect(stepper(a.page, "AWAITING_APPROVAL")).toBeVisible();

  // ── Dentist approves v2 (the confirmation is required) ──
  await d.page.goto(`/en/portal/cases/${caseId}`);
  await d.page.locator('[data-action="approvePlan"]').click();
  await expect(d.page.getByText("Please confirm that you have reviewed the plan.")).toBeVisible();
  await d.page.locator("[data-approve-consent]").check();
  await d.page.locator('[data-action="approvePlan"]').click();
  await expect(stepper(d.page, "APPROVED")).toBeVisible();
  await expect(d.page.locator('[data-plan-version="2"] [data-decision="APPROVED"]')).toBeVisible();

  // ── Lab produces and ships ──
  await openAdminCase(a.page, caseId, "APPROVED");
  await a.page.locator('[data-action="startProduction"]').click();
  await expect(stepper(a.page, "IN_PRODUCTION")).toBeVisible();
  const ship = a.page.locator('[data-form="ship"]');
  await ship.locator('input[name="carrier"]').fill("PostNord");
  await ship.locator('input[name="trackingNumber"]').fill("00370 72311 23456");
  await ship
    .locator('input[name="trackingUrl"]')
    .fill("https://tracking.postnord.com/dk/?id=0037072311");
  await ship.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(stepper(a.page, "SHIPPED")).toBeVisible();

  // ── Dentist confirms delivery ──
  await d.page.goto(`/en/portal/cases/${caseId}`);
  await expect(d.page.locator("[data-tracking]")).toHaveText("00370 72311 23456");
  await expect(d.page.getByRole("link", { name: "Track the parcel" })).toHaveAttribute(
    "href",
    "https://tracking.postnord.com/dk/?id=0037072311",
  );
  await d.page.locator('[data-action="confirmDelivery"]').click();
  await expect(stepper(d.page, "DELIVERED")).toBeVisible();

  // ── Messages: badge for the dentist, one email per 10 minutes ──
  await openAdminCase(a.page, caseId, "DELIVERED");
  const thread = a.page.locator('[data-thread="case"]');
  for (const text of ["Thanks, good luck with the surgery!", "PS: the invoice follows."]) {
    await thread.locator("textarea").fill(text);
    await thread.getByRole("button", { name: "Send" }).click();
    await expect(thread.locator("[data-message]").getByText(text)).toBeVisible();
  }
  await d.page.goto("/en/portal/cases");
  await expect(d.page.locator('[data-nav-badge="unread"]').first()).toContainText("2");
  await expect(d.page.locator(`[data-case-row] [data-unread="2"]`)).toBeVisible();
  await d.page.goto(`/en/portal/cases/${caseId}`);
  await expect(
    d.page
      .locator('[data-thread="case"]')
      .locator("[data-message]")
      .getByText("PS: the invoice follows."),
  ).toBeVisible();
  // Opening the thread marks the lab's messages as read (a request the page sends after loading).
  await expect
    .poll(() => getMessages(caseId).filter((m) => m.authorRole === "ADMIN" && !m.readAt).length)
    .toBe(0);
  await d.page.goto("/en/portal/dashboard");
  await expect(d.page.locator('[data-nav-badge="unread"]')).toHaveCount(0);
  // The dentist answers: the admin's sidebar shows it.
  await d.page.goto(`/en/portal/cases/${caseId}`);
  await d.page.locator('[data-thread="case"] textarea').fill("Arrived, thank you.");
  await d.page.locator('[data-thread="case"]').getByRole("button", { name: "Send" }).click();
  await expect(
    d.page.locator('[data-thread="case"] [data-message]').getByText("Arrived, thank you."),
  ).toBeVisible();
  await a.page.goto("/admin/cases");
  await expect(a.page.locator('[data-nav-badge="outline"]').first()).toContainText("1");

  // ── The record ──
  const c = getCase(caseId)!;
  expect(c.status).toBe("DELIVERED");
  expect(getTrail(caseId).map((e) => `${e.fromStatus}>${e.toStatus}`)).toEqual([
    "DRAFT>SUBMITTED",
    "SUBMITTED>NEEDS_FILES",
    "NEEDS_FILES>SUBMITTED",
    "SUBMITTED>IN_PLANNING",
    "IN_PLANNING>AWAITING_APPROVAL",
    "AWAITING_APPROVAL>CHANGES_REQUESTED",
    "CHANGES_REQUESTED>IN_PLANNING",
    "IN_PLANNING>AWAITING_APPROVAL",
    "AWAITING_APPROVAL>APPROVED",
    "APPROVED>IN_PRODUCTION",
    "IN_PRODUCTION>SHIPPED",
    "SHIPPED>DELIVERED",
  ]);
  expect(getTrail(caseId)[1].note).toBe("Please add the lower scan.");
  const plans = getPlans(caseId);
  expect(plans.map((p) => [p.version, p.sent, p.decision])).toEqual([
    [1, true, "CHANGES_REQUESTED"],
    [2, true, "APPROVED"],
  ]);
  expect(plans[0].decisionComment).toBe("Move 36 one millimetre distally.");
  expect(plans[1].approvalStatement).toBe(
    "I have reviewed the implant positions, sizes and guide design in this plan and approve it for production.",
  );
  expect(plans[1].approvalLocale).toBe("en");

  // Emails (logged, Resend isn't configured): who got what. Two messages → one email.
  await expect
    .poll(() => getEmailLog(caseId).map((e) => e.kind))
    .toEqual([
      "needsFiles",
      "resubmitted",
      "planReady",
      "changesRequested",
      "planReady",
      "planApproved",
      "shipped",
      "delivered",
      "messageToDentist",
      "messageToAdmin",
    ]);
  const toDentist = ["needsFiles", "planReady", "shipped", "messageToDentist"];
  for (const e of getEmailLog(caseId)) {
    if (toDentist.includes(e.kind)) expect(e.to, e.kind).toBe(dentist.email);
    else expect(e.to, e.kind).not.toBe(dentist.email); // the lab's address
  }

  // ── Forged requests by the dentist on their own case ──
  // An admin transition:
  expect(
    await forge(d.context, transitionAction, [
      {
        locale: "en",
        caseId,
        transition: "startProduction",
        expectedStatus: "DELIVERED",
        input: {},
      },
    ]),
  ).toContain('"error":"forbidden"');
  // Approving the old version (v1 was decided, and v2 is the latest):
  expect(
    await forge(d.context, transitionAction, [
      {
        locale: "en",
        caseId,
        transition: "approvePlan",
        expectedStatus: "DELIVERED",
        input: { consent: true },
        planId: plans[0].id,
      },
    ]),
  ).toMatch(/"error":"(wrongState|stale|planAlreadyDecided|notLatestPlan)"/);
  // Nothing changed.
  expect(getCase(caseId)!.status).toBe("DELIVERED");
  expect(getPlans(caseId).map((p) => p.decision)).toEqual(["CHANGES_REQUESTED", "APPROVED"]);
});

test("isolation: another dentist, internal notes, admin-only transitions, stale requests", async ({
  browser,
}) => {
  const d = await signIn(browser, dentist);
  const caseId = await submitCase(d.page, "E2E-ISO-1");
  const a = await signIn(browser, admin);

  // Admin writes an internal note and a normal message.
  await openAdminCase(a.page, caseId, "SUBMITTED");
  const internal = a.page.locator('[data-thread="internal"]');
  await internal.locator("textarea").fill("INTERNAL-ONLY-7c41: check the CBCT slice spacing");
  await internal.getByRole("button", { name: "Send" }).click();
  await expect(
    internal
      .locator("[data-message]")
      .getByText("INTERNAL-ONLY-7c41: check the CBCT slice spacing"),
  ).toBeVisible();
  await a.page.locator('[data-thread="case"] textarea').fill("Hello from the lab");
  await a.page.locator('[data-thread="case"]').getByRole("button", { name: "Send" }).click();
  await expect(
    a.page
      .locator('[data-thread="case"]')
      .locator("[data-message]")
      .getByText("Hello from the lab"),
  ).toBeVisible();

  // The dentist sees the message, never the internal note (not in the page, not in the payload).
  await d.page.goto(`/en/portal/cases/${caseId}`);
  await expect(
    d.page
      .locator('[data-thread="case"]')
      .locator("[data-message]")
      .getByText("Hello from the lab"),
  ).toBeVisible();
  await expect(d.page.locator('[data-thread="internal"]')).toHaveCount(0);
  expect(await d.page.content()).not.toContain("INTERNAL-ONLY-7c41");
  const raw = await d.context.request.get(`/en/portal/cases/${caseId}`, { headers: { RSC: "1" } });
  expect(await raw.text()).not.toContain("INTERNAL-ONLY-7c41");

  // Capture the dentist's message and transition actions, then forge.
  const messageAction = captureAction(d.page);
  await d.page.locator('[data-thread="case"] textarea').fill("Thanks!");
  await d.page.locator('[data-thread="case"]').getByRole("button", { name: "Send" }).click();
  const sendMessage = await messageAction;
  // Writing an internal note as the dentist: refused as if internal notes didn't exist.
  expect(
    await forge(d.context, sendMessage, [{ caseId, body: "sneaky", internal: true }]),
  ).toContain('"error":"notFound"');
  // The admin moves the case on…
  await openAdminCase(a.page, caseId, "SUBMITTED");
  await a.page.locator('[data-action="startPlanning"]').click();
  await expect(stepper(a.page, "IN_PLANNING")).toBeVisible();
  // …while the dentist's page still shows SUBMITTED: cancelling now is refused as stale.
  const cancelAction = captureAction(d.page);
  await d.page.locator('[data-action="cancelByDentist"]').click();
  await d.page.getByRole("alertdialog").getByRole("button", { name: "Cancel case" }).click();
  const transitionAction = await cancelAction;
  await expect(
    d.page.getByText("This case was updated in the meantime. Please refresh to see the latest."),
  ).toBeVisible();
  expect(getCase(caseId)!.status).toBe("IN_PLANNING");
  // The dentist can't run admin transitions, even with the right expected status.
  expect(
    await forge(d.context, transitionAction, [
      { locale: "en", caseId, transition: "sendPlan", expectedStatus: "IN_PLANNING", input: {} },
    ]),
  ).toContain('"error":"forbidden"');
  expect(
    await forge(d.context, transitionAction, [
      {
        locale: "en",
        caseId,
        transition: "cancelByAdmin",
        expectedStatus: "IN_PLANNING",
        input: { reason: "x" },
      },
    ]),
  ).toContain('"error":"forbidden"');

  // Another dentist: the case doesn't exist for them, through any door.
  const b = await signIn(browser, other);
  await b.page.goto(`/en/portal/cases/${caseId}`);
  await expect(b.page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  for (const transition of ["cancelByDentist", "resubmit", "approvePlan", "confirmDelivery"]) {
    expect(
      await forge(b.context, transitionAction, [
        {
          locale: "en",
          caseId,
          transition,
          expectedStatus: "IN_PLANNING",
          input: { consent: true },
        },
      ]),
    ).toContain('"error":"notFound"');
  }
  expect(await forge(b.context, sendMessage, [{ caseId, body: "hi" }])).toContain(
    '"error":"notFound"',
  );
  const fileId = (await d.page.locator("[data-download]").first().getAttribute("data-download"))!;
  for (const path of [
    `/api/uploads/files/${fileId}/download`,
    `/api/uploads/files/${fileId}/view`,
  ]) {
    const res = await b.context.request.get(path, { maxRedirects: 0, failOnStatusCode: false });
    expect(res.status(), path).toBe(404);
  }
  expect(getCase(caseId)!.status).toBe("IN_PLANNING");
});

test("the dentist reviews the plan in the 3D viewer (needs GET in the bucket's CORS rule)", async ({
  browser,
}) => {
  const d = await signIn(browser, dentist);
  const caseId = await submitCase(d.page, "E2E-3D-1");
  const a = await signIn(browser, admin);
  await openAdminCase(a.page, caseId, "SUBMITTED");
  await a.page.locator('[data-action="startPlanning"]').click();
  await expect(stepper(a.page, "IN_PLANNING")).toBeVisible();
  await prepareAndSendPlan(a.page, 1, true);

  await d.page.goto(`/en/portal/cases/${caseId}`);
  const viewer = d.page.locator("[data-viewer]");
  await viewer.scrollIntoViewIfNeeded();
  // AWAITING_APPROVAL: the plan's model and the scans open by default and load from R2.
  const layers = viewer.locator("[data-layer]");
  await expect(layers).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    await expect(layers.nth(i)).toHaveAttribute("data-layer-state", "ready", { timeout: 60_000 });
  }
  await expect(viewer.locator("canvas")).toBeVisible();
  await expect(viewer.getByText("CBCT can't be previewed in the browser")).toBeVisible();
  // Hide one layer, change the other's opacity: the controls respond.
  await layers.first().getByRole("button", { name: /^Hide/ }).click();
  await expect(layers.first().getByRole("button", { name: /^Show/ })).toBeVisible();
  await layers.nth(1).getByRole("slider").fill("0.5");
  await viewer.getByRole("button", { name: "Fit" }).click();
});
