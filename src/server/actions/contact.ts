"use server";

import { createHmac } from "node:crypto";

import { hasLocale } from "next-intl";
import { headers } from "next/headers";

import { env } from "@/env";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { contactFormSchema } from "@/lib/validation/contact";
import { notifyAdminOfContactMessage } from "@/server/services/notifications";
import { rateLimit } from "@/server/services/rate-limit";

// The public contact form. Anyone may send it, so: zod, a honeypot, a per-visitor and an overall
// rate limit (rate_limit table, so it holds across serverless instances), then the inbox
// (/admin/messages) and an email to the admin that names the sender but leaves out the message text.

export type ContactResult =
  { ok: true } | { ok: false; error?: "rateLimited"; fieldErrors?: Record<string, string> };

const HOUR = 60 * 60_000;
const CONTACT_LIMITS = {
  perVisitor: { max: 5, windowMs: HOUR },
  overall: { max: 100, windowMs: HOUR },
} as const;

/** The visitor's IP, keyed (HMAC with the app secret): the rate limiter never stores the address. */
async function visitorKey() {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(ip).digest("hex").slice(0, 32);
}

export async function submitContactMessage(locale: string, input: unknown): Promise<ContactResult> {
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const { website, phone, ...message } = parsed.data;
  // Honeypot filled in: answer like a success, so a bot learns nothing, but keep nothing.
  if (website) return { ok: true };

  const [visitor, overall] = await Promise.all([
    rateLimit(`contact:visitor:${await visitorKey()}`, CONTACT_LIMITS.perVisitor),
    rateLimit("contact:overall", CONTACT_LIMITS.overall),
  ]);
  if (!visitor.allowed || !overall.allowed) return { ok: false, error: "rateLimited" };

  const saved = await db.contactMessage.create({
    data: { ...message, phone: phone || null, locale: safeLocale },
    select: { name: true, clinic: true, email: true, phone: true },
  });
  notifyAdminOfContactMessage(saved);
  return { ok: true };
}
