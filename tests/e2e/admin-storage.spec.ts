import {
  addFileRow,
  cleanupE2EUsers,
  createMedia,
  createService,
  createSubmittedCase,
  createUser,
  mediaState,
  setServiceImage,
} from "./support/db";
import { login, newUser } from "./support/helpers";
import { expect, test } from "./support/test";

// /admin/storage: usage from the database, case files per dentist, and deleting unused site images
// (only unused ones: the server checks again at delete time).

const GB = 1024 ** 3;

let admin: ReturnType<typeof createUser>;

test.beforeAll(() => {
  cleanupE2EUsers();
  admin = createUser({ label: "storage-admin", role: "ADMIN", name: "E2E Storage Admin" });
});
test.afterAll(() => cleanupE2EUsers());

async function openStorage(browser: Parameters<typeof newUser>[0]) {
  const session = await newUser(browser);
  await login(session.page, admin.email, admin.password);
  await expect(session.page).toHaveURL(/\/admin\//);
  await session.page.goto("/admin/storage");
  return session;
}

/** "4.5 GB" → bytes (formatBytes' 1024-based units). */
function parseSize(text: string) {
  const [value, unit] = text.trim().split(" ");
  return Number(value) * 1024 ** ["B", "KB", "MB", "GB", "TB"].indexOf(unit);
}

test("the storage overview shows the buckets, the free allowance and each dentist's case files", async ({
  browser,
}) => {
  const dentist = createUser({ label: "storage-dentist", name: "Sara Storage" });
  const caseId = createSubmittedCase(dentist.email);
  addFileRow(caseId, 3 * GB);
  addFileRow(caseId, 1.5 * GB);

  const { page } = await openStorage(browser);
  await expect(page.getByRole("heading", { level: 1, name: "Storage" })).toBeVisible();
  await expect(page.locator("aside a[href='/admin/storage']")).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Totals per bucket, and both against the 10 GB free allowance.
  const cases = page.locator("[data-storage-total='cases']");
  await expect(cases).toContainText("Case files (private)");
  const casesBytes = parseSize(await cases.locator("[data-value]").innerText());
  expect(casesBytes).toBeGreaterThanOrEqual(4.5 * GB);
  await expect(page.locator("[data-storage-total='media']")).toContainText("Site images (public)");
  const meter = page.getByRole("meter", { name: "Cloudflare R2 free allowance" });
  await expect(meter).toHaveAttribute("aria-valuetext", /of 10\.0 GB \(\d+(\.\d)?%\)$/);

  // The dentist's row: their files, and their own uploads against the 50 GB cap.
  const row = page.locator(`[data-storage-dentists] tr[data-dentist-id='${dentist.id}']`);
  await expect(row).toContainText("Sara Storage");
  await expect(row).toContainText("Sara Storage Clinic");
  await expect(row.locator("[data-files]")).toHaveText("2");
  await expect(row.locator("[data-stored]")).toHaveText("4.5 GB");
  await expect(row).toContainText("4.5 GB (9%)");

  // Largest first.
  const sizes = (await page.locator("[data-storage-dentists] [data-stored]").allInnerTexts()).map(
    parseSize,
  );
  expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
});

test("an unused image can be deleted: the object, the row, and an audit entry", async ({
  browser,
}) => {
  const media = createMedia(admin.email, `E2E unused image ${Date.now()}`);
  const { page } = await openStorage(browser);

  const card = page.locator(`[data-media-id='${media.id}']`);
  await expect(card).toHaveAttribute("data-media-used", "false");
  await expect(card).toContainText("Not used");
  await card.getByRole("button", { name: /^Delete image:/ }).click();

  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Nothing on the site uses it.");
  await dialog.getByRole("button", { name: "Delete image" }).click();
  await expect(page.getByText("Image deleted.")).toBeVisible();
  await expect(card).toHaveCount(0);
  expect(mediaState(media.id, media.key)).toEqual({ row: false, object: false, deleteAudits: 1 });
});

test("an image in use can't be deleted, and the server checks again at delete time", async ({
  browser,
}) => {
  const stamp = Date.now();
  const used = createMedia(admin.email, `E2E used image ${stamp}`);
  const service = createService(`e2e-storage-${stamp}`, `E2E Storage service ${stamp}`);
  setServiceImage(service.id, used.id);
  const late = createMedia(admin.email, `E2E late image ${stamp}`);

  const { page } = await openStorage(browser);

  // In use: where, with a link to edit it, and no way to delete.
  const usedCard = page.locator(`[data-media-id='${used.id}']`);
  await expect(usedCard).toHaveAttribute("data-media-used", "true");
  await expect(
    usedCard.getByRole("link", { name: `Service: E2E Storage service ${stamp}` }),
  ).toHaveAttribute("href", `/admin/services/${service.id}`);
  await expect(usedCard.getByRole("button", { name: "In use, can't delete" })).toBeDisabled();
  await expect(usedCard.getByRole("button", { name: /^Delete image:/ })).toHaveCount(0);

  // Unused when the page loaded, put to use before the delete is confirmed: the server refuses.
  const lateCard = page.locator(`[data-media-id='${late.id}']`);
  await expect(lateCard).toHaveAttribute("data-media-used", "false");
  await lateCard.getByRole("button", { name: /^Delete image:/ }).click();
  setServiceImage(service.id, late.id);
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete image" }).click();
  await expect(
    page.getByText("This image is used on the website, so it can't be deleted."),
  ).toBeVisible();
  await expect(lateCard).toHaveAttribute("data-media-used", "true");

  expect(mediaState(used.id, used.key)).toEqual({ row: true, object: true, deleteAudits: 0 });
  expect(mediaState(late.id, late.key)).toEqual({ row: true, object: true, deleteAudits: 0 });
});
