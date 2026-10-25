import { unstable_rethrow } from "next/navigation";

import { getSession } from "@/server/queries/session";

import { AccountControl, type HeaderUser } from "./header-account";

/**
 * Session-dependent part of the marketing header. Render inside <Suspense fallback={<AccountControl
 * user={null} />}> (it reads request headers). A failed session lookup shows the signed-out control
 * rather than taking the page down: the header is not an access check.
 */
export async function HeaderAccountSlot() {
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
