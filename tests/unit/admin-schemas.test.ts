import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accountsSchema,
  bilingualRequired,
  contactSchema,
  implantSystemSchema,
  mediaUploadSchema,
  portfolioSchema,
  priceSchema,
  serviceSchema,
  slugify,
  statsSchema,
  testimonialSchema,
} from "../../src/lib/validation/admin";

const issue = (
  result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  path: string,
) => result.error?.issues.find((i) => i.path.join(".") === path)?.message;

describe("priceSchema", () => {
  it("turns Danish kroner into øre", () => {
    assert.deepEqual(priceSchema.parse({ onRequest: false, amount: "1 250,50", from: true }), {
      priceAmount: 125_050,
      priceFrom: true,
    });
  });

  it("'price on request' stores null and ignores the amount", () => {
    assert.deepEqual(priceSchema.parse({ onRequest: true, amount: "garbage", from: true }), {
      priceAmount: null,
      priceFrom: false,
    });
  });

  it("needs a valid amount unless on request", () => {
    assert.equal(
      issue(priceSchema.safeParse({ onRequest: false, amount: "", from: false }), "amount"),
      "priceRequired",
    );
    assert.equal(
      issue(priceSchema.safeParse({ onRequest: false, amount: "12,345", from: false }), "amount"),
      "priceInvalid",
    );
  });
});

describe("serviceSchema", () => {
  const base = {
    title: { da: "Boreskabelon", en: "" },
    summary: { da: "", en: "" },
    description: { da: "", en: "" },
    price: { onRequest: true, amount: "", from: false },
    priceNote: { da: "", en: "" },
    imageId: null,
    published: true,
  };

  it("accepts a title in one language (the other falls back)", () => {
    assert.ok(serviceSchema.safeParse(base).success);
  });

  it("needs a title in at least one language", () => {
    const result = serviceSchema.safeParse({ ...base, title: { da: " ", en: "" } });
    assert.equal(issue(result, "title"), "requiredOneLanguage");
  });
});

describe("bilingualRequired", () => {
  it("trims and limits length", () => {
    const schema = bilingualRequired(5);
    assert.deepEqual(schema.parse({ da: "  hej ", en: "" }), { da: "hej", en: "" });
    assert.equal(issue(schema.safeParse({ da: "for lang", en: "" }), "da"), "tooLong");
  });
});

describe("testimonialSchema", () => {
  const base = {
    quote: { da: "Fint", en: "" },
    authorName: "Anne",
    clinic: "",
    consent: false,
    published: false,
  };

  it("can't be published without written consent", () => {
    assert.equal(
      issue(testimonialSchema.safeParse({ ...base, published: true }), "published"),
      "consentRequired",
    );
    assert.ok(testimonialSchema.safeParse({ ...base, consent: true, published: true }).success);
  });

  it("can be saved as a draft without consent", () => {
    assert.ok(testimonialSchema.safeParse(base).success);
  });
});

describe("portfolioSchema", () => {
  const base = {
    slug: "full-arch-aalborg",
    title: { da: "", en: "Full arch" },
    summary: { da: "", en: "" },
    guideTypeId: null,
    implantCount: "4",
    images: [],
    published: false,
  };

  it("parses the implant count and allows it empty", () => {
    assert.equal(portfolioSchema.parse(base).implantCount, 4);
    assert.equal(portfolioSchema.parse({ ...base, implantCount: "" }).implantCount, null);
    assert.equal(
      issue(portfolioSchema.safeParse({ ...base, implantCount: "4.5" }), "implantCount"),
      "wholeNumber",
    );
  });

  it("only allows URL-safe slugs", () => {
    for (const slug of ["Full Arch", "full--arch", "-arch", "arch-", "æble"]) {
      assert.equal(
        issue(portfolioSchema.safeParse({ ...base, slug }), "slug"),
        "slugInvalid",
        slug,
      );
    }
  });
});

describe("slugify", () => {
  it("makes Danish titles URL-safe", () => {
    assert.equal(slugify("Guidet helkæbe: Århus 2026"), "guidet-helkaebe-aarhus-2026");
    assert.equal(slugify("  Ø-implantat / Bone level  "), "oe-implantat-bone-level");
    assert.equal(slugify("!!!"), "");
  });
});

describe("implantSystemSchema", () => {
  const base = {
    brand: "Straumann",
    line: "BLX",
    diameters: [4, 3.75, 4],
    lengths: [10, 8],
    active: true,
  };

  it("sorts and de-duplicates sizes", () => {
    const parsed = implantSystemSchema.parse(base);
    assert.deepEqual(parsed.diameters, [3.75, 4]);
    assert.deepEqual(parsed.lengths, [8, 10]);
  });

  it("rejects implausible sizes and more than two decimals", () => {
    assert.ok(!implantSystemSchema.safeParse({ ...base, diameters: [12] }).success);
    assert.ok(!implantSystemSchema.safeParse({ ...base, lengths: [1] }).success);
    assert.ok(!implantSystemSchema.safeParse({ ...base, diameters: [3.755] }).success);
  });
});

describe("settings schemas", () => {
  it("an empty number means hidden (null)", () => {
    assert.deepEqual(
      statsSchema.parse({
        clinics: "",
        yearsExperience: "12",
        guidesDelivered: "",
        turnaroundDays: "5",
      }),
      {
        clinics: null,
        yearsExperience: 12,
        guidesDelivered: null,
        turnaroundDays: 5,
      },
    );
    assert.equal(accountsSchema.parse({ reviewDays: "" }).reviewDays, null);
    assert.ok(
      !statsSchema.safeParse({
        clinics: "-3",
        yearsExperience: "",
        guidesDelivered: "",
        turnaroundDays: "",
      }).success,
    );
  });

  it("contact fields are optional but validated when filled", () => {
    const empty = { email: "", phone: "", address: { da: "", en: "" }, cvr: "" };
    assert.ok(contactSchema.safeParse(empty).success);
    assert.equal(issue(contactSchema.safeParse({ ...empty, cvr: "1234" }), "cvr"), "cvrInvalid");
    assert.equal(
      issue(contactSchema.safeParse({ ...empty, email: "nope" }), "email"),
      "emailInvalid",
    );
  });
});

describe("mediaUploadSchema", () => {
  const base = {
    fileName: "a.webp",
    contentType: "image/webp",
    sizeBytes: 1000,
    width: 800,
    height: 600,
  };

  it("allows jpg/png/webp/avif up to 10 MB", () => {
    for (const contentType of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
      assert.ok(mediaUploadSchema.safeParse({ ...base, contentType }).success, contentType);
    }
    assert.ok(mediaUploadSchema.safeParse({ ...base, sizeBytes: 10 * 1024 * 1024 }).success);
  });

  it("rejects other types and larger files", () => {
    assert.equal(
      issue(mediaUploadSchema.safeParse({ ...base, contentType: "image/svg+xml" }), "contentType"),
      "imageType",
    );
    assert.equal(
      issue(mediaUploadSchema.safeParse({ ...base, contentType: "text/html" }), "contentType"),
      "imageType",
    );
    assert.equal(
      issue(mediaUploadSchema.safeParse({ ...base, sizeBytes: 10 * 1024 * 1024 + 1 }), "sizeBytes"),
      "imageTooLarge",
    );
  });
});
