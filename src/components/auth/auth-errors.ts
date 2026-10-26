// Maps a Better Auth client error to a key in `auth.errors`. Messages from the server are never shown
// as-is: they're English, and some (e.g. "User already exists") would reveal whether an account exists.

export type AuthErrorKey =
  | "generic"
  | "network"
  | "rateLimited"
  | "invalidCredentials"
  | "accountRejected"
  | "registrationFailed"
  | "invalidRegistration"
  | "emailNotVerified";

type ClientError = { status?: number; code?: string } | null | undefined;

export function authErrorKey(
  error: ClientError,
  context: "login" | "register" | "other" = "other",
): AuthErrorKey {
  if (!error) return "generic";
  if (error.status === 429) return "rateLimited";
  if (!error.status) return "network";
  switch (error.code) {
    case "ACCOUNT_REJECTED":
      return "accountRejected";
    case "INVALID_REGISTRATION":
      return "invalidRegistration";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "invalidCredentials";
    // EMAIL_VERIFICATION=on and the address isn't confirmed yet (a new link was just sent).
    case "EMAIL_NOT_VERIFIED":
      return "emailNotVerified";
  }
  if (
    context === "register" &&
    (error.status === 422 || error.code?.startsWith("USER_ALREADY_EXISTS"))
  ) {
    return "registrationFailed";
  }
  if (context === "login" && error.status === 401) return "invalidCredentials";
  return "generic";
}

/** Keys in `twoFactor.errors`, for the code step at login and the 2FA settings. */
export type TwoFactorErrorKey =
  | "generic"
  | "network"
  | "rateLimited"
  | "invalidCode"
  | "codeFormat"
  | "expired"
  | "locked"
  | "wrongPassword";

export function twoFactorErrorKey(error: ClientError): TwoFactorErrorKey {
  if (!error) return "generic";
  // Ten wrong codes in a row lock the account's 2FA for 15 minutes (Better Auth).
  if (error.code === "ACCOUNT_TEMPORARILY_LOCKED") return "locked";
  if (error.status === 429) return "rateLimited";
  if (!error.status) return "network";
  switch (error.code) {
    case "INVALID_CODE":
    case "INVALID_BACKUP_CODE":
      return "invalidCode";
    // The 10-minute login challenge ran out, or 5 wrong codes used it up: start the login again.
    case "INVALID_TWO_FACTOR_COOKIE":
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return "expired";
    case "INVALID_PASSWORD":
      return "wrongPassword";
  }
  return "generic";
}
