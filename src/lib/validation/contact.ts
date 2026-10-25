import { z } from "zod";

import { emailSchema } from "./auth";

// The public contact form (/contact). Shared by the form (react-hook-form) and the Server Action.
// Error messages are keys in the `validation` namespace.

export const CONTACT_MESSAGE_MAX_LENGTH = 5000;

const requiredText = (max: number) =>
  z.string().trim().min(1, { error: "required" }).max(max, { error: "tooLong" });

/** A Danish CPR number (ddmmyy-xxxx): patient data has no place in a contact message. */
export function looksLikeCprNumber(text: string) {
  return /(?<!\d)\d{6}[\s-]?\d{4}(?!\d)/.test(text);
}

export const contactFormSchema = z.object({
  name: requiredText(120),
  clinic: requiredText(160),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .max(32, { error: "tooLong" })
    .refine((v) => v === "" || /^\+?[0-9][0-9 ()-]{5,22}$/.test(v), { error: "phoneInvalid" }),
  message: z
    .string()
    .trim()
    .min(10, { error: "messageTooShort" })
    .max(CONTACT_MESSAGE_MAX_LENGTH, { error: "tooLong" })
    .refine((v) => !looksLikeCprNumber(v), { error: "noPatientData" }),
  /** Honeypot: hidden from people, filled in by bots. The action drops the message if it's set. */
  website: z.string().max(500).optional(),
});
export type ContactFormInput = z.input<typeof contactFormSchema>;
