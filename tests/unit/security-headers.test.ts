import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contentSecurityPolicy,
  httpsOrigin,
  r2BucketOrigins,
  securityHeaders,
  type SecurityHeaderInput,
} from "../../src/lib/security-headers";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const prod: SecurityHeaderInput = {
  dev: false,
  siteUrl: "https://dentnord.dk",
  r2AccountId: ACCOUNT,
  r2Jurisdiction: "eu",
  r2Buckets: ["dentnord-cases", "dentnord-media"],
  mediaPublicUrl: "https://media.dentnord.dk/images",
};

/** directive name → its sources */
function directives(policy: string) {
  return new Map(
    policy.split("; ").map((d) => {
      const [name, ...values] = d.split(" ");
      return [name, values] as const;
    }),
  );
}

describe("content security policy", () => {
  it("allows exactly our origin, the two R2 buckets and the media origin", () => {
    const csp = directives(contentSecurityPolicy(prod));
    assert.deepEqual(csp.get("default-src"), ["'self'"]);
    assert.deepEqual(csp.get("connect-src"), [
      "'self'",
      "blob:",
      "data:",
      `https://dentnord-cases.${ACCOUNT}.eu.r2.cloudflarestorage.com`,
      `https://dentnord-media.${ACCOUNT}.eu.r2.cloudflarestorage.com`,
    ]);
    assert.deepEqual(csp.get("img-src"), ["'self'", "data:", "blob:", "https://media.dentnord.dk"]);
    assert.deepEqual(csp.get("worker-src"), ["'self'", "blob:"]);
    assert.ok(csp.get("script-src")?.includes("'wasm-unsafe-eval'"), "Draco needs WebAssembly");
    assert.ok(!csp.get("script-src")?.includes("'unsafe-eval'"), "no eval in production");
  });

  it("forbids framing, plugins, foreign forms and <base>", () => {
    const csp = directives(contentSecurityPolicy(prod));
    assert.deepEqual(csp.get("frame-ancestors"), ["'none'"]);
    assert.deepEqual(csp.get("object-src"), ["'none'"]);
    assert.deepEqual(csp.get("form-action"), ["'self'"]);
    assert.deepEqual(csp.get("base-uri"), ["'self'"]);
    assert.deepEqual(csp.get("frame-src"), ["'none'"]);
  });

  it("upgrades insecure requests only on an https production site", () => {
    assert.match(contentSecurityPolicy(prod), /upgrade-insecure-requests$/);
    const local = contentSecurityPolicy({ ...prod, siteUrl: "http://localhost:3000" });
    assert.doesNotMatch(local, /upgrade-insecure-requests/);
    assert.doesNotMatch(contentSecurityPolicy({ ...prod, dev: true }), /upgrade-insecure-requests/);
  });

  it("adds eval for React's dev tooling in development only", () => {
    const csp = directives(contentSecurityPolicy({ ...prod, dev: true }));
    assert.ok(csp.get("script-src")?.includes("'unsafe-eval'"));
  });

  it("allows the Vercel toolbar on preview deployments only", () => {
    assert.doesNotMatch(contentSecurityPolicy(prod), /vercel\.live/);
    const csp = directives(contentSecurityPolicy({ ...prod, vercelPreview: true }));
    assert.ok(csp.get("script-src")?.includes("https://vercel.live"));
    assert.deepEqual(csp.get("frame-src"), ["https://vercel.live"]);
  });

  it("drops anything that isn't a valid R2 account, bucket name or https URL", () => {
    assert.deepEqual(r2BucketOrigins("not-an-account", "eu", ["dentnord-cases"]), []);
    assert.deepEqual(r2BucketOrigins(undefined, "eu", ["dentnord-cases"]), []);
    assert.deepEqual(r2BucketOrigins(ACCOUNT, "eu", ["Bad_Bucket", "x; script-src *"]), []);
    assert.deepEqual(r2BucketOrigins(ACCOUNT, "default", ["a-bucket"]), [
      `https://a-bucket.${ACCOUNT}.r2.cloudflarestorage.com`,
    ]);
    assert.equal(httpsOrigin("http://media.example"), null);
    assert.equal(httpsOrigin("not a url"), null);
    const csp = directives(
      contentSecurityPolicy({ ...prod, r2AccountId: undefined, mediaPublicUrl: undefined }),
    );
    assert.deepEqual(csp.get("connect-src"), ["'self'", "blob:", "data:"]);
    assert.deepEqual(csp.get("img-src"), ["'self'", "data:", "blob:"]);
  });
});

describe("security headers", () => {
  const byKey = (input: SecurityHeaderInput) =>
    Object.fromEntries(securityHeaders(input).map((h) => [h.key, h.value]));

  it("sends the hardening headers", () => {
    const h = byKey(prod);
    assert.equal(h["X-Frame-Options"], "DENY");
    assert.equal(h["X-Content-Type-Options"], "nosniff");
    assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.equal(h["Permissions-Policy"], "camera=(), microphone=(), geolocation=()");
    assert.equal(h["Strict-Transport-Security"], "max-age=63072000; includeSubDomains");
    assert.ok(h["Content-Security-Policy"]);
    assert.equal(h["Content-Security-Policy-Report-Only"], undefined);
  });

  it("can report instead of enforce, and skips HSTS in development", () => {
    const reportOnly = byKey({ ...prod, reportOnly: true });
    assert.ok(reportOnly["Content-Security-Policy-Report-Only"]);
    assert.equal(reportOnly["Content-Security-Policy"], undefined);
    assert.equal(byKey({ ...prod, dev: true })["Strict-Transport-Security"], undefined);
  });
});
