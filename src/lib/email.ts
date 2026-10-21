import "server-only";

import { render } from "@react-email/components";
import { after } from "next/server";
import type { ReactElement } from "react";
import { Resend } from "resend";

import { env } from "@/env";

// Templates live in src/emails (react-email). Keep patient data out of emails: case number + link only.
//
// Without a real Resend key (local dev, or the placeholder value) emails are logged to the server
// console instead of sent: recipient, subject and the action link. In a production build the link is
// redacted from the log, so live reset tokens never end up in hosted logs.
// Sending never throws: a failed email must not break the user action that triggered it.

/** Real Resend keys look like `re_` + ~30 random characters. Anything else is a placeholder. */
export function isRealResendKey(key: string | undefined): key is string {
  return (
    !!key && /^re_[A-Za-z0-9_]{20,}$/.test(key) && !/placeholder|dummy|example|xxxx/i.test(key)
  );
}

const resend = isRealResendKey(env.RESEND_API_KEY) ? new Resend(env.RESEND_API_KEY) : null;

export type EmailMessage = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
  /** The main link in the email. Logged in dev when Resend is not configured. */
  link?: string;
};

export async function sendEmail({ to, subject, react, replyTo, link }: EmailMessage) {
  try {
    if (!resend) {
      const shownLink = link && env.NODE_ENV === "production" ? "[redacted in production]" : link;
      console.info(
        [
          "[email] Resend is not configured: logging instead of sending",
          `  to:      ${Array.isArray(to) ? to.join(", ") : to}`,
          `  subject: ${subject}`,
          ...(shownLink ? [`  link:    ${shownLink}`] : []),
        ].join("\n"),
      );
      return { sent: false as const, logged: true as const };
    }

    const [html, text] = await Promise.all([render(react), render(react, { plainText: true })]);
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
      replyTo,
    });
    if (error) throw new Error(error.message);
    return { sent: true as const, logged: false as const };
  } catch (error) {
    console.error("[email] send failed", {
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return { sent: false as const, logged: false as const };
  }
}

/**
 * Runs an email task after the response is sent (Next `after()`, which uses `waitUntil` on Vercel),
 * so the user action never waits for, or fails because of, the email provider.
 * Outside a request scope (scripts) it falls back to fire-and-forget.
 */
export function sendInBackground(task: () => Promise<unknown>) {
  const run = () =>
    task().catch((error: unknown) => {
      console.error(
        "[email] background task failed",
        error instanceof Error ? error.message : error,
      );
    });
  try {
    after(run);
  } catch {
    void run();
  }
}
