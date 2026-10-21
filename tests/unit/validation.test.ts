import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  changePasswordSchema,
  loginSchema,
  profileSchema,
  registerFormSchema,
  registerSchema,
  resetPasswordSchema,
} from "../../src/lib/validation/auth";
import en from "../../messages/en.json";
import da from "../../messages/da.json";

const valid = {
  name: "  Anne Hansen ",
  email: " Anne@Klinik.DK ",
  password: "correct-horse-1",
  clinicName: "Tandklinikken Nord",
  phone: "+45 12 34 56 78",
  country: "DK",
  address: "Nørregade 1, 9000 Aalborg",
  cvr: "12345678",
  preferredLocale: "da",
  acceptTerms: true,
} as const;

/** The first issue's message (a `validation.*` key) for `path`. */
function errorAt(
  result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  path: string,
) {
  return result.error?.issues.find((issue) => issue.path.join(".") === path)?.message;
}

describe("registerSchema", () => {
  it("accepts a complete registration and normalises it", () => {
    const result = registerSchema.safeParse(valid);
    assert.ok(result.success);
    assert.equal(result.data.email, "anne@klinik.dk");
    assert.equal(result.data.name, "Anne Hansen");
  });

  it("requires the Terms/Privacy consent to be exactly true", () => {
    for (const acceptTerms of [false, "true", 1, undefined]) {
      const result = registerSchema.safeParse({ ...valid, acceptTerms });
      assert.equal(
        errorAt(result, "acceptTerms"),
        "termsRequired",
        `acceptTerms=${String(acceptTerms)}`,
      );
    }
  });

  it("needs a password of at least 10 characters", () => {
    assert.equal(
      errorAt(registerSchema.safeParse({ ...valid, password: "123456789" }), "password"),
      "passwordTooShort",
    );
    assert.ok(registerSchema.safeParse({ ...valid, password: "1234567890" }).success);
  });

  it("rejects malformed emails and phone numbers", () => {
    assert.equal(
      errorAt(registerSchema.safeParse({ ...valid, email: "not-an-email" }), "email"),
      "emailInvalid",
    );
    assert.equal(
      errorAt(registerSchema.safeParse({ ...valid, phone: "call me" }), "phone"),
      "phoneInvalid",
    );
  });

  it("requires the clinic fields", () => {
    for (const field of ["name", "clinicName", "phone", "address"] as const) {
      assert.equal(
        errorAt(registerSchema.safeParse({ ...valid, [field]: "   " }), field),
        "required",
        field,
      );
    }
  });

  it("validates CVR: optional, 8 digits in Denmark, free-form VAT elsewhere", () => {
    const noCvr = registerSchema.safeParse({ ...valid, cvr: "" });
    assert.ok(noCvr.success);
    assert.equal(noCvr.data.cvr, undefined);
    assert.equal(errorAt(registerSchema.safeParse({ ...valid, cvr: "1234" }), "cvr"), "cvrInvalid");
    assert.ok(registerSchema.safeParse({ ...valid, country: "SE", cvr: "SE556677889901" }).success);
  });

  it("only allows known countries and languages", () => {
    assert.ok(!registerSchema.safeParse({ ...valid, country: "XX" }).success);
    assert.ok(!registerSchema.safeParse({ ...valid, preferredLocale: "de" }).success);
  });

  it("strips fields the server owns (role, status)", () => {
    const result = registerSchema.safeParse({ ...valid, role: "ADMIN", dentistStatus: "APPROVED" });
    assert.ok(result.success);
    assert.ok(!("role" in result.data));
    assert.ok(!("dentistStatus" in result.data));
  });
});

describe("registerFormSchema", () => {
  it("requires the password confirmation to match", () => {
    const result = registerFormSchema.safeParse({ ...valid, confirmPassword: "something-else" });
    assert.equal(errorAt(result, "confirmPassword"), "passwordsDontMatch");
    assert.ok(registerFormSchema.safeParse({ ...valid, confirmPassword: valid.password }).success);
  });
});

describe("profileSchema", () => {
  it("does not include email, role or status", () => {
    // A full registration payload plus server-owned fields: only profile fields survive.
    const result = profileSchema.safeParse({ ...valid, role: "ADMIN", dentistStatus: "APPROVED" });
    assert.ok(result.success);
    assert.deepEqual(Object.keys(result.data).sort(), [
      "address",
      "clinicName",
      "country",
      "cvr",
      "name",
      "phone",
      "preferredLocale",
    ]);
  });
});

describe("password schemas", () => {
  it("login only needs a non-empty password", () => {
    assert.ok(loginSchema.safeParse({ email: "a@b.dk", password: "x" }).success);
    assert.equal(
      errorAt(loginSchema.safeParse({ email: "a@b.dk", password: "" }), "password"),
      "required",
    );
  });

  it("reset requires matching passwords of 10+ characters", () => {
    assert.ok(
      resetPasswordSchema.safeParse({ password: "1234567890", confirmPassword: "1234567890" })
        .success,
    );
    assert.equal(
      errorAt(
        resetPasswordSchema.safeParse({ password: "1234567890", confirmPassword: "0987654321" }),
        "confirmPassword",
      ),
      "passwordsDontMatch",
    );
  });

  it("change-password refuses reusing the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "1234567890",
      newPassword: "1234567890",
      confirmPassword: "1234567890",
    });
    assert.equal(errorAt(result, "newPassword"), "passwordUnchanged");
  });
});

describe("validation messages", () => {
  it("every error key used by the schemas exists in da and en", () => {
    const keys = [
      "required",
      "tooLong",
      "emailInvalid",
      "passwordTooShort",
      "passwordTooLong",
      "passwordsDontMatch",
      "passwordUnchanged",
      "termsRequired",
      "phoneInvalid",
      "cvrInvalid",
    ];
    for (const key of keys) {
      assert.ok(key in en.validation, `en: validation.${key}`);
      assert.ok(key in da.validation, `da: validation.${key}`);
    }
  });
});
