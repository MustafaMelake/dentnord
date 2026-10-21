import { expect, test } from "@playwright/test";

import {
  cleanupE2EUsers,
  createUser,
  E2E_PASSWORD,
  getAudit,
  getUser,
  uniqueEmail,
} from "./support/db";
import { adminDecide, login, newUser } from "./support/helpers";

// Registration, admin approval and access control, end to end against a production build.

let admin: ReturnType<typeof createUser>;

test.beforeAll(() => {
  cleanupE2EUsers(); // leftovers from an interrupted run
  admin = createUser({ label: "admin", role: "ADMIN", name: "E2E Admin" });
});

test("register → pending → no portal → admin approves → portal opens", async ({ browser }) => {
  const dentist = await newUser(browser);
  const email = uniqueEmail("register");
  const name = "Freja Register";

  // 1. Register (Danish UI).
  const page = dentist.page;
  await page.goto("/da/register");
  await page.getByLabel("Fulde navn", { exact: true }).fill(name);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Adgangskode", { exact: true }).fill(E2E_PASSWORD);
  await page.getByLabel("Gentag adgangskode", { exact: true }).fill(E2E_PASSWORD);
  await page.getByLabel("Klinikkens navn", { exact: true }).fill("Tandklinik E2E");
  await page.getByLabel("Telefon", { exact: true }).fill("+45 87 65 43 21");
  await expect(page.getByLabel("Land", { exact: true })).toHaveValue("DK");
  await page.getByLabel("Klinikkens adresse", { exact: true }).fill("Algade 2, 9000 Aalborg");

  // Consent is required: submitting without it shows an inline error.
  await page.getByRole("button", { name: "Opret konto" }).click();
  await expect(
    page.getByText("Du skal acceptere vilkårene og privatlivspolitikken."),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Opret konto" }).click();

  // 2. Lands on the pending page.
  await expect(page).toHaveURL(/\/da\/pending-approval$/);
  await expect(page.getByRole("heading", { name: "Din konto afventer godkendelse" })).toBeVisible();

  const created = getUser({ email })!;
  expect(created).not.toBeNull();
  expect(created.role).toBe("DENTIST");
  expect(created.dentistStatus).toBe("PENDING");
  expect(created.termsAcceptedAt).not.toBeNull();

  // 3. The portal stays closed.
  await page.goto("/da/portal/dashboard");
  await expect(page).toHaveURL(/\/da\/pending-approval$/);

  // 4. Admin logs in and approves.
  const adminUser = await newUser(browser);
  await login(adminUser.page, admin.email, admin.password);
  await expect(adminUser.page).toHaveURL(/\/admin\/dashboard$/);
  await adminUser.page.goto("/admin/dentists?status=pending");
  // Listed in the pending tab (desktop table row; the phone cards are hidden at this width).
  await expect(adminUser.page.getByRole("row").filter({ hasText: email })).toBeVisible();
  await adminDecide(adminUser.page, { id: created.id, name }, "Approve");
  await expect(adminUser.page.getByText(`${name} approved.`)).toBeVisible();

  const [audit] = getAudit(created.id);
  expect(audit).toMatchObject({
    action: "DENTIST_APPROVED",
    actorId: admin.id,
    actorEmail: admin.email,
  });

  // 5. Same session, no re-login: the portal opens (the proxy re-checks the stale cookie cache).
  await page.goto("/da/portal/dashboard");
  await expect(page).toHaveURL(/\/da\/portal\/dashboard$/);
  await expect(page.getByRole("heading", { name: `Velkommen, ${name}` })).toBeVisible();
  await expect(page.getByText("Ingen cases endnu").first()).toBeVisible();

  await dentist.context.close();
  await adminUser.context.close();
});

test("a rejected dentist loses their session and can't log in again", async ({ browser }) => {
  const dentist = createUser({ label: "reject", name: "Rune Rejected" });
  const user = await newUser(browser);

  await login(user.page, dentist.email, dentist.password);
  await expect(user.page).toHaveURL(/\/en\/portal\/dashboard$/);

  const adminUser = await newUser(browser);
  await login(adminUser.page, admin.email, admin.password);
  await expect(adminUser.page).toHaveURL(/\/admin\/dashboard$/);
  await adminDecide(adminUser.page, dentist, "Disable", "Not a registered clinic");
  await expect(adminUser.page.getByText(`${dentist.name} rejected.`)).toBeVisible();

  const rejected = getUser({ id: dentist.id })!;
  expect(rejected._count.sessions).toBe(0);
  expect(rejected.dentistStatus).toBe("REJECTED");
  expect(rejected.rejectionReason).toBe("Not a registered clinic");

  // The existing session is gone immediately (no waiting for the 5-minute cookie cache).
  await user.page.goto("/en/portal/dashboard");
  await expect(user.page).toHaveURL(/\/en\/login/);

  // And logging in again is refused with a clear message.
  await login(user.page, dentist.email, dentist.password);
  await expect(user.page.getByText("This account is not active", { exact: false })).toBeVisible();
  await user.page.goto("/en/portal/dashboard");
  await expect(user.page).toHaveURL(/\/en\/login/);

  await user.context.close();
  await adminUser.context.close();
});

test("a dentist can't open /admin", async ({ browser }) => {
  const dentist = createUser({ label: "noadmin", name: "Nora Noadmin" });
  const user = await newUser(browser);
  await login(user.page, dentist.email, dentist.password);
  await expect(user.page).toHaveURL(/\/en\/portal\/dashboard$/);

  for (const path of ["/admin", "/admin/dentists", `/admin/dentists/${dentist.id}`]) {
    const response = await user.page.goto(path);
    expect(response?.ok()).toBeTruthy();
    await expect(user.page).not.toHaveURL(/\/admin/);
    await expect(user.page.getByRole("heading", { name: "Dentists", exact: true })).toHaveCount(0);
  }

  // Calling the admin's API surface directly doesn't help either: no admin page renders.
  const direct = await user.context.request.get("/admin/dentists", { maxRedirects: 0 });
  expect(direct.status()).toBe(307);

  await user.context.close();
});

test("logged-out users are sent to login with `next`, and land there after logging in", async ({
  browser,
}) => {
  const user = await newUser(browser);
  const { page } = user;

  await page.goto("/da/portal/cases");
  await expect(page).toHaveURL(/\/da\/login\?next=%2Fda%2Fportal%2Fcases$/);

  await page.goto("/admin/dentists?status=approved");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fadmin%2Fdentists%3Fstatus%3Dapproved$/);

  // An off-site `next` is ignored.
  const dentist = createUser({ label: "next", name: "Nils Next" });
  await login(page, dentist.email, dentist.password, "/en/login?next=https%3A%2F%2Fevil.example");
  await expect(page).toHaveURL(/\/en\/portal\/dashboard$/);

  // A same-site portal `next` is honoured.
  await page.context().clearCookies();
  await page.goto("/da/portal/cases");
  await page.getByLabel("E-mail", { exact: true }).fill(dentist.email);
  await page.getByLabel("Adgangskode", { exact: true }).fill(dentist.password);
  await page.getByRole("button", { name: "Log ind" }).click();
  await expect(page).toHaveURL(/\/da\/portal\/cases$/);

  await user.context.close();
});

test("the admin can change their own password from the admin area", async ({ browser }) => {
  const own = createUser({ label: "admin-pw", role: "ADMIN", name: "Pia Password" });
  const newPassword = "e2e-New-Admin-Password-456";

  const main = await newUser(browser);
  const other = await newUser(browser); // a second device
  for (const { page } of [main, other]) {
    await login(page, own.email, own.password);
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
  }

  // Reached from the account menu in the sidebar.
  await main.page.getByRole("button", { name: "Admin" }).click();
  await main.page.getByRole("menuitem", { name: "Account" }).click();
  await expect(main.page).toHaveURL(/\/admin\/account$/);

  await main.page.getByLabel("Current password").fill(own.password);
  await main.page.getByLabel("New password").fill(newPassword);
  await main.page.getByLabel("Repeat password").fill(newPassword);
  await main.page.getByRole("button", { name: "Change password" }).click();
  await expect(
    main.page.getByText("Password changed. Other devices have been signed out."),
  ).toBeVisible();

  // This device stays signed in; the other one is signed out.
  await main.page.goto("/admin/dentists");
  await expect(main.page).toHaveURL(/\/admin\/dentists$/);
  await other.page.goto("/admin/dentists");
  await expect(other.page).toHaveURL(/\/en\/login/);

  // Old password no longer works, the new one does.
  await login(other.page, own.email, own.password);
  await expect(other.page.getByText("Incorrect email or password.")).toBeVisible();
  await login(other.page, own.email, newPassword);
  await expect(other.page).toHaveURL(/\/admin\/dashboard$/);

  await main.context.close();
  await other.context.close();
});
