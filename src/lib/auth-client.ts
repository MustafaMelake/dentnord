import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth";

// Browser-side Better Auth client. Same origin, so no baseURL needed.
// twoFactorClient adds authClient.twoFactor.* (enable, verifyTotp, verifyBackupCode, …). The login
// form handles `twoFactorRedirect` itself, so no redirect page is configured here.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
