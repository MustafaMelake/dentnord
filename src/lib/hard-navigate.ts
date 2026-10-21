/**
 * Full page load, for auth transitions (login, logout, password reset, sign-out everywhere). The
 * session cookie just changed, the target may be another root layout (/admin), and every
 * session-dependent server component must render fresh, so a client-side router push isn't enough.
 */
export function hardNavigate(path: string) {
  window.location.assign(path);
}
