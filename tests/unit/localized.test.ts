import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fillPlaceholders, localized } from "../../src/lib/utils";

describe("localized (translatable DB text → one language)", () => {
  it("picks the requested language", () => {
    assert.equal(localized({ da: "Hej", en: "Hello" }, "da"), "Hej");
    assert.equal(localized({ da: "Hej", en: "Hello" }, "en"), "Hello");
  });

  it("falls back to the other language when the requested one is missing, empty or blank", () => {
    assert.equal(localized({ da: "Hej" }, "en"), "Hej");
    assert.equal(localized({ en: "Hello" }, "da"), "Hello");
    assert.equal(localized({ da: "Hej", en: "" }, "en"), "Hej");
    assert.equal(localized({ da: "", en: "Hello" }, "da"), "Hello");
    assert.equal(localized({ da: "Hej", en: "  \n\t " }, "en"), "Hej");
    assert.equal(localized({ da: "   ", en: "Hello" }, "da"), "Hello");
  });

  it("prefers Danish, then English, for an unknown locale", () => {
    assert.equal(localized({ da: "Hej", en: "Hello" }, "de"), "Hej");
    assert.equal(localized({ da: " ", en: "Hello" }, "de"), "Hello");
  });

  it("trims the text it returns, keeping inner line breaks", () => {
    assert.equal(localized({ da: "  Første.\n\nAnden.  " }, "da"), "Første.\n\nAnden.");
  });

  it("returns an empty string when nothing usable is there", () => {
    assert.equal(localized({ da: "", en: " " }, "da"), "");
    assert.equal(localized({}, "en"), "");
    assert.equal(localized(null, "en"), "");
    assert.equal(localized("Hello", "en"), "");
    assert.equal(localized({ da: 42, en: null }, "en"), "");
  });
});

describe("fillPlaceholders (admin-edited texts with {name} slots)", () => {
  it("fills known placeholders, every occurrence", () => {
    assert.equal(
      fillPlaceholders("Trusted by {count} clinics", { count: "12" }),
      "Trusted by 12 clinics",
    );
    assert.equal(fillPlaceholders("{name} and {name}", { name: "Hossam" }), "Hossam and Hossam");
  });

  it("leaves unknown placeholders and plain text as typed", () => {
    assert.equal(fillPlaceholders("Contact {nmae}", { name: "Hossam" }), "Contact {nmae}");
    assert.equal(fillPlaceholders("No slots here", { count: "3" }), "No slots here");
  });
});
