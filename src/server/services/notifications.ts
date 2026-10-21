import "server-only";

import { buildAccountApprovedEmail } from "@/emails/account-approved";
import { buildAccountRejectedEmail } from "@/emails/account-rejected";
import { buildDentistRegisteredEmail } from "@/emails/dentist-registered";
import { emailLocale } from "@/emails/i18n";
import { buildPasswordResetEmail } from "@/emails/password-reset";
import { env } from "@/env";
import { db } from "@/lib/db";
import { sendEmail, sendInBackground } from "@/lib/email";
import { getContactSetting } from "@/server/queries/site-settings";

// Account emails. Each one is queued with `sendInBackground`, so callers never wait for the provider
// and a failed send is only logged. No patient data in any of these.

type Recipient = { name: string; email: string; preferredLocale?: string | null };

const siteUrl = (path: string) => new URL(path, env.NEXT_PUBLIC_SITE_URL).toString();

function countryName(code: string | null | undefined, locale: string) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

async function contactEmail() {
  return (await getContactSetting()).email || env.ADMIN_EMAIL;
}

/** To ADMIN_EMAIL: a new dentist is waiting for review. */
export function notifyAdminOfRegistration(
  dentist: Recipient & {
    id: string;
    clinicName?: string | null;
    phone?: string | null;
    country?: string | null;
  },
) {
  sendInBackground(async () => {
    const admin = await db.user.findUnique({
      where: { email: env.ADMIN_EMAIL.toLowerCase() },
      select: { preferredLocale: true },
    });
    // The admin dashboard is English only; the email follows the admin's own preference.
    const locale = emailLocale(admin?.preferredLocale ?? "en");
    const email = buildDentistRegisteredEmail({
      locale,
      reviewUrl: siteUrl(`/admin/dentists/${dentist.id}`),
      dentist: {
        name: dentist.name,
        email: dentist.email,
        clinicName: dentist.clinicName ?? "",
        phone: dentist.phone ?? "",
        country: countryName(dentist.country, locale),
      },
    });
    await sendEmail({ to: env.ADMIN_EMAIL, ...email });
  });
}

export function notifyAccountApproved(dentist: Recipient) {
  sendInBackground(async () => {
    const locale = emailLocale(dentist.preferredLocale);
    const email = buildAccountApprovedEmail({
      locale,
      name: dentist.name,
      portalUrl: siteUrl(`/${locale}/portal/dashboard`),
    });
    await sendEmail({ to: dentist.email, ...email });
  });
}

export function notifyAccountRejected(dentist: Recipient, reason?: string | null) {
  sendInBackground(async () => {
    const locale = emailLocale(dentist.preferredLocale);
    const email = buildAccountRejectedEmail({
      locale,
      name: dentist.name,
      reason,
      contactEmail: await contactEmail(),
    });
    await sendEmail({ to: dentist.email, ...email });
  });
}

/** `url` comes from Better Auth: /api/auth/reset-password/<token>?callbackURL=/<locale>/reset-password */
export function sendPasswordResetEmail(user: Recipient, url: string) {
  sendInBackground(async () => {
    const locale = emailLocale(user.preferredLocale);
    const email = buildPasswordResetEmail({ locale, name: user.name, resetUrl: url });
    await sendEmail({ to: user.email, ...email });
  });
}
