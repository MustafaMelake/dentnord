import { expect, test, type BrowserContext, type Page, type Request } from "@playwright/test";

import {
  cleanupE2EUsers,
  createService,
  createUser,
  getService,
  getSetting,
  getTestimonials,
} from "./support/db";
import { login, newUser } from "./support/helpers";

// Admin content management against a production build: instant public updates (cache tags), hidden
// placeholders with admin-only markers, consent rules, and admin-only Server Actions.

let admin: ReturnType<typeof createUser>;

test.beforeAll(() => {
  cleanupE2EUsers();
  admin = createUser({ label: "content-admin", role: "ADMIN", name: "E2E Content Admin" });
});

async function adminPage(browser: Parameters<typeof newUser>[0]) {
  const user = await newUser(browser);
  await login(user.page, admin.email, admin.password);
  // /admin redirects to /admin/dashboard: wait for the final page before navigating elsewhere.
  await expect(user.page).toHaveURL(/\/admin\/dashboard$/);
  await user.page.waitForLoadState("networkidle");
  return user;
}

/** Records the next Server Action POST the page makes (Next-Action header + body). */
function captureAction(page: Page) {
  return new Promise<{ url: string; headers: Record<string, string>; body: string }>((resolve) => {
    const onRequest = (req: Request) => {
      const headers = req.headers();
      if (req.method() === "POST" && headers["next-action"]) {
        page.off("request", onRequest);
        resolve({ url: req.url(), headers, body: req.postData() ?? "" });
      }
    };
    page.on("request", onRequest);
  });
}

/** Replays a captured Server Action request with this context's cookies. */
async function replay(
  context: BrowserContext,
  action: { url: string; headers: Record<string, string>; body: string },
  body = action.body,
  url = action.url,
) {
  const pick = ["next-action", "content-type", "next-router-state-tree", "accept"];
  const headers = Object.fromEntries(
    pick.filter((h) => action.headers[h]).map((h) => [h, action.headers[h]]),
  );
  return context.request.post(url, {
    headers,
    data: body,
    maxRedirects: 0,
    failOnStatusCode: false,
  });
}

/** Saves the "Clinics" number via the admin form and returns the captured Server Action request. */
async function saveNumbers(page: Page, clinics: string) {
  await page.goto("/admin/settings?tab=numbers");
  await page.waitForLoadState("networkidle"); // hydrated: RHF has applied its default values
  const panel = page.getByRole("tabpanel"); // the visible tab only
  const input = panel.locator("#clinics");
  const save = async () => {
    const pending = captureAction(page);
    await panel.getByRole("button", { name: "Save changes" }).click();
    const action = await pending;
    await expect(panel.getByText("All changes saved")).toBeVisible();
    return action;
  };
  // Save is only enabled when the value changes: flip it first if it already matches.
  if ((await input.inputValue()) === clinics) {
    await input.fill(clinics === "" ? "1" : "");
    await save();
  }
  await input.fill(clinics);
  return save();
}

test("the admin edits a service title and the home page shows it immediately", async ({
  browser,
}) => {
  const service = createService(`e2e-svc-${Date.now()}`, "E2E Original Service");
  const newTitle = `E2E Renamed Service ${Date.now()}`;

  const { page, context } = await adminPage(browser);
  await page.goto(`/admin/services/${service.id}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#title-en").fill(newTitle);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved. The website is updated.")).toBeVisible();
  expect(getService(service.id)?.title.en).toBe(newTitle);

  // A visitor sees it on the very next request: no rebuild, no waiting for the cache to expire.
  const visitor = await newUser(browser);
  await visitor.page.goto("/en");
  await expect(visitor.page.getByRole("heading", { name: newTitle })).toHaveCount(1);
  await visitor.page.goto("/da");
  await expect(visitor.page.getByRole("heading", { name: "E2E Original Service" })).toHaveCount(1);

  await visitor.context.close();
  await context.close();
});

test("an empty stat is hidden for visitors and marked for the admin", async ({ browser }) => {
  const { page, context } = await adminPage(browser);
  await saveNumbers(page, "");
  expect((getSetting("stats") ?? {}).clinics ?? null).toBeNull();

  const visitor = await newUser(browser);
  await visitor.page.goto("/en");
  await expect(visitor.page.getByText(/Trusted by .* dental clinics/)).toHaveCount(0);
  await expect(visitor.page.locator("[data-missing-marker]")).toHaveCount(0);
  await expect(visitor.page.locator("body")).not.toContainText("[X]");

  // The admin (same public page) sees a small marker linking to the field.
  await page.goto("/en");
  const marker = page.locator("[data-missing-marker]", { hasText: "Missing: Number of clinics" });
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute("href", "/admin/settings?tab=numbers#clinics");

  // Filling it in shows the line to visitors right away.
  await saveNumbers(page, "37");
  await visitor.page.goto("/en");
  await expect(visitor.page.getByText("Trusted by 37 dental clinics in Denmark")).toBeVisible();
  await saveNumbers(page, "");

  await visitor.context.close();
  await context.close();
});

test("a testimonial without consent can't be published", async ({ browser }) => {
  const { page, context } = await adminPage(browser);
  await page.goto("/admin/settings?tab=testimonials");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add testimonial" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#quote-da").fill("E2E citat");
  await dialog.locator("#quote-en").fill("E2E quote");
  await dialog.locator("#authorName").fill("E2E Tester");

  // The publish switch is disabled until consent is ticked.
  await expect(dialog.getByRole("switch", { name: "Published" })).toBeDisabled();
  const pending = captureAction(page);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  const save = await pending;
  await expect(dialog).toBeHidden();

  const [created] = getTestimonials("E2E Tester");
  expect(created).toMatchObject({ consent: false, published: false });
  await expect(page.getByRole("switch", { name: "Published: E2E Tester" })).toBeDisabled();

  // Even calling the Server Action directly with published=true is refused.
  const forged = save.body
    .replace('"id":null', `"id":"${created.id}"`)
    .replace('"published":false', '"published":true');
  expect(forged).toContain('"published":true');
  await replay(context, save, forged);
  expect(getTestimonials("E2E Tester")[0]).toMatchObject({ consent: false, published: false });

  await context.close();
});

test("a non-admin can't call admin Server Actions, even directly", async ({ browser }) => {
  const { page, context } = await adminPage(browser);
  const action = await saveNumbers(page, "");
  const forged = action.body.replace('"clinics":""', '"clinics":"4242"');
  expect(forged).toContain("4242");

  const dentist = createUser({ label: "content-dentist", name: "E2E Content Dentist" });
  const dentistUser = await newUser(browser);
  await login(dentistUser.page, dentist.email, dentist.password);
  await expect(dentistUser.page).toHaveURL(/\/en\/portal\/dashboard$/);
  const anonymous = await newUser(browser);

  // Same action, posted to the admin page and to a public page (actions can be posted anywhere).
  for (const url of [action.url, new URL("/en", action.url).toString()]) {
    for (const ctx of [dentistUser.context, anonymous.context]) {
      const res = await replay(ctx, action, forged, url);
      expect(res.status()).not.toBe(500);
      expect((getSetting("stats") ?? {}).clinics ?? null).toBeNull();
    }
  }

  // Control: the identical request from the admin does go through, so the replay itself works.
  await replay(context, action, forged, new URL("/en", action.url).toString());
  expect((getSetting("stats") ?? {}).clinics).toBe(4242);
  await replay(context, action);
  expect((getSetting("stats") ?? {}).clinics ?? null).toBeNull();

  await dentistUser.context.close();
  await anonymous.context.close();
  await context.close();
});

test("logged-out visitors never see placeholder text on public pages", async ({ browser }) => {
  const visitor = await newUser(browser);
  const pages = [
    "/da",
    "/en",
    "/da/portfolio",
    "/en/portfolio",
    "/da/services",
    "/da/about",
    "/da/contact",
    "/da/terms",
    "/en/privacy",
    "/da/login",
    "/en/register",
  ];
  for (const path of pages) {
    await visitor.page.goto(path);
    const text = await visitor.page.locator("body").innerText();
    expect(text, path).not.toMatch(
      /\[(X|price|phone|address|CVR|credentials|City|By|Languages|Sprog)\]/,
    );
    expect(text, path).not.toMatch(/\[[^\]\n]{1,60}(pending|mangler)[^\]\n]*\]/i);
    await expect(visitor.page.locator("[data-missing-marker]"), path).toHaveCount(0);
  }
  await visitor.context.close();
});
