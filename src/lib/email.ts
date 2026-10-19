import "server-only";

import type { ReactElement } from "react";
import { Resend } from "resend";

import { env } from "@/env";

// Templates live in src/emails (react-email). Keep patient data out of emails: case number + link only.

export const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  react,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
}) {
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    react,
    replyTo,
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);
  return data;
}
