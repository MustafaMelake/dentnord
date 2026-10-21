import { expect, type Browser, type Page } from "@playwright/test";

/**
 * A fresh browser context (own cookies) with its own client IP. Better Auth rate-limits sign-in per
 * IP + path; locally every request would otherwise share one bucket. (On Vercel the edge sets
 * x-forwarded-for itself, so clients can't choose it.)
 */
export async function newUser(browser: Browser) {
  const ip = `10.${rand()}.${rand()}.${rand()}`;
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
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
