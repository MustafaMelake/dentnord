import { expect, test as base } from "@playwright/test";

import { takeCspViolations, watchCsp } from "./csp";

// The `test` every spec uses: Playwright's, plus a check that the test caused no CSP violation in
// any browser context (see csp.ts). (Fixture callbacks are named `run`, not `use`: the React hooks
// lint rule would take `use` for React's.)

export const test = base.extend<{ cspGuard: void }>({
  context: async ({ context }, run) => {
    await watchCsp(context);
    await run(context);
  },
  cspGuard: [
    async ({}, run) => {
      takeCspViolations();
      await run();
      expect(takeCspViolations(), "Content-Security-Policy violations").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
