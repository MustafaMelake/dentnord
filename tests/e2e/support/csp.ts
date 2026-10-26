import type { BrowserContext } from "@playwright/test";

// Content-Security-Policy violations, collected from every browser context the tests open
// (newUser() and the built-in `context` fixture). The `test` in ./test.ts fails any test that
// produced one, so the whole suite doubles as a CSP check (Report-Only or enforced).
// Two sources: Chrome's console message ("… violates the following Content Security Policy
// directive …", "[Report Only] …" in Report-Only mode) and a `securitypolicyviolation` listener.

const VIOLATION = /violates the following Content Security Policy|^CSP violation:/;

let violations: string[] = [];
const watched = new WeakSet<BrowserContext>();

export async function watchCsp(context: BrowserContext) {
  if (watched.has(context)) return;
  watched.add(context);
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      console.error(
        `CSP violation: ${event.effectiveDirective} ${event.blockedURI} (${event.disposition})`,
      );
    });
  });
  context.on("console", (message) => {
    const text = message.text();
    if (VIOLATION.test(text)) violations.push(`${message.page()?.url() ?? "?"} → ${text}`);
  });
}

/** Violations since the last call (and forgets them). */
export function takeCspViolations() {
  const out = violations;
  violations = [];
  return out;
}
