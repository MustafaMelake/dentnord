import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PAGE_STARTERS } from "../../prisma/page-starters";
import {
  aboutPageSchema,
  contactPageSchema,
  PAGE_TEXT_FIELDS,
  servicesPageSchema,
} from "../../src/lib/validation/admin";
import { contactFormSchema, looksLikeCprNumber } from "../../src/lib/validation/contact";

const valid = {
  name: "Hanne Jensen",
  clinic: "Tandlægerne i Aalborg",
  email: "Hanne@Example.dk",
  phone: "",
  message: "A question about full-arch guides.",
};

const errorsOf = (input: unknown) => {
  const result = contactFormSchema.safeParse(input);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
};

describe("contact form", () => {
  it("accepts a normal message, phone optional, and normalises the email", () => {
    const parsed = contactFormSchema.parse(valid);
    assert.equal(parsed.email, "hanne@example.dk");
    assert.equal(parsed.phone, "");
    assert.equal(
      contactFormSchema.parse({ ...valid, phone: "+45 12 34 56 78" }).phone,
      "+45 12 34 56 78",
    );
  });

  it("requires name, clinic, email and a real message", () => {
    assert.deepEqual(errorsOf({ ...valid, name: " ", clinic: "", email: "x", message: "hi" }), {
      name: "required",
      clinic: "required",
      email: "emailInvalid",
      message: "messageTooShort",
    });
    assert.equal(errorsOf({ ...valid, phone: "call me" }).phone, "phoneInvalid");
    assert.equal(errorsOf({ ...valid, message: "x".repeat(5001) }).message, "tooLong");
  });

  it("refuses CPR numbers (no patient data), but not ordinary numbers", () => {
    assert.equal(
      errorsOf({ ...valid, message: "Patient 010203-1234 needs a guide" }).message,
      "noPatientData",
    );
    assert.equal(
      errorsOf({ ...valid, message: "Patient 0102031234 needs a guide" }).message,
      "noPatientData",
    );
    assert.equal(looksLikeCprNumber("Call +45 12 34 56 78 about 3 implants in 2026"), false);
    assert.equal(looksLikeCprNumber("Order 12345678901 is late"), false);
  });

  it("lets the honeypot through validation (the action drops it)", () => {
    assert.equal(
      contactFormSchema.parse({ ...valid, website: "https://spam.example" }).website,
      "https://spam.example",
    );
  });
});

describe("page texts", () => {
  const schemas = {
    services: servicesPageSchema,
    about: aboutPageSchema,
    contact: contactPageSchema,
  };

  it("allow empty texts (hidden on the site) and cap the length", () => {
    const empty = { da: "", en: "" };
    for (const [page, schema] of Object.entries(schemas)) {
      const fields = PAGE_TEXT_FIELDS[page as keyof typeof schemas];
      const values = Object.fromEntries(fields.map((f) => [f, empty]));
      assert.ok(schema.safeParse(values).success, page);
      const tooLong = { ...values, title: { da: "x".repeat(161), en: "" } };
      assert.equal(schema.safeParse(tooLong).success, false, page);
    }
  });

  it("starter copy: every field in both languages, flagged as starter, valid, and without figures", () => {
    for (const page of ["services", "about", "contact"] as const) {
      const starter = PAGE_STARTERS[`page.${page}`] as Record<string, unknown>;
      assert.equal(starter.starter, true, page);
      assert.ok(schemas[page].safeParse(starter).success, page);
      for (const field of PAGE_TEXT_FIELDS[page]) {
        const value = starter[field] as { da: string; en: string };
        assert.ok(value.da.trim() && value.en.trim(), `${page}.${field} needs da + en`);
        // No numbers, prices or statistics in the starter copy: facts come from the admin.
        // ("3D", as in 3D printing, is a term, not a figure.)
        const text = `${value.da} ${value.en}`.replace(/\b3D\b/g, "");
        assert.doesNotMatch(text, /\d/, `${page}.${field} has a figure`);
      }
    }
  });
});
