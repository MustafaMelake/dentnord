import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

// The admin's "Create password-reset link" (server/services/password-reset-link.ts) runs Better
// Auth's own request-password-reset endpoint inside this context. `sendResetPassword` (lib/auth.ts)
// then hands the link over here instead of emailing it, so the token, its expiry and the reset page
// are exactly those of the normal email flow. Outside the context, nothing changes.

export const resetLinkCapture = new AsyncLocalStorage<{ url?: string }>();
