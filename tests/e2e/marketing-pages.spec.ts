import { expect, test, type Page } from "@playwright/test";

import {
  cleanupE2EUsers,
  createUser,
  getContactMessages,
  getSetting,
  setSetting,
  uniqueEmail,
} from "./support/db";
import { login, newUser, openMobileMenu } from "./support/helpers";

// The Services / About / Contact pages: the contact form → inbox (/admin/messages), editing a page
// in /admin/pages and seeing it on the site, and the header / footer links in both languages.

let admin: ReturnType<typeof createUser>;

test.beforeAll(() => {
  cleanupE2EUsers();
  admin = createUser({ label: "pages-admin", role: "ADMIN", name: "E2E Pages Admin" });
});
test.afterAll(() => cleanupE2EUsers());

async function signInAdmin(browser: Parameters<typeof newUser>[0]) {
  const session = await newUser(browser);
  await login(session.page, admin.email, admin.password);
  await expect(session.page).toHaveURL(/\/admin\//);
  return session;
}

async function fillContactForm(
  page: Page,
  values: { name: string; clinic: string; email: string; phone?: string; message: string },
) {
  await page.locator("#contact-name").fill(values.name);
  await page.locator("#contact-clinic").fill(values.clinic);
  await page.locator("#contact-email").fill(values.email);
  if (values.phone) await page.locator("#contact-phone").fill(values.phone);
  await page.locator("#contact-message").fill(values.message);
}

test("a contact message is stored, shows in the admin inbox, and can be marked read and deleted", async ({
  browser,
}) => {
  const visitor = await newUser(browser);
  const email = uniqueEmail("contact");
  await visitor.page.goto("/en/contact");
  await expect(visitor.page.locator("[data-patient-note]")).toContainText(
    "don't include patient information",
  );

  // A CPR number is refused before anything is sent.
  await fillContactForm(visitor.page, {
    name: "E2E Visitor",
    clinic: "E2E Clinic",
    email,
    message: "About the patient 010203-1234, please call me.",
  });
  await visitor.page.getByRole("button", { name: "Send message" }).click();
  await expect(visitor.page.getByText("This looks like a CPR number")).toBeVisible();

  await visitor.page
    .locator("#contact-message")
    .fill("Hello, I have a question about guides for full-arch cases.\nCould you call me?");
  await visitor.page.locator("#contact-phone").fill("+45 12 34 56 78");
  await visitor.page.getByRole("button", { name: "Send message" }).click();
  await expect(visitor.page.locator("[data-contact-sent]")).toContainText(
    "your message has been sent",
  );

  const [stored] = getContactMessages(email);
  expect(stored).toMatchObject({
    name: "E2E Visitor",
    clinic: "E2E Clinic",
    phone: "+45 12 34 56 78",
    locale: "en",
    read: false,
  });
  expect(stored.message).toContain("full-arch cases.\nCould you call me?");

  // The admin's inbox: unread, with a badge in the nav.
  const a = await signInAdmin(browser);
  await a.page.goto("/admin/messages");
  await expect(
    a.page.getByRole("navigation").getByRole("link", { name: /Messages/ }),
  ).toContainText(/\d/);
  const item = a.page.locator(`[data-contact-message="${stored.id}"]`);
  await expect(item).toHaveAttribute("data-read", "false");
  await item.getByRole("button", { name: /E2E Visitor/ }).click();
  await expect(item.locator("[data-message-body]")).toHaveText(stored.message);
  await expect(item.getByRole("link", { name: email })).toHaveAttribute("href", `mailto:${email}`);

  await item.getByRole("button", { name: "Mark as read" }).click();
  await expect(item).toHaveAttribute("data-read", "true");
  expect(getContactMessages(email)[0].read).toBe(true);

  // The row stays open across the refresh (same component), so its actions are still there.
  await item.getByRole("button", { name: "Delete" }).click();
  await a.page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(item).toHaveCount(0);
  expect(getContactMessages(email)).toEqual([]);
});

test("the honeypot drops bot messages without telling the bot", async ({ browser }) => {
  const bot = await newUser(browser);
  const email = uniqueEmail("contact-bot");
  await bot.page.goto("/da/contact");
  await fillContactForm(bot.page, {
    name: "E2E Bot",
    clinic: "E2E Spam",
    email,
    message: "Cheap pills, best prices, click here now.",
  });
  // People never see this field; a bot fills in every input it finds.
  await bot.page.locator("#contact-website").fill("https://spam.example", { force: true });
  await bot.page.getByRole("button", { name: "Send besked" }).click();
  await expect(bot.page.locator("[data-contact-sent]")).toContainText("din besked er sendt");
  expect(getContactMessages(email)).toEqual([]);
});

test("an admin edits the About page and the site shows it in both languages", async ({
  browser,
}) => {
  const before = getSetting("page.about");
  const text = (field: string) =>
    (before?.[field] ?? { da: "", en: "" }) as { da: string; en: string };
  const stamp = Date.now();
  const title = { en: `E2E About title ${stamp}`, da: `E2E Om-titel ${stamp}` };
  const a = await signInAdmin(browser);

  async function saveAbout(values: { title: { da: string; en: string }; approachBodyEn: string }) {
    await a.page.goto("/admin/pages/about");
    // Fill only once the form is hydrated, and check each value: typing into the server-rendered
    // input too early can leave the old text in front of the new one.
    await a.page.waitForLoadState("networkidle");
    for (const [id, value] of [
      ["#title-en", values.title.en],
      ["#title-da", values.title.da],
      ["#approachBody-en", values.approachBodyEn],
    ] as const) {
      await a.page.locator(id).fill(value);
      await expect(a.page.locator(id)).toHaveValue(value);
    }
    await a.page.getByRole("button", { name: "Save changes" }).click();
    await expect(a.page.getByText("Saved. The website is updated.")).toBeVisible();
  }

  try {
    await saveAbout({ title, approachBodyEn: "First paragraph.\n\nSecond paragraph." });
    await expect(a.page.locator("[data-starter-notice]")).toHaveCount(0);
    expect(getSetting("page.about")).toMatchObject({ title, starter: false });

    const visitor = await newUser(browser);
    await visitor.page.goto("/en/about");
    await expect(visitor.page.getByRole("heading", { level: 1 })).toHaveText(title.en);
    await expect(visitor.page.getByText("Second paragraph.")).toBeVisible();
    await visitor.page.goto("/da/about");
    await expect(visitor.page.getByRole("heading", { level: 1 })).toHaveText(title.da);
  } finally {
    // Put the texts back through the form, which also refreshes the cached public page (a database
    // write alone would leave the test title on the site until the cache expires). Then restore the
    // row exactly, starter flag included (saving always marks the page as reviewed).
    await saveAbout({ title: text("title"), approachBodyEn: text("approachBody").en });
    setSetting("page.about", before);
  }
});

const PAGES = {
  en: { services: "Services", about: "About", contact: "Contact", menu: "Open menu" },
  da: { services: "Ydelser", about: "Om os", contact: "Kontakt", menu: "Åbn menu" },
} as const;

for (const locale of ["en", "da"] as const) {
  test(`header, footer and phone menu reach the three pages (${locale})`, async ({ browser }) => {
    const { page } = await newUser(browser);
    const labels = PAGES[locale];
    for (const slug of ["services", "about", "contact"] as const) {
      // Desktop header.
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${locale}`);
      await page.locator("[data-site-header]").getByRole("link", { name: labels[slug] }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/${slug}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // Footer.
      await page.goto(`/${locale}`);
      await page.getByRole("contentinfo").getByRole("link", { name: labels[slug] }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/${slug}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // Phone: the full-screen menu.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${locale}`);
      const menu = await openMobileMenu(page, labels.menu);
      await menu.getByRole("link", { name: labels[slug] }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/${slug}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
}
