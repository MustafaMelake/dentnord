import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertMediaUnused,
  buildDentistUsage,
  findMediaUsages,
  MediaInUseError,
  R2_FREE_TIER_BYTES,
  usageShare,
} from "../../src/lib/storage-usage";

const GB = 1024 ** 3;

describe("usageShare", () => {
  it("gives the share of the allowance, clamped for the bar", () => {
    assert.deepEqual(usageShare(2.5 * GB, R2_FREE_TIER_BYTES), {
      ratio: 0.25,
      percent: 25,
      over: false,
    });
    assert.deepEqual(usageShare(0, R2_FREE_TIER_BYTES), { ratio: 0, percent: 0, over: false });
    assert.deepEqual(usageShare(15 * GB, R2_FREE_TIER_BYTES), {
      ratio: 1,
      percent: 150,
      over: true,
    });
  });

  it("accepts BigInt sizes (CaseFile.sizeBytes) and rounds to one decimal", () => {
    assert.equal(usageShare(BigInt(GB), 3 * GB).percent, 33.3);
    assert.equal(usageShare(BigInt(10 * GB), R2_FREE_TIER_BYTES).over, false);
  });

  it("treats a zero limit as nothing used", () => {
    assert.deepEqual(usageShare(100, 0), { ratio: 0, percent: 0, over: true });
  });
});

describe("buildDentistUsage", () => {
  const dentists = {
    anna: { name: "Anna", clinic: "Klinik A" },
    bo: { name: "Bo", clinic: null },
    cara: { name: "Cara", clinic: "Klinik C" },
  };

  it("sums each dentist's cases, adds their quota usage and sorts the largest first", () => {
    const rows = buildDentistUsage({
      byCase: [
        { caseId: "c1", bytes: BigInt(3 * GB), files: 4 },
        { caseId: "c2", bytes: BigInt(1 * GB), files: 2 },
        { caseId: "c3", bytes: BigInt(5 * GB), files: 1 },
      ],
      caseDentist: { c1: "anna", c2: "anna", c3: "bo" },
      quotaByDentist: { anna: BigInt(3.5 * GB), bo: BigInt(5 * GB), cara: BigInt(GB) },
      dentists,
    });
    assert.deepEqual(
      rows.map((r) => [r.dentistId, r.storedBytes / GB, r.fileCount, r.quotaBytes / GB]),
      [
        ["bo", 5, 1, 5],
        ["anna", 4, 6, 3.5],
        // Only uploads in flight: no stored files yet, still listed against the cap.
        ["cara", 0, 0, 1],
      ],
    );
    assert.equal(rows[1].clinic, "Klinik A");
  });

  it("ignores cases without a known dentist and quota rows of non-dentists (the lab)", () => {
    const rows = buildDentistUsage({
      byCase: [{ caseId: "gone", bytes: 10, files: 1 }],
      caseDentist: {},
      quotaByDentist: { admin: BigInt(GB) },
      dentists,
    });
    assert.deepEqual(rows, []);
  });
});

describe("findMediaUsages", () => {
  const base = { services: [], portfolioImages: [], settings: [] };

  it("finds every kind of reference, with a link to where it's edited", () => {
    const usages = findMediaUsages({
      mediaIds: ["m1", "m2", "m3", "m4", "free"],
      services: [{ id: "s1", title: "Surgical guide", imageId: "m1" }],
      portfolioImages: [
        { mediaId: "m2", caseId: "p1", caseTitle: "Full arch" },
        // The same image twice in one gallery is listed once.
        { mediaId: "m2", caseId: "p1", caseTitle: "Full arch" },
      ],
      settings: [
        { key: "images", value: { heroId: "m3", technologyId: null } },
        { key: "doctor", value: { name: "Dr. H", portraitId: "m4", cardPhotoId: "m3" } },
        { key: "page.about", value: { imageId: null, title: { da: "m1", en: "x" } } },
      ],
    });
    assert.deepEqual(usages.get("m1"), [
      { type: "service", id: "s1", title: "Surgical guide", href: "/admin/services/s1" },
      // Any string equal to an id counts, even in an unknown place: deletion stays blocked.
      {
        type: "setting",
        slot: "other",
        key: "page.about",
        path: "title.da",
        href: "/admin/settings",
      },
    ]);
    assert.deepEqual(usages.get("m2"), [
      { type: "portfolio", id: "p1", title: "Full arch", href: "/admin/portfolio/p1" },
    ]);
    assert.deepEqual(
      usages.get("m3")?.map((u) => (u.type === "setting" ? `${u.slot} ${u.href}` : u.type)),
      ["hero /admin/settings?tab=images", "cardPhoto /admin/settings?tab=doctor"],
    );
    assert.deepEqual(
      usages.get("m4")?.map((u) => (u.type === "setting" ? u.slot : u.type)),
      ["portrait"],
    );
    assert.deepEqual(usages.get("free"), []);
  });

  it("covers the Services and About page images and images inside arrays", () => {
    const usages = findMediaUsages({
      ...base,
      mediaIds: ["a", "b", "c"],
      settings: [
        { key: "page.services", value: { imageId: "a" } },
        { key: "page.about", value: { imageId: "b" } },
        { key: "future", value: { gallery: [{ mediaId: "c" }] } },
      ],
    });
    assert.equal(usages.get("a")?.[0]?.href, "/admin/pages/services");
    assert.equal(usages.get("b")?.[0]?.href, "/admin/pages/about");
    assert.deepEqual(usages.get("c"), [
      {
        type: "setting",
        slot: "other",
        key: "future",
        path: "gallery.0.mediaId",
        href: "/admin/settings",
      },
    ]);
  });

  it("only reports the ids asked about", () => {
    const usages = findMediaUsages({
      ...base,
      mediaIds: ["a"],
      services: [{ id: "s", title: "S", imageId: "other" }],
    });
    assert.deepEqual([...usages.keys()], ["a"]);
    assert.deepEqual(usages.get("a"), []);
  });
});

describe("assertMediaUnused (the delete guard)", () => {
  it("refuses an image that is in use", () => {
    const usages = findMediaUsages({
      mediaIds: ["hero"],
      services: [],
      portfolioImages: [],
      settings: [{ key: "images", value: { heroId: "hero" } }],
    });
    assert.throws(
      () => assertMediaUnused(usages.get("hero")),
      (error) => error instanceof MediaInUseError && error.usages.length === 1,
    );
  });

  it("allows an image nothing uses", () => {
    assert.doesNotThrow(() => assertMediaUnused([]));
    assert.doesNotThrow(() => assertMediaUnused(undefined));
  });
});
