import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { env } from "@/env";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";

export const auth = betterAuth({
  ...authOptions,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_SITE_URL],
  database: prismaAdapter(db, { provider: "postgresql" }),
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
