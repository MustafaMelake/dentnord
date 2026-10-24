import { z } from "zod";

// Case messages: plain text only (rendered as text, never as HTML or markdown), at most 5,000
// characters. Authors can edit or delete their own message for 5 minutes.

export const MESSAGE_MAX_LENGTH = 5000;
export const MESSAGE_EDIT_WINDOW_MS = 5 * 60 * 1000;

/** Control characters other than tab and newline (e.g. NUL, bell, escape) are refused. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const messageBodySchema = z
  .string()
  .transform((v) => v.replace(/\r\n?/g, "\n").trim())
  .pipe(
    z
      .string()
      .min(1, { error: "required" })
      .max(MESSAGE_MAX_LENGTH, { error: "tooLong" })
      .refine((v) => !CONTROL.test(v), { error: "messageInvalid" }),
  );

/** May the author still edit or delete this message? */
export function withinEditWindow(createdAt: Date | string, now: Date = new Date()) {
  return now.getTime() - new Date(createdAt).getTime() <= MESSAGE_EDIT_WINDOW_MS;
}
