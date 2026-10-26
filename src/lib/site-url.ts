// The site's origins. Pure, unit-tested.

/**
 * NEXT_PUBLIC_SITE_URL's origin plus its www / apex twin (https://dentnord.dk ↔
 * https://www.dentnord.dk), for Better Auth's trustedOrigins: a form posted from either host is
 * accepted, whichever one Vercel serves as primary. Only for an https apex (two labels) or a www host;
 * localhost and preview hosts (*.vercel.app) get no twin.
 */
export function siteOrigins(siteUrl: string) {
  const url = new URL(siteUrl);
  const origins = [url.origin];
  if (url.protocol !== "https:") return origins;
  const port = url.port ? `:${url.port}` : "";
  const host = url.hostname;
  if (host.startsWith("www.")) origins.push(`https://${host.slice(4)}${port}`);
  else if (host.split(".").length === 2) origins.push(`https://www.${host}${port}`);
  return origins;
}
