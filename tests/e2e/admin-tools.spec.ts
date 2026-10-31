import { cleanupE2EUsers, createUser } from "./support/db";
import { login, newUser } from "./support/helpers";
import { expect, test } from "./support/test";

// Admin tools: the password-reset link on /admin/dentists/[id] (for when the reset email doesn't
// reach the dentist), and the "Back to website" link in the admin sidebar and mobile bar.

let admin: ReturnType<typeof createUser>;

test.beforeAll(() => {
  cleanupE2EUsers();
  admin = createUser({ label: "tools-admin", role: "ADMIN", name: "E2E Tools Admin" });
});
test.afterAll(() => cleanupE2EUsers());

async function signInAdmin(browser: Parameters<typeof newUser>[0]) {
  const session = await newUser(browser);
  await login(session.page, admin.email, admin.password);
  await expect(session.page).toHaveURL(/\/admin\//);
  return session;
}

test("the admin creates a one-time reset link and the dentist sets a new password with it", async ({
  browser,
}) => {
  const dentist = createUser({ label: "reset-link", name: "Rikke Reset" });
  const a = await signInAdmin(browser);
  await a.context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await a.page.goto(`/admin/dentists/${dentist.id}`);

  const card = a.page.locator("[data-reset-link]");
  await card.getByRole("button", { name: "Create password-reset link" }).click();
  const field = card.getByLabel("Password-reset link");
  // Better Auth's own link; its callback is the reset page in the dentist's language.
  await expect(field).toHaveValue(
    /^http:\/\/localhost:3000\/api\/auth\/reset-password\/[\w-]+\?callbackURL=%2F(da|en)%2Freset-password$/,
  );
  const url = await field.inputValue();
  const locale = url.includes("%2Fda%2F") ? "da" : "en";
  await card.getByRole("button", { name: "Copy" }).click();
  await expect(a.page.getByText("Link copied.")).toBeVisible();
  expect(await a.page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  // Audit-logged in the dentist's history, without the link itself.
  const history = a.page.locator("section[aria-labelledby='history-heading']");
  await expect(history).toContainText("Password-reset link created");
  await expect(history).not.toContainText("reset-password/");

  // The dentist opens it and chooses a new password.
  const d = await newUser(browser);
  await d.page.goto(url);
  await expect(d.page).toHaveURL(new RegExp(`/${locale}/reset-password\\?token=`));
  const newPassword = "E2E-new-password-42";
  await d.page.locator("#password").fill(newPassword);
  await d.page.locator("#confirmPassword").fill(newPassword);
  await d.page.locator('form button[type="submit"]').click();
  await expect(d.page).toHaveURL(new RegExp(`/${locale}/login\\?reset=done`));
  await login(d.page, dentist.email, newPassword);
  await expect(d.page).toHaveURL(/\/en\/portal\/dashboard$/);

  // One use only.
  const again = await newUser(browser);
  await again.page.goto(url);
  await expect(again.page.locator(`a[href="/${locale}/forgot-password"]`)).toBeVisible();
  await expect(again.page.locator("#password")).toHaveCount(0);

  // Rate-limited: five links per dentist per hour.
  for (let i = 0; i < 4; i++) {
    const previous = await field.inputValue();
    await card.getByRole("button", { name: "Create a new link" }).click();
    await expect(field).not.toHaveValue(previous);
  }
  await card.getByRole("button", { name: "Create a new link" }).click();
  await expect(a.page.getByText("Too many reset links in a short time.")).toBeVisible();
});

test("no reset link for a disabled dentist", async ({ browser }) => {
  const dentist = createUser({ label: "reset-disabled", status: "REJECTED" });
  const a = await signInAdmin(browser);
  await a.page.goto(`/admin/dentists/${dentist.id}`);
  const card = a.page.locator("[data-reset-link]");
  await expect(card).toContainText("Re-activate it before creating a password-reset link.");
  await expect(card.getByRole("button")).toHaveCount(0);
});

test("the admin goes back to the website from the sidebar and from the mobile bar", async ({
  browser,
}) => {
  const a = await signInAdmin(browser);
  await a.page.goto("/admin/dashboard");
  const sidebarLink = a.page.locator("aside [data-back-to-site]");
  await expect(sidebarLink).toHaveText("Back to website");
  await expect(sidebarLink).toHaveAttribute("href", "/");
  await sidebarLink.click();
  // The proxy picks the language (cookie, then the browser's) and the public home page renders.
  await expect(a.page).toHaveURL(/\/(da|en)$/);
  await expect(a.page.getByRole("heading", { level: 1 })).toBeVisible();

  await a.page.setViewportSize({ width: 390, height: 844 });
  await a.page.goto("/admin/dashboard");
  const barLink = a.page.locator("header [data-back-to-site]");
  await expect(barLink).toBeVisible();
  await expect(barLink).toHaveAccessibleName("Back to website");
  await barLink.click();
  await expect(a.page).toHaveURL(/\/(da|en)$/);
  await expect(a.page.getByRole("heading", { level: 1 })).toBeVisible();
});
