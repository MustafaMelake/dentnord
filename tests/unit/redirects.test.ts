import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { postLoginPath, safeNextPath } from "../../src/lib/redirects";

describe("safeNextPath", () => {
  it("keeps same-origin paths with query and hash", () => {
    assert.equal(safeNextPath("/da/portal/cases?page=2#top"), "/da/portal/cases?page=2#top");
    assert.equal(safeNextPath("/admin"), "/admin");
  });

  it("rejects anything that could leave the site", () => {
    for (const next of [
      "https://evil.example",
      "//evil.example/da/portal",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "da/portal",
      "/da/portal\nLocation: https://evil.example",
      "",
      null,
      undefined,
    ]) {
      assert.equal(safeNextPath(next), null, String(next));
    }
  });
});

describe("postLoginPath", () => {
  const admin = { role: "ADMIN", dentistStatus: "APPROVED" };
  const approved = { role: "DENTIST", dentistStatus: "APPROVED" };
  const pending = { role: "DENTIST", dentistStatus: "PENDING" };

  it("sends admins to /admin, honouring an /admin `next`", () => {
    assert.equal(postLoginPath(admin, "da"), "/admin");
    assert.equal(
      postLoginPath(admin, "da", "/admin/dentists?status=pending"),
      "/admin/dentists?status=pending",
    );
    assert.equal(postLoginPath(admin, "da", "/da/portal/cases"), "/admin");
  });

  it("sends approved dentists to their portal, honouring a portal `next`", () => {
    assert.equal(postLoginPath(approved, "da"), "/da/portal/dashboard");
    assert.equal(postLoginPath(approved, "en", "/en/portal/cases/abc"), "/en/portal/cases/abc");
    assert.equal(postLoginPath(approved, "da", "/admin"), "/da/portal/dashboard");
    assert.equal(postLoginPath(approved, "da", "https://evil.example"), "/da/portal/dashboard");
  });

  it("sends pending dentists to the status page, ignoring `next`", () => {
    assert.equal(postLoginPath(pending, "en", "/en/portal/dashboard"), "/en/pending-approval");
  });
});
