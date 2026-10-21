import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth-options";

// Shared by the browser forms (react-hook-form + zodResolver), the Better Auth sign-up hook and the
// Server Actions, so client and server validate exactly the same way. Error messages are keys in the
// `validation` namespace of messages/*.json; forms translate them with `t(\`validation.${message}\`)`.

export const LOCALES = ["da", "en"] as const;

/** ISO 3166-1 alpha-2. Labels come from `Intl.DisplayNames`, so no country names live in code. */
export const COUNTRIES = [
  "DK",
  "SE",
  "NO",
  "FI",
  "IS",
  "DE",
  "NL",
  "BE",
  "LU",
  "FR",
  "GB",
  "IE",
  "AT",
  "CH",
  "PL",
  "CZ",
  "SK",
  "HU",
  "SI",
  "HR",
  "IT",
  "ES",
  "PT",
  "GR",
  "CY",
  "MT",
  "EE",
  "LV",
  "LT",
  "RO",
  "BG",
] as const;

export const DEFAULT_COUNTRY = "DK";

const requiredText = (max: number) =>
  z.string().trim().min(1, { error: "required" }).max(max, { error: "tooLong" });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: "required" })
  .max(254, { error: "tooLong" })
  .pipe(z.email({ error: "emailInvalid" }));

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: "passwordTooShort" })
  .max(PASSWORD_MAX_LENGTH, { error: "passwordTooLong" });

const profileFields = z.object({
  name: requiredText(120),
  clinicName: requiredText(160),
  phone: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .regex(/^\+?[0-9][0-9 ()-]{5,22}$/, { error: "phoneInvalid" }),
  country: z.enum(COUNTRIES, { error: "required" }),
  address: requiredText(300),
  // CVR (8 digits, Denmark) or a VAT number elsewhere. Optional.
  cvr: z
    .string()
    .trim()
    .max(20, { error: "tooLong" })
    .regex(/^[A-Za-z0-9 .-]*$/, { error: "cvrInvalid" })
    .optional()
    .transform((value) => value || undefined),
  preferredLocale: z.enum(LOCALES),
});

/** A Danish CVR number is 8 digits. */
const cvrMatchesCountry = ({ country, cvr }: { country: string; cvr?: string }) =>
  country !== "DK" || !cvr || /^\d{8}$/.test(cvr.replace(/\s/g, ""));

const cvrRule = { error: "cvrInvalid", path: ["cvr"] };

/** Clinic profile: editable later on the Account page (not email, role or status). */
export const profileSchema = profileFields.refine(cvrMatchesCountry, cvrRule);

export type ProfileInput = z.input<typeof profileSchema>;

const registerFields = profileFields.extend({
  email: emailSchema,
  password: newPasswordSchema,
  // Must be exactly `true` (a checkbox); anything else fails.
  acceptTerms: z
    .boolean({ error: "termsRequired" })
    .refine((v) => v === true, { error: "termsRequired" }),
});

/** What reaches the server at sign-up (validated again in the Better Auth `hooks.before`). */
export const registerSchema = registerFields.refine(cvrMatchesCountry, cvrRule);

export type RegisterInput = z.output<typeof registerSchema>;

/** The registration form: the server payload plus a password confirmation. */
export const registerFormSchema = registerFields
  .extend({ confirmPassword: z.string() })
  .refine(cvrMatchesCountry, cvrRule)
  .refine((v) => v.password === v.confirmPassword, {
    error: "passwordsDontMatch",
    path: ["confirmPassword"],
  });

export type RegisterFormInput = z.input<typeof registerFormSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "required" }).max(PASSWORD_MAX_LENGTH, { error: "tooLong" }),
});

export type LoginInput = z.input<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    error: "passwordsDontMatch",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "required" }),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: "passwordsDontMatch",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    error: "passwordUnchanged",
    path: ["newPassword"],
  });
