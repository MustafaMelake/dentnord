// Maps a Better Auth client error to a key in `auth.errors`. Messages from the server are never shown
// as-is: they're English, and some (e.g. "User already exists") would reveal whether an account exists.

export type AuthErrorKey =
  | "generic"
  | "network"
  | "rateLimited"
  | "invalidCredentials"
  | "accountRejected"
  | "registrationFailed"
  | "invalidRegistration";

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
