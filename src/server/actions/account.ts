"use server";

import { refresh } from "next/cache";
import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { profileSchema } from "@/lib/validation/auth";
import { getDentistScope } from "@/server/queries/dentist";

// The dentist's own clinic profile. Email, role and status are not editable here.

export type ProfileResult =
  { ok: true } | { ok: false; fieldErrors?: Partial<Record<string, string>> };

export async function updateProfile(locale: string, input: unknown): Promise<ProfileResult> {
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const { dentistId } = await getDentistScope(safeLocale);

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const { cvr, ...profile } = parsed.data;
  await db.user.update({
    where: { id: dentistId },
    data: { ...profile, cvr: cvr ?? null },
  });

  refresh();
  return { ok: true };
}
