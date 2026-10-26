import { r2Endpoint, type R2Jurisdiction } from "./r2-endpoint";

// Response headers for every route (next.config.ts `headers()`, computed at build time). Pure, so the
// unit tests can check the policy; imported with a relative path because next.config.ts can't use
// the "@/" alias.
//
// Why no nonces: a nonce-based CSP needs a fresh nonce per request, so every page would have to render
// dynamically, and Cache Components' prerendered shells (and the CDN caching them) would be lost.
// Next.js inlines its RSC payload as <script> tags, so a static CSP needs 'unsafe-inline' in
// script-src. What still holds: scripts only from our origin, no plugins/<base>/foreign forms, no
// framing, and fetches only to our origin and our own R2 buckets (which limits exfiltration).

export type SecurityHeaderInput = {
  /** `next dev`: React needs eval for its dev tooling; no HSTS or upgrades on localhost. */
  dev: boolean;
  /** NEXT_PUBLIC_SITE_URL. An https site gets `upgrade-insecure-requests`. */
  siteUrl?: string;
  /** R2 account + jurisdiction: the browser PUTs upload parts to and fetches 3D files from R2. */
  r2AccountId?: string;
  r2Jurisdiction?: R2Jurisdiction;
  /** Buckets the browser talks to directly (cases: parts + 3D viewer GETs; media: admin image PUT). */
  r2Buckets?: string[];
  /** R2_MEDIA_PUBLIC_URL: public site images (normally through /_next/image, but allowed directly). */
  mediaPublicUrl?: string;
  /** Vercel preview deployments load the Vercel toolbar (comments) from vercel.live. */
  vercelPreview?: boolean;
  /** Report violations without blocking (Content-Security-Policy-Report-Only). */
  reportOnly?: boolean;
};

const BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/** https://<bucket>.<account>.<jurisdiction>.r2.cloudflarestorage.com for each valid bucket name. */
export function r2BucketOrigins(
  accountId: string | undefined,
  jurisdiction: R2Jurisdiction = "eu",
  buckets: string[] = [],
) {
  if (!accountId) return [];
  let endpoint: URL;
  try {
    endpoint = new URL(r2Endpoint(accountId, jurisdiction));
  } catch {
    return []; // not a real account id: uploads are "not configured" anyway (lib/r2.ts)
  }
  // Presigned URLs are virtual-hosted style: the bucket is a subdomain of the account endpoint.
  return [...new Set(buckets.filter((b) => BUCKET_NAME.test(b)))].map(
    (bucket) => `https://${bucket}.${endpoint.host}`,
  );
}

/** The origin of an https URL, or null. */
export function httpsOrigin(raw: string | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(input: SecurityHeaderInput) {
  const r2 = r2BucketOrigins(input.r2AccountId, input.r2Jurisdiction, input.r2Buckets);
  const media = httpsOrigin(input.mediaPublicUrl);
  const vercel = !!input.vercelPreview;
  const upgrade = !input.dev && httpsOrigin(input.siteUrl) !== null;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-inline': Next's inline RSC payload (see above). 'wasm-unsafe-eval': the Draco decoder
    // (public/draco) compiles WebAssembly. Dev only: 'unsafe-eval' for React's dev tooling.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      "'wasm-unsafe-eval'",
      ...(input.dev ? ["'unsafe-eval'"] : []),
      ...(vercel ? ["https://vercel.live"] : []),
    ],
    // Inline style attributes (motion, Lenis, three's canvas, next/font).
    "style-src": ["'self'", "'unsafe-inline'"],
    // data: next/image blur placeholders and SVG data URLs (2FA QR code); blob: local previews
    // (admin image picker) and textures decoded by three.js.
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      ...(media ? [media] : []),
      ...(vercel ? ["https://vercel.live", "https://vercel.com"] : []),
    ],
    "font-src": ["'self'", ...(vercel ? ["https://vercel.live", "https://assets.vercel.com"] : [])],
    // R2: multipart part PUTs, the admin's image PUT and the 3D viewer's signed GETs.
    // blob:/data: three.js loaders fetch embedded GLB buffers and textures through these.
    "connect-src": [
      "'self'",
      "blob:",
      "data:",
      ...r2,
      ...(vercel ? ["https://vercel.live", "wss://ws-us3.pusher.com"] : []),
    ],
    // three's DRACOLoader runs the decoder in a worker created from a blob: URL.
    "worker-src": ["'self'", "blob:"],
    // Nothing is embedded. (Dev: Next's tooling may frame its own pages.)
    "frame-src": vercel ? ["https://vercel.live"] : input.dev ? ["'self'"] : ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    // Ignored in Report-Only mode: X-Frame-Options covers framing there.
    "frame-ancestors": ["'none'"],
  };

  return [
    ...Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`),
    ...(upgrade ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function securityHeaders(input: SecurityHeaderInput) {
  return [
    {
      key: input.reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
      value: contentSecurityPolicy(input),
    },
    // Clickjacking (/admin in particular): also in CSP frame-ancestors, this covers older browsers
    // and Report-Only mode.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    // Two years. Browsers ignore it over plain http (local production builds).
    ...(input.dev
      ? []
      : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  ];
}
