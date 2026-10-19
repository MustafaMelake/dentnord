// Used only by `pnpm auth:generate` (Better Auth CLI) to write auth tables into prisma/schema.prisma.
// The real instance is in src/lib/auth.ts.
import { betterAuth } from "better-auth";

import { authOptions } from "../src/lib/auth-options";

export const auth = betterAuth(authOptions);
