import { expect, type Page } from "@playwright/test";

/** How long one upload may take to reach "done" or "error". */
const SETTLE_MS = 90_000;
/** Retry presses before giving up (like a user on a shaky connection). */
const MAX_RETRIES = 3;
/** A visible Retry button is clicked at once; this only covers it disappearing under us. */
const RETRY_CLICK_MS = 5_000;
/** Settle → retry rounds in total, also counting the uploader's own retries (never loop forever). */
const MAX_ROUNDS = 10;

/**
 * Adds a file to an upload slot and waits until it is uploaded. If the upload fails, presses Retry
 * (it resumes the parts), up to MAX_RETRIES times.
 *
 * Fails fast with the row's own error text instead of hanging until the test timeout: a row can
 * leave "error" by itself (the uploader retries when the connection comes back), which removes the
 * Retry button between our read and our click. Then it waits again; but a row still in "error"
 * without a clickable Retry button is a failure.
 */
export async function uploadFile(
  page: Page,
  scope: string,
  slot: string,
  name: string,
  buffer: Buffer,
) {
  await page.locator(`${scope} [data-slot="${slot}"] input[type=file]`).setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer,
  });
  const row = page.locator(`${scope} [data-slot="${slot}"] [data-file-row="${name}"]`);
  const rowText = async () => (await row.innerText().catch(() => "")).replace(/\s+/g, " ").trim();

  for (let retries = 0, round = 1; ; round++) {
    if (round > MAX_ROUNDS) {
      throw new Error(
        `Upload of ${name} kept failing and retrying by itself: "${await rowText()}"`,
      );
    }
    await expect(row, `upload of ${name} neither finished nor failed`).toHaveAttribute(
      "data-state",
      /^(done|error)$/,
      { timeout: SETTLE_MS },
    );
    if ((await row.getAttribute("data-state")) === "done") return;
    if (retries === MAX_RETRIES) {
      throw new Error(
        `Upload of ${name} still failing after ${MAX_RETRIES} retries: "${await rowText()}"`,
      );
    }
    const clicked = await row
      .getByRole("button", { name: /^Retry/ })
      .click({ timeout: RETRY_CLICK_MS })
      .then(
        () => true,
        () => false,
      );
    if (clicked) {
      retries++;
      // Give the retry a moment to start, so the next round doesn't read the old "error".
      await expect(row)
        .not.toHaveAttribute("data-state", "error", { timeout: 10_000 })
        .catch(() => undefined);
      continue;
    }
    if ((await row.getAttribute("data-state")) === "error") {
      throw new Error(
        `Upload of ${name} failed and has no clickable Retry button: "${await rowText()}"`,
      );
    }
    // It left "error" by itself (retrying or done): wait for it to settle again.
  }
}
