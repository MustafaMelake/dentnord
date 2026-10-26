import type { APIRequestContext, Page } from "@playwright/test";

import { cleanupE2EUsers, createUser, getCase, getCaseFiles, getR2Objects } from "./support/db";
import { login, newUser } from "./support/helpers";
import { expect, test } from "./support/test";

// Case submission against a production build and the real (EU) R2 bucket. Every object goes under
// the test/ key prefix (playwright.config.ts) and global teardown deletes everything there.

const MiB = 1024 ** 2;
const PART = 16 * MiB; // CASE_UPLOAD_PART_BYTES

test.describe.configure({ timeout: 240_000 });

let dentist: ReturnType<typeof createUser>;
let other: ReturnType<typeof createUser>;
let admin: ReturnType<typeof createUser>;

test.beforeAll(() => {
  cleanupE2EUsers();
  dentist = createUser({ label: "cases-a", name: "E2E Dentist A" });
  other = createUser({ label: "cases-b", name: "E2E Dentist B" });
  admin = createUser({ label: "cases-admin", role: "ADMIN", name: "E2E Cases Admin" });
});

const bytes = (size: number, fill = 7) => Buffer.alloc(size, fill);

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

/** Steps 1–2 of the wizard; returns the draft's id. */
async function startCase(page: Page, patientCode: string) {
  await page.goto("/en/portal/cases/new");
  await page.getByLabel("Patient code").fill(patientCode);
  await page.locator('input[name="guideTypeId"]').first().check();
  await page.waitForURL(/\/cases\/[^/]+\/edit\?step=1/);
  const caseId = /\/cases\/([^/]+)\/edit/.exec(page.url())![1];
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Implant sites", level: 2 })).toBeVisible();
  await page.locator('[data-tooth="36"]').click();
  const system = page.locator('select[id$=".implantSystemId"]').first();
  await system.selectOption(
    (await system.locator("optgroup option").first().getAttribute("value"))!,
  );
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Scans and files", level: 2 })).toBeVisible();
  return caseId;
}

async function addFile(page: Page, slot: string, name: string, size: number) {
  await page
    .locator(`[data-slot="${slot}"] input[type=file]`)
    .setInputFiles({ name, mimeType: "application/octet-stream", buffer: bytes(size) });
}

const row = (page: Page, slot: string, name: string) =>
  page.locator(`[data-slot="${slot}"] [data-file-row="${name}"]`);

async function registerViaApi(
  request: APIRequestContext,
  body: { caseId: string; kind: string; fileName: string; sizeBytes: number },
) {
  return request.post("/api/uploads/multipart", { data: body, failOnStatusCode: false });
}

test("full wizard: multipart uploads to R2, submit, history, downloads for dentist and admin", async ({
  browser,
}) => {
  const { page, context } = await signIn(browser, dentist);
  const caseId = await startCase(page, "E2E-FULL-1");

  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  // 17 MiB = two parts (16 MiB + 1 MiB): exercises the multipart path end to end.
  await addFile(page, "CBCT", "dicom-export.zip", PART + MiB);
  await addFile(page, "INTRAORAL_SCAN", "upper.stl", 300_000);
  await expect(row(page, "CBCT", "dicom-export.zip")).toHaveAttribute("data-state", "done", {
    timeout: 180_000,
  });
  await expect(row(page, "INTRAORAL_SCAN", "upper.stl")).toHaveAttribute("data-state", "done");
  // The file name said "upper": the scan part was guessed.
  await expect(row(page, "INTRAORAL_SCAN", "upper.stl").locator("select")).toHaveValue("UPPER");

  const files = getCaseFiles(caseId);
  expect(files.map((f) => [f.kind, f.uploadStatus, f.sizeBytes]).sort()).toEqual(
    [
      ["CBCT", "COMPLETE", PART + MiB],
      ["INTRAORAL_SCAN", "COMPLETE", 300_000],
    ].sort(),
  );
  for (const f of files) expect(f.storageKey).toMatch(new RegExp(`^test/cases/${caseId}/${f.id}/`));
  expect(
    getR2Objects(caseId)
      .map((o) => o.size)
      .sort((a, b) => a - b),
  ).toEqual([300_000, PART + MiB]);

  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(/I confirm that the patient/).check();
  await page.getByRole("button", { name: "Submit case" }).click();
  const caseNumber = await page.locator("[data-case-number]").textContent();
  expect(caseNumber).toMatch(/^DN-\d{4}-\d{4}$/);

  const saved = getCase(caseId)!;
  expect(saved.status).toBe("SUBMITTED");
  expect(saved.events.filter((e) => e.type === "FILE_ADDED")).toHaveLength(2);

  // Dentist download: our route checks access, then redirects to a 5-minute signed R2 URL.
  await page.goto(`/en/portal/cases/${caseId}`);
  const href = await page.locator("[data-download]").first().getAttribute("href");
  const redirect = await context.request.get(href!, { maxRedirects: 0 });
  expect(redirect.status()).toBe(303);
  const signed = redirect.headers()["location"];
  // Booleans only: a failure message must never print a signed URL.
  const onEuEndpoint = /^https:\/\/[a-z0-9-]+\.[0-9a-f]{32}\.eu\.r2\.cloudflarestorage\.com\//;
  expect(onEuEndpoint.test(signed), "signed URL is on the EU endpoint").toBe(true);
  expect(signed.includes("X-Amz-Expires=300"), "signed URL lasts 5 minutes").toBe(true);
  const download = await context.request.get(signed);
  expect(download.ok()).toBe(true);
  expect([300_000, PART + MiB]).toContain((await download.body()).length);

  // The admin can download from the submitted case, but never upload.
  const a = await signIn(browser, admin);
  expect((await a.context.request.get(href!, { maxRedirects: 0 })).status()).toBe(303);
  const adminRegister = await registerViaApi(a.context.request, {
    caseId,
    kind: "PHOTO",
    fileName: "x.jpg",
    sizeBytes: 10,
  });
  expect(adminRegister.status()).toBe(403);
});

test("a draft restores its files; files can be removed; uploads survive a dropped connection", async ({
  browser,
}) => {
  const { page, context } = await signIn(browser, dentist);
  const caseId = await startCase(page, "E2E-RESTORE-1");

  // Go offline mid-upload, then back online: the upload resumes and completes.
  await addFile(page, "CBCT", "big.zip", 3 * PART);
  const bigRow = row(page, "CBCT", "big.zip");
  await expect(bigRow.getByRole("progressbar")).toBeVisible();
  await expect
    .poll(async () => Number(await bigRow.getByRole("progressbar").getAttribute("aria-valuenow")), {
      timeout: 60_000,
    })
    .toBeGreaterThan(0);
  await context.setOffline(true);
  await page.waitForTimeout(2_000);
  await context.setOffline(false);
  await expect(bigRow).toHaveAttribute("data-state", "done", { timeout: 180_000 });

  await addFile(page, "INTRAORAL_SCAN", "scan.stl", 50_000);
  await expect(row(page, "INTRAORAL_SCAN", "scan.stl")).toHaveAttribute("data-state", "done");

  // Reload: the step and both files come back from the server.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Scans and files", level: 2 })).toBeVisible();
  await expect(row(page, "CBCT", "big.zip")).toHaveAttribute("data-state", "done");
  await expect(row(page, "INTRAORAL_SCAN", "scan.stl")).toHaveAttribute("data-state", "done");
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();

  // Mark the scan as the lower jaw; it's saved.
  await row(page, "INTRAORAL_SCAN", "scan.stl").locator("select").selectOption("LOWER");
  await expect
    .poll(() => getCaseFiles(caseId).find((f) => f.kind === "INTRAORAL_SCAN")?.scanPart)
    .toBe("LOWER");

  // Remove the scan: row, R2 object and DB row are gone, and "Next" is blocked again.
  await row(page, "INTRAORAL_SCAN", "scan.stl")
    .getByRole("button", { name: "Remove scan.stl" })
    .click();
  await expect(row(page, "INTRAORAL_SCAN", "scan.stl")).toHaveCount(0);
  await expect.poll(() => getCaseFiles(caseId).length).toBe(1);
  await expect.poll(() => getR2Objects(caseId).length).toBe(1);
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
});

test("another dentist, the admin and anonymous users can't reach a dentist's draft files", async ({
  browser,
}) => {
  const a = await signIn(browser, dentist);
  const caseId = await startCase(a.page, "E2E-PRIVATE-1");
  await addFile(a.page, "INTRAORAL_SCAN", "done.stl", 20_000);
  await expect(row(a.page, "INTRAORAL_SCAN", "done.stl")).toHaveAttribute("data-state", "done");
  const done = getCaseFiles(caseId)[0];
  // An upload left open (registered, nothing sent yet).
  const open = await registerViaApi(a.context.request, {
    caseId,
    kind: "PHOTO",
    fileName: "open.jpg",
    sizeBytes: 1_000,
  });
  expect(open.status()).toBe(201);
  const openId = ((await open.json()) as { fileId: string }).fileId;

  const b = await signIn(browser, other);
  const req = b.context.request;
  const opts = { failOnStatusCode: false, maxRedirects: 0 } as const;
  expect(
    (
      await registerViaApi(req, { caseId, kind: "PHOTO", fileName: "x.jpg", sizeBytes: 10 })
    ).status(),
  ).toBe(404);
  expect((await req.get(`/api/uploads/multipart/${openId}`, opts)).status()).toBe(404);
  expect((await req.get(`/api/uploads/multipart/${openId}/1`, opts)).status()).toBe(404);
  expect((await req.post(`/api/uploads/multipart/${openId}/complete`, opts)).status()).toBe(404);
  expect((await req.delete(`/api/uploads/multipart/${openId}`, opts)).status()).toBe(404);
  expect((await req.delete(`/api/uploads/multipart/${done.id}`, opts)).status()).toBe(404);
  expect((await req.get(`/api/uploads/files/${done.id}/download`, opts)).status()).toBe(404);
  // Their attempts changed nothing.
  expect(getCaseFiles(caseId)).toHaveLength(2);

  // The admin can't see drafts (not even to download).
  const admins = await signIn(browser, admin);
  expect(
    (await admins.context.request.get(`/api/uploads/files/${done.id}/download`, opts)).status(),
  ).toBe(404);

  // Anonymous.
  const anon = await newUser(browser);
  expect(
    (await anon.context.request.get(`/api/uploads/multipart/${openId}/1`, opts)).status(),
  ).toBe(401);
  expect(
    (await anon.context.request.get(`/api/uploads/files/${done.id}/download`, opts)).status(),
  ).toBe(401);
});

test("the server rejects wrong types and sizes, and R2 rejects a part of the wrong size", async ({
  browser,
}) => {
  const { page, context } = await signIn(browser, dentist);
  const caseId = await startCase(page, "E2E-REJECT-1");
  const req = context.request;
  const register = (kind: string, fileName: string, sizeBytes: number) =>
    registerViaApi(req, { caseId, kind, fileName, sizeBytes });
  const code = async (res: Awaited<ReturnType<typeof register>>) =>
    ((await res.json()) as { error: string }).error;

  // Checked on the server, whatever the browser says.
  let res = await register("CBCT", "scan.exe", 1_000);
  expect([res.status(), await code(res)]).toEqual([400, "extension"]);
  res = await register("CBCT", "scan.zip", 3 * 1024 ** 3);
  expect([res.status(), await code(res)]).toEqual([400, "tooLarge"]);
  // A lab-only kind is a valid file type, but the permission matrix refuses it to a dentist.
  res = await register("PLAN_REPORT", "plan.pdf", 1_000);
  expect([res.status(), await code(res)]).toEqual([403, "kind"]);
  res = await register("CBCT", "scan.zip", 0);
  expect(res.status()).toBe(400);
  expect(getCaseFiles(caseId)).toHaveLength(0);

  // The browser refuses the wrong type before uploading, and says why.
  await addFile(page, "INTRAORAL_SCAN", "notes.pdf", 1_000);
  await expect(page.locator('[data-slot="INTRAORAL_SCAN"] [role=alert]')).toContainText(
    "this file type isn't accepted here",
  );

  // The declared size is signed into each part URL: R2 refuses a part of any other size.
  res = await register("PHOTO", "photo.jpg", 1_000);
  expect(res.status()).toBe(201);
  const { fileId } = (await res.json()) as { fileId: string };
  const part = (await (await req.get(`/api/uploads/multipart/${fileId}/1`)).json()) as {
    url: string;
  };
  expect(part.url.includes("X-Amz-Expires=900"), "part URL lasts 15 minutes").toBe(true);
  expect(
    (await req.get(`/api/uploads/multipart/${fileId}/2`, { failOnStatusCode: false })).status(),
  ).toBe(400);
  const tooBig = await req.put(part.url, { data: bytes(2_000), failOnStatusCode: false });
  expect(tooBig.status()).toBe(403);
  // Completing before the part arrived: refused, the upload stays open.
  const early = await req.post(`/api/uploads/multipart/${fileId}/complete`, {
    failOnStatusCode: false,
  });
  expect(early.status()).toBe(409);
  // The right size goes through and completes.
  expect((await req.put(part.url, { data: bytes(1_000) })).ok()).toBe(true);
  const completed = await req.post(`/api/uploads/multipart/${fileId}/complete`);
  expect(completed.ok()).toBe(true);
  expect(await completed.text()).toContain("<CompleteMultipartUploadResult>");
  expect(getCaseFiles(caseId)[0].uploadStatus).toBe("COMPLETE");
  expect(getR2Objects(caseId).map((o) => o.size)).toEqual([1_000]);
});

test("deleting a draft deletes its objects in R2", async ({ browser }) => {
  const { page } = await signIn(browser, dentist);
  const caseId = await startCase(page, "E2E-DELETE-1");
  await addFile(page, "CBCT", "dicom.zip", 40_000);
  await addFile(page, "PHOTO", "smile.jpg", 30_000);
  await expect(row(page, "CBCT", "dicom.zip")).toHaveAttribute("data-state", "done");
  await expect(row(page, "PHOTO", "smile.jpg")).toHaveAttribute("data-state", "done");
  expect(getR2Objects(caseId)).toHaveLength(2);

  await page.goto("/en/portal/cases");
  const draft = page.locator(`[data-draft="${caseId}"]`);
  await draft.getByRole("button", { name: /Delete draft/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByText("Draft deleted.")).toBeVisible();
  await expect(draft).toHaveCount(0);
  expect(getCase(caseId)).toBeNull();
  expect(getR2Objects(caseId)).toHaveLength(0);
});

test("leaving the wizard through an in-app link keeps the uploaded files", async ({ browser }) => {
  const { page } = await signIn(browser, dentist);
  const caseId = await startCase(page, "E2E-LEAVE-1");
  await addFile(page, "CBCT", "keep.zip", 30_000);
  await expect(row(page, "CBCT", "keep.zip")).toHaveAttribute("data-state", "done");

  // Client-side navigation unmounts the wizard (and its uploader): nothing may be deleted.
  await page.getByRole("navigation").getByRole("link", { name: "Cases" }).first().click();
  await expect(page).toHaveURL(/\/en\/portal\/cases$/);
  await page.waitForLoadState("networkidle");

  expect(getCaseFiles(caseId).map((f) => [f.kind, f.uploadStatus])).toEqual([["CBCT", "COMPLETE"]]);
  expect(getR2Objects(caseId)).toHaveLength(1);
  await page.goto(`/en/portal/cases/${caseId}/edit?step=3`);
  await expect(row(page, "CBCT", "keep.zip")).toHaveAttribute("data-state", "done");
});
