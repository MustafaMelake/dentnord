import { expect, type Browser, type Page } from "@playwright/test";

/**
 * A fresh browser context (own cookies) with its own client IP. Better Auth rate-limits sign-in per
 * IP + path; locally every request would otherwise share one bucket. (On Vercel the edge sets
 * x-forwarded-for itself, so clients can't choose it.)
 * The header is added only to requests for our own server: `extraHTTPHeaders` would also put it on
 * the browser's direct uploads to R2, whose CORS rule (rightly) doesn't allow it.
 */
export async function newUser(browser: Browser) {
  const ip = `10.${rand()}.${rand()}.${rand()}`;
  const context = await browser.newContext();
  await context.route(
    (url) => url.origin === "http://localhost:3000",
    (route) => route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }),
  );
  const page = await context.newPage();
  return { context, page };
}

const rand = () => Math.floor(Math.random() * 254) + 1;

export async function login(page: Page, email: string, password: string, path = "/en/login") {
  await page.goto(path);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

/**
 * Phone width: open the site header's full-screen menu. Waits until the header is hydrated
 * (`data-ready`): after a full page load the server-rendered button is visible before React has
 * attached its click handler, and a tap in that window does nothing.
 */
export async function openMobileMenu(page: Page, buttonName = "Open menu") {
  const button = page.getByRole("button", { name: buttonName });
  await expect(button).toHaveAttribute("data-ready", "true");
  await button.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Admin: open the dentist's detail page and run an action (Approve / Reject / Disable / Re-activate). */
export async function adminDecide(
  page: Page,
  dentist: { id: string; name: string },
  action: "Approve" | "Reject" | "Disable" | "Re-activate",
  reason?: string,
) {
  await page.goto(`/admin/dentists/${dentist.id}`);
  await expect(page.getByRole("heading", { level: 1, name: dentist.name })).toBeVisible();
  await page.getByRole("button", { name: action }).first().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  if (reason) await dialog.getByLabel(/Reason/).fill(reason);
  await dialog.getByRole("button", { name: action }).click();
  await expect(dialog).toBeHidden();
}
