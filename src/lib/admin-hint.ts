/**
 * `dn_admin=1`: a readable hint that this browser belongs to an admin, so the public site can show
 * "missing content" markers (components/shared/missing-marker.tsx) without reading the session on
 * every (static, cached) public page. Set by the proxy after a DB-checked role check on /admin;
 * cleared on logout and whenever a non-admin opens /admin.
 * Not a security boundary: the markers only name which public fields are still empty.
 */
export const ADMIN_HINT_COOKIE = "dn_admin";

/** Client only. */
export function hasAdminHint() {
  return document.cookie.split("; ").some((c) => c === `${ADMIN_HINT_COOKIE}=1`);
}

/** Client only. */
export function clearAdminHint() {
  document.cookie = `${ADMIN_HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
