import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { localizedSitemap, PUBLIC_PATHS, ROBOTS_DISALLOW } from "../../src/lib/seo";
import { siteOrigins } from "../../src/lib/site-url";

describe("sitemap", () => {
  const entries = localizedSitemap("https://dentnord.dk/", ["", "/services"], ["da", "en"], "da");

  it("lists every page once per locale", () => {
    assert.deepEqual(
      entries.map((e) => e.url),
      [
        "https://dentnord.dk/da",
        "https://dentnord.dk/en",
        "https://dentnord.dk/da/services",
        "https://dentnord.dk/en/services",
      ],
    );
  });

  it("gives every URL all its language versions plus x-default", () => {
    for (const entry of entries.slice(2)) {
      assert.deepEqual(entry.alternates?.languages, {
        da: "https://dentnord.dk/da/services",
        en: "https://dentnord.dk/en/services",
        "x-default": "https://dentnord.dk/da/services",
      });
    }
  });

  it("covers the public pages and nothing private", () => {
    const all = localizedSitemap("https://dentnord.dk", PUBLIC_PATHS, ["da", "en"], "da");
    assert.equal(all.length, PUBLIC_PATHS.length * 2);
    assert.ok(all.every((e) => !/\/(admin|portal|api)(\/|$)/.test(new URL(e.url).pathname)));
  });

  it("keeps crawlers out of the admin, the portals and the API", () => {
    assert.deepEqual([...ROBOTS_DISALLOW], ["/admin", "/*/portal", "/api"]);
  });
});

describe("site origins (Better Auth trustedOrigins)", () => {
  it("adds the www / apex twin of an https site", () => {
    assert.deepEqual(siteOrigins("https://dentnord.dk"), [
      "https://dentnord.dk",
      "https://www.dentnord.dk",
    ]);
    assert.deepEqual(siteOrigins("https://www.dentnord.dk/da"), [
      "https://www.dentnord.dk",
      "https://dentnord.dk",
    ]);
  });

  it("adds nothing for localhost or preview hosts", () => {
    assert.deepEqual(siteOrigins("http://localhost:3000"), ["http://localhost:3000"]);
    assert.deepEqual(siteOrigins("https://dentnord.vercel.app"), ["https://dentnord.vercel.app"]);
  });
});
