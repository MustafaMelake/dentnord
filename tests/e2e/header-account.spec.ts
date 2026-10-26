import type { Page } from "@playwright/test";

import { cleanupE2EUsers, createUser } from "./support/db";
import { login, newUser, openMobileMenu } from "./support/helpers";
import { expect, test } from "./support/test";

// The marketing header's account control (session-aware slot in a prerendered header) and the
// portal's "Back to site" link.

let dentist: ReturnType<typeof createUser>;
let admin: ReturnType<typeof createUser>;

test.beforeAll(() => {
  cleanupE2EUsers();
  dentist = createUser({ label: "header-d", name: "Hanne Jensen" });
  admin = createUser({ label: "header-admin", role: "ADMIN", name: "Lab Admin" });
});

const header = (page: Page) => page.locator("[data-site-header]");
const signedIn = (page: Page) => header(page).locator('[data-account="signed-in"]');
const signedOut = (page: Page) => header(page).locator('[data-account="signed-out"]');

test("signed out: the header shows Log in, in both tones", async ({ browser }) => {
  const { page } = await newUser(browser);
  await page.goto("/en");
  await expect(signedOut(page)).toHaveText("Log in");
  await expect(signedIn(page)).toHaveCount(0);
  // Over the hero: white text. Scrolled: ink.
  await expect(signedOut(page)).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.mouse.wheel(0, 900);
  await expect(header(page)).toHaveAttribute("data-scrolled", "true");
  await expect(signedOut(page)).not.toHaveCSS("color", "rgb(255, 255, 255)");
});

test("a signed-in dentist keeps the account menu across the site and the portal, and can log out", async ({
  browser,
}) => {
  const { page } = await newUser(browser);
  await login(page, dentist.email, dentist.password);
  await expect(page).toHaveURL(/\/en\/portal\/dashboard$/);

  // Portal → "Back to site" → the marketing home, still signed in.
  await page.locator("aside [data-back-to-site]").click();
  await expect(page).toHaveURL(/\/en$/);
  const trigger = signedIn(page);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAccessibleName("Account menu");
  await expect(trigger).toHaveText(/HJ/);
  await expect(signedOut(page)).toHaveCount(0);
  // White over the hero, ink once scrolled.
  await expect(trigger).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.mouse.wheel(0, 900);
  await expect(header(page)).toHaveAttribute("data-scrolled", "true");
  await expect(trigger).not.toHaveCSS("color", "rgb(255, 255, 255)");

  // Client-side navigation between marketing pages keeps the session.
  await header(page).getByRole("link", { name: "Services" }).click();
  await expect(page).toHaveURL(/\/en\/services$/);
  await expect(signedIn(page)).toBeVisible();

  await signedIn(page).click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText(dentist.email);
  await expect(menu.getByRole("menuitem")).toHaveText(["Go to dashboard", "Account", "Log out"]);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  // Danish, and a full page load: still signed in.
  await page.goto("/da/about");
  await signedIn(page).click();
  await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText([
    "Gå til oversigt",
    "Konto",
    "Log ud",
  ]);
  await page.getByRole("menuitem", { name: "Gå til oversigt" }).click();
  await expect(page).toHaveURL(/\/da\/portal\/dashboard$/);

  // Back to the site and log out from the header: home page, signed out, portal closed.
  await page.locator("aside [data-back-to-site]").click();
  await expect(page).toHaveURL(/\/da$/);
  await signedIn(page).click();
  await page.getByRole("menuitem", { name: "Log ud" }).click();
  await expect(page).toHaveURL(/\/da$/);
  await expect(signedOut(page)).toHaveText("Log ind");
  await page.goto("/da/portal/dashboard");
  await expect(page).toHaveURL(/\/da\/login/);
});

test("the admin's menu leads to the admin dashboard", async ({ browser }) => {
  const { page } = await newUser(browser);
  await login(page, admin.email, admin.password);
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto("/en/contact");
  await signedIn(page).click();
  await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText([
    "Admin dashboard",
    "Log out",
  ]);
  await page.getByRole("menuitem", { name: "Admin dashboard" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
});

test("phone: the full-screen menu shows the account links; the portal bar links back", async ({
  browser,
}) => {
  const { page, context } = await newUser(browser);
  await page.setViewportSize({ width: 390, height: 844 });
  // Signed out: Log in in the menu.
  await page.goto("/en/services");
  let dialog = await openMobileMenu(page);
  await expect(dialog.locator('[data-account="signed-out"]')).toHaveText("Log in");
  await context.clearCookies();

  await login(page, dentist.email, dentist.password);
  await expect(page).toHaveURL(/\/en\/portal\/dashboard$/);
  await page.locator("header [data-back-to-site]").click();
  await expect(page).toHaveURL(/\/en$/);
  dialog = await openMobileMenu(page);
  const account = dialog.locator('[data-account="signed-in"]');
  await expect(account).toContainText("Hanne Jensen");
  await expect(dialog.locator('[data-account="signed-out"]')).toHaveCount(0);
  await account.getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL(/\/en\/portal\/account$/);
});

test.afterAll(() => cleanupE2EUsers());
