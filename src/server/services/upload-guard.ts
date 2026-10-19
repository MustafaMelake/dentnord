import "server-only";

import { auth } from "@/lib/auth";

// Shared auth for /api/uploads/*. Route Handlers return 401 rather than redirecting.
// TODO: also verify the user owns the case (DENTIST) or is ADMIN, and that the CaseFile row
// matches the key/uploadId being signed.
export async function getUploadSession(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) return null;
  if (session.user.role === "DENTIST" && session.user.dentistStatus !== "APPROVED") return null;
  return session;
}

export const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });
export const notImplemented = () => Response.json({ error: "Not implemented" }, { status: 501 });
