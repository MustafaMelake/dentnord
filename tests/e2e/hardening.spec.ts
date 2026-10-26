import type { Page } from "@playwright/test";

import { E2E_CRON_SECRET } from "./support/constants";
import {
  addFileRow,
  addMessage,
  addStoredFile,
  addStuckUpload,
  ageCase,
  cleanupE2EUsers,
  createDraft,
  createDrafts,
  createSubmittedCase,
  createUser,
  getAudit,
  getAuditFor,
  getCase,
  getCaseEvents,
  getCaseFiles,
  getR2Objects,
  getTwoFactorState,
  getUserTraces,
} from "./support/db";
import { login, newUser } from "./support/helpers";
import { expect, test } from "./support/test";
import { base32Decode, totp } from "./support/totp";

// Pre-launch hardening: security headers + CSP (every page, no violations), mandatory admin 2FA,
// storage limits, the storage cleanup cron job, and GDPR erasure of a dentist.

test.describe.configure({ timeout: 180_000 });

let admin: ReturnType<typeof createUser>;
let dentist: ReturnType<typeof createUser>;

test.beforeAll(() => {
  cleanupE2EUsers();
  admin = createUser({ label: "hardening-admin", role: "ADMIN", name: "E2E Hardening Admin" });
  dentist = createUser({ label: "hardening", name: "E2E Hardening Dentist" });
});

test.afterAll(() => cleanupE2EUsers());

const CSP_HEADER =
  process.env.CSP_REPORT_ONLY === "1"
    ? "content-security-policy-report-only"
    : "content-security-policy";

/** Loads a page, scrolls to the end (lazy images, the 3D viewer) and lets it settle. */
async function visit(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBeLessThan(400);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

test("every response carries the security headers", async ({ request }) => {
  for (const path of ["/en", "/da/services", "/en/login", "/admin", "/api/cron/storage-cleanup"]) {
    const res = await request.get(path, { maxRedirects: 0, failOnStatusCode: false });
    const h = res.headers();
    expect(h[CSP_HEADER], path).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"], path).toBe("camera=(), microphone=(), geolocation=()");
    expect(h["strict-transport-security"], path).toBe("max-age=63072000; includeSubDomains");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
  const csp = (await request.get("/en")).headers()[CSP_HEADER];
  expect(csp).toMatch(
    /connect-src 'self' blob: data: https:\/\/dentnord-cases\.[0-9a-f]{32}\.eu\.r2\.cloudflarestorage\.com/,
  );
});

test("robots.txt and sitemap.xml", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  for (const rule of ["Disallow: /admin", "Disallow: /*/portal", "Disallow: /api"]) {
    expect(robots).toContain(rule);
  }
  expect(robots).toContain("Sitemap: http://localhost:3000/sitemap.xml");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>http://localhost:3000/da/services</loc>");
  expect(sitemap).toContain('hreflang="en" href="http://localhost:3000/en/services"');
  expect(sitemap).not.toMatch(/portal|admin/);
  // The default Open Graph image, as the marketing pages announce it (its URL carries a hash).
  const html = await (await request.get("/da/services")).text();
  const ogUrl = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
  expect(ogUrl).toMatch(/^http:\/\/localhost:3000\/da\/opengraph-image/);
  const og = await request.get(ogUrl!);
  expect(og.headers()["content-type"]).toBe("image/png");
});

test("no page violates the CSP: public, auth, portal and admin (with an image upload)", async ({
  browser,
}) => {
  const visitor = await newUser(browser);
  for (const locale of ["da", "en"]) {
    for (const path of [
      "",
      "/services",
      "/portfolio",
      "/about",
      "/contact",
      "/privacy",
      "/terms",
    ]) {
      await visit(visitor.page, `/${locale}${path}`);
    }
  }
  for (const path of ["/en/login", "/en/register", "/da/forgot-password"]) {
    await visit(visitor.page, path);
  }

  // The 3D viewers' Draco decoder runs WebAssembly in a worker made from a blob: URL.
  const draco = await visitor.page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const src =
          "WebAssembly.instantiate(new Uint8Array([0,97,115,109,1,0,0,0])).then(() => postMessage('ok'), (e) => postMessage('blocked: ' + e))";
        const worker = new Worker(
          URL.createObjectURL(new Blob([src], { type: "text/javascript" })),
        );
        worker.onmessage = (event) => resolve(String(event.data));
        worker.onerror = (event) => resolve(`error: ${event.message}`);
      }),
  );
  expect(draco).toBe("ok");
  expect((await visitor.page.request.get("/draco/draco_decoder.wasm")).ok()).toBe(true);
  await visitor.context.close();

  const portal = await newUser(browser);
  await login(portal.page, dentist.email, dentist.password);
  await expect(portal.page).toHaveURL(/\/en\/portal\/dashboard$/);
  for (const path of ["/en/portal/dashboard", "/en/portal/cases", "/en/portal/cases/new"]) {
    await visit(portal.page, path);
  }
  await visit(portal.page, "/en/portal/account");
  // 2FA is optional for dentists: offered on the account page.
  await expect(
    portal.page.getByRole("link", { name: "Set up two-factor authentication" }),
  ).toBeVisible();
  await portal.context.close();

  const lab = await newUser(browser);
  await login(lab.page, admin.email, admin.password);
  await expect(lab.page).toHaveURL(/\/admin\/dashboard$/);
  for (const path of [
    "/admin/dashboard",
    "/admin/dentists",
    `/admin/dentists/${dentist.id}`,
    "/admin/cases",
    "/admin/catalog",
    "/admin/services",
    "/admin/portfolio",
    "/admin/pages",
    "/admin/messages",
    "/admin/settings",
    "/admin/account",
  ]) {
    await visit(lab.page, path);
  }

  // Admin image upload: a PUT straight to the media bucket, with a blob: preview.
  await visit(lab.page, "/admin/portfolio/new");
  await lab.page.getByRole("button", { name: "Choose image" }).first().click();
  const dialog = lab.page.getByRole("dialog");
  await dialog.getByLabel("Image file").setInputFiles({
    name: "e2e-pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await dialog.getByLabel("DA", { exact: true }).fill("E2E testbillede");
  await dialog.getByLabel("EN", { exact: true }).fill("E2E test image");
  await dialog.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(lab.page.getByText("Image uploaded.")).toBeVisible();
  await lab.context.close();
});

test("an admin sets up 2FA before /admin, then logs in with a code or a backup code", async ({
  browser,
}) => {
  const own = createUser({
    label: "admin-2fa",
    role: "ADMIN",
    name: "Tove Totp",
    twoFactor: false,
  });

  // A device that logged in with the password alone, before 2FA existed.
  const early = await newUser(browser);
  await login(early.page, own.email, own.password);
  await expect(early.page).toHaveURL(/\/en\/two-factor\?next=%2Fadmin$/);

  const main = await newUser(browser);
  const page = main.page;
  await login(page, own.email, own.password);
  await expect(page).toHaveURL(/\/en\/two-factor\?next=%2Fadmin$/);
  await expect(page.getByText(/Admin accounts are protected with two-factor/)).toBeVisible();

  // /admin and the admin's APIs stay closed until 2FA is on.
  await page.goto("/admin/dentists");
  await expect(page).toHaveURL(/\/en\/two-factor\?next=%2Fadmin%2Fdentists$/);
  const upload = await main.context.request.post("/api/uploads/multipart", {
    data: { caseId: "x", kind: "PLAN_REPORT", fileName: "plan.pdf", sizeBytes: 10 },
    failOnStatusCode: false,
  });
  expect(upload.status()).toBe(403);

  // Setup: password → QR code + key → a code from the app → backup codes.
  await page.getByLabel("Password").fill(own.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("img[data-qr]")).toBeVisible();
  const key = base32Decode(await page.locator("[data-manual-key]").innerText());
  expect(getTwoFactorState(own.email)).toEqual({ enabled: false, verified: false });

  await page.getByLabel("6-digit code").fill(totp(key, Date.now() - 10 * 60_000));
  await page.getByRole("button", { name: "Turn on two-factor authentication" }).click();
  await expect(page.getByText("That code isn't right.")).toBeVisible();
  await page.getByLabel("6-digit code").fill(totp(key));
  await page.getByRole("button", { name: "Turn on two-factor authentication" }).click();

  await expect(page.locator("[data-backup-codes] li")).toHaveCount(10);
  const codes = await page.locator("[data-backup-codes] li").allInnerTexts();
  expect(getTwoFactorState(own.email)).toEqual({ enabled: true, verified: true });
  const done = page.getByRole("button", { name: "Continue" });
  await expect(done).toBeDisabled();
  await page.getByLabel("I have saved my backup codes").check();
  await done.click();
  // Back to where the admin was headed before setup (`next`).
  await expect(page).toHaveURL(/\/admin\/dentists$/);

  // Turning 2FA on signed out the password-only session on the other device.
  await early.page.goto("/admin/dashboard");
  await expect(early.page).toHaveURL(/\/en\/login/);

  // Next login: password, then a code (a wrong one first).
  const next = await newUser(browser);
  await login(next.page, own.email, own.password);
  const step = next.page.locator('[data-step="two-factor"]');
  await expect(step).toBeVisible();
  await expect(next.page).toHaveURL(/\/en\/login$/); // no session yet
  await step.getByLabel("6-digit code").fill(totp(key, Date.now() - 10 * 60_000));
  await step.getByRole("button", { name: "Verify" }).click();
  await expect(step.getByText("That code isn't right.")).toBeVisible();
  await step.getByLabel("6-digit code").fill(totp(key));
  await step.getByRole("button", { name: "Verify" }).click();
  await expect(next.page).toHaveURL(/\/admin\/dashboard$/);

  // The account page offers new backup codes, not turning 2FA off; the endpoint refuses it too.
  await next.page.goto("/admin/account");
  await expect(next.page.getByRole("button", { name: "New backup codes" })).toBeVisible();
  await expect(next.page.getByRole("button", { name: "Turn off" })).toHaveCount(0);
  const off = await next.context.request.post("/api/auth/two-factor/disable", {
    data: { password: own.password },
    headers: { origin: "http://localhost:3000" },
    failOnStatusCode: false,
  });
  expect(off.status()).toBe(403);
  expect(((await off.json()) as { code?: string }).code).toBe("TWO_FACTOR_REQUIRED");
  expect(getTwoFactorState(own.email)?.enabled).toBe(true);

  // A backup code works, once.
  for (const expected of ["works", "used"] as const) {
    const device = await newUser(browser);
    await login(device.page, own.email, own.password);
    const s = device.page.locator('[data-step="two-factor"]');
    await s.getByRole("button", { name: "Use a backup code instead" }).click();
    await s.getByLabel("Backup code").fill(codes[0]);
    await s.getByRole("button", { name: "Verify" }).click();
    if (expected === "works") await expect(device.page).toHaveURL(/\/admin\/dashboard$/);
    else await expect(s.getByText("That code isn't right.")).toBeVisible();
    await device.context.close();
  }

  for (const c of [early, main, next]) await c.context.close();
});

test("storage limits: bytes per dentist (upload API) and open drafts (wizard)", async ({
  browser,
}) => {
  const own = createUser({ label: "quota", name: "Quinn Quota" });
  const session = await newUser(browser);
  await login(session.page, own.email, own.password);
  await expect(session.page).toHaveURL(/\/en\/portal\/dashboard$/);

  // 50 GiB per dentist: fill it to 1,000 bytes below the limit.
  const caseId = createDraft(own.email);
  addFileRow(caseId, 50 * 1024 ** 3 - 1_000);
  const register = (sizeBytes: number) =>
    session.context.request.post("/api/uploads/multipart", {
      data: { caseId, kind: "PHOTO", fileName: "photo.jpg", sizeBytes },
      failOnStatusCode: false,
    });
  const over = await register(2_000);
  expect(over.status()).toBe(413);
  expect(await over.json()).toEqual({ error: "storageQuota" });
  expect(getCaseFiles(caseId)).toHaveLength(1); // nothing registered
  expect((await register(1_000)).status()).toBe(201); // exactly at the limit is fine

  // 10 open drafts: the 10th appears while the wizard is open → its first save is refused.
  createDrafts(own.email, 8); // 9 with the one above
  const page = session.page;
  await page.goto("/en/portal/cases/new");
  await expect(page.getByLabel("Patient code")).toBeVisible();
  createDrafts(own.email, 1);
  await page.getByLabel("Patient code").fill("E2E-LIMIT-1");
  await page.locator('input[name="guideTypeId"]').first().check();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByText("You've reached the maximum number of unfinished drafts."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/en\/portal\/cases\/new$/);

  // With 10 drafts the page explains the limit instead of opening the wizard.
  await page.goto("/en/portal/cases/new");
  await expect(page.getByText("You have 10 unfinished drafts")).toBeVisible();
  await expect(page.getByLabel("Patient code")).toHaveCount(0);
  await session.context.close();
});

test("the cleanup job aborts stuck uploads and deletes idle drafts, only with CRON_SECRET", async ({
  request,
}) => {
  const own = createUser({ label: "cron", name: "Carl Cron" });
  const idle = createDraft(own.email);
  addStoredFile(idle, 70);
  ageCase(idle, 61);
  const recent = createDraft(own.email);
  ageCase(recent, 59);
  const submitted = createSubmittedCase(own.email);
  const stuck = addStuckUpload(submitted, 25);
  const running = addStuckUpload(submitted, 1);
  expect(getR2Objects(idle)).toHaveLength(1);

  const url = "/api/cron/storage-cleanup";
  expect((await request.get(url, { failOnStatusCode: false })).status()).toBe(401);
  const wrong = await request.get(url, {
    headers: { authorization: "Bearer not-the-secret-0123456789" },
    failOnStatusCode: false,
  });
  expect(wrong.status()).toBe(401);
  expect(getCase(idle)).not.toBeNull(); // untouched so far

  const res = await request.get(url, { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
  expect(res.status()).toBe(200);
  const summary = (await res.json()) as { uploadsExpired: number; draftsDeleted: number };
  expect(summary.uploadsExpired).toBeGreaterThanOrEqual(1);
  expect(summary.draftsDeleted).toBeGreaterThanOrEqual(1);

  // The idle draft is gone, files included; the audit log keeps ids and counts only.
  expect(getCase(idle)).toBeNull();
  expect(getR2Objects(idle)).toEqual([]);
  expect(getAuditFor("case", idle)).toEqual([
    {
      action: "DRAFT_EXPIRED",
      actorId: null,
      actorEmail: "system",
      metadata: { dentistId: own.id, files: 1, bytes: "2048" },
    },
  ]);
  expect(getCase(recent)).not.toBeNull();

  // The stuck upload failed with a system event; the one still running is left alone.
  const files = Object.fromEntries(getCaseFiles(submitted).map((f) => [f.id, f.uploadStatus]));
  expect(files).toEqual({ [stuck]: "FAILED", [running]: "UPLOADING" });
  expect(getCaseEvents(submitted).filter((e) => e.type === "FILE_FAILED")).toEqual([
    {
      type: "FILE_FAILED",
      actorId: null,
      metadata: { fileId: stuck, kind: "CBCT", reason: "expired" },
    },
  ]);
});

test("GDPR: the admin deletes a dentist and all their data after typing their email", async ({
  browser,
}) => {
  const own = createUser({ label: "erase", name: "Erik Erase" });
  const caseId = createSubmittedCase(own.email);
  addStoredFile(caseId);
  addMessage(caseId);
  const draftId = createDraft(own.email);
  addStoredFile(draftId);

  const them = await newUser(browser);
  await login(them.page, own.email, own.password);
  await expect(them.page).toHaveURL(/\/en\/portal\/dashboard$/);

  const lab = await newUser(browser);
  await login(lab.page, admin.email, admin.password);
  await expect(lab.page).toHaveURL(/\/admin\/dashboard$/);
  await lab.page.goto(`/admin/dentists/${own.id}`);
  await expect(lab.page.getByText(/2 cases with 2 files \(4\.0 KB\) and 1 message/)).toBeVisible();
  await lab.page.getByRole("button", { name: "Delete dentist and all data" }).click();
  const dialog = lab.page.getByRole("alertdialog");
  await expect(dialog.getByText("1 case is still in progress")).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Delete permanently" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(`Type ${own.email} to confirm`).fill("someone@example.test");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(`Type ${own.email} to confirm`).fill(own.email.toUpperCase());
  await confirm.click();
  await expect(lab.page.getByText("Erik Erase and all their data were deleted.")).toBeVisible();
  await expect(lab.page).toHaveURL(/\/admin\/dentists$/);

  // Nothing left: account, password, sessions, 2FA, cases, files (DB and R2), emails, tokens.
  expect(getUserTraces(own)).toEqual({
    users: 0,
    cases: 0,
    sessions: 0,
    accounts: 0,
    twoFactors: 0,
    emails: 0,
    verifications: 0,
  });
  expect(getCase(caseId)).toBeNull();
  expect(getR2Objects(caseId)).toEqual([]);
  expect(getR2Objects(draftId)).toEqual([]);

  // One audit entry: who deleted it, and counts. No name, email or clinic.
  const audit = getAudit(own.id);
  expect(audit).toEqual([
    {
      action: "DENTIST_DELETED",
      actorId: admin.id,
      actorEmail: admin.email,
      metadata: { cases: 2, files: 2, bytes: "4096", messages: 1 },
    },
  ]);
  expect(JSON.stringify(audit)).not.toContain(own.email);
  expect(JSON.stringify(audit)).not.toContain("Erik");

  // Their open session is gone.
  await them.page.goto("/en/portal/dashboard");
  await expect(them.page).toHaveURL(/\/en\/login/);

  await them.context.close();
  await lab.context.close();
});
