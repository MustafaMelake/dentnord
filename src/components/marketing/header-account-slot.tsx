import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";

import { getSession } from "@/server/queries/session";

import { AccountControl, type HeaderUser } from "./header-account";

/**
 * Session-dependent part of the marketing header. Render inside <Suspense fallback={<AccountControl
 * user={null} />}>. A failed session lookup shows the signed-out control rather than taking the page
 * down: the header is not an access check.
 */
export async function HeaderAccountSlot() {
  // Request time only: prerendering stops here (Better Auth's expiry check reads `new Date()`), so
  // the static header shell keeps the fallback. Outside the try, so this is never caught.
  await connection();
  let user: HeaderUser | null = null;
  try {
    const session = await getSession();
    if (session) {
      const { name, email, role } = session.user;
      user = { name, email, role: role === "ADMIN" ? "ADMIN" : "DENTIST" };
    }
  } catch (error) {
    unstable_rethrow(error);
  }
  return <AccountControl user={user} />;
}
