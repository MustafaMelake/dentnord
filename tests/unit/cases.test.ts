import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCaseFileKey,
  caseKeyPrefix,
  checkCaseUpload,
  extensionOf,
  MAX_CASE_FILE_BYTES,
  REQUIRED_FILE_KINDS,
  sanitizeFileName,
} from "../../src/lib/case-files";
import {
  ALL_TEETH,
  archOf,
  isFdiTooth,
  LOWER_ARCH,
  nextTooth,
  sortTeeth,
  toggleTooth,
  toothType,
  UPPER_ARCH,
} from "../../src/lib/fdi";
import {
  detailsDraftSchema,
  detailsSchema,
  patientCodeIssue,
  sitesDraftSchema,
  sitesSchema,
  submitSchema,
} from "../../src/lib/validation/case";

const firstIssue = (r: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => r.error?.issues.map((i) => `${i.path.join(".")}:${i.message}`);

describe("FDI chart", () => {
  it("has 32 permanent teeth, 16 per arch, each valid FDI", () => {
    assert.equal(ALL_TEETH.length, 32);
    assert.equal(new Set(ALL_TEETH).size, 32);
    assert.ok(ALL_TEETH.every(isFdiTooth));
    assert.equal(UPPER_ARCH[0], 18);
    assert.equal(UPPER_ARCH[15], 28);
    assert.equal(LOWER_ARCH[0], 48);
    assert.equal(LOWER_ARCH[15], 38);
  });

  it("rejects non-FDI numbers", () => {
    for (const n of [0, 10, 19, 50, 51, 99, 11.5, -11, Number.NaN])
      assert.equal(isFdiTooth(n), false, String(n));
    assert.equal(isFdiTooth("11"), false);
  });

  it("knows arches and tooth types", () => {
    assert.equal(archOf(21), "upper");
    assert.equal(archOf(36), "lower");
    assert.equal(toothType(11), "incisor");
    assert.equal(toothType(43), "canine");
    assert.equal(toothType(25), "premolar");
    assert.equal(toothType(38), "molar");
  });

  it("toggles teeth and keeps chart order", () => {
    let selected: number[] = [];
    selected = toggleTooth(selected, 36);
    selected = toggleTooth(selected, 14);
    selected = toggleTooth(selected, 21);
    assert.deepEqual(selected, [14, 21, 36]);
    selected = toggleTooth(selected, 14);
    assert.deepEqual(selected, [21, 36]);
    assert.deepEqual(toggleTooth(selected, 99), [21, 36], "invalid tooth ignored");
    assert.deepEqual(sortTeeth([31, 48, 11, 18]), [18, 11, 48, 31]);
  });

  it("moves focus with the arrow keys", () => {
    assert.equal(nextTooth(11, "ArrowRight"), 21);
    assert.equal(nextTooth(11, "ArrowLeft"), 12);
    assert.equal(nextTooth(18, "ArrowLeft"), 18, "stops at the end");
    assert.equal(nextTooth(28, "ArrowRight"), 28);
    assert.equal(nextTooth(11, "ArrowDown"), 41);
    assert.equal(nextTooth(41, "ArrowUp"), 11);
    assert.equal(nextTooth(11, "ArrowUp"), 11, "no arch above the upper");
    assert.equal(nextTooth(36, "Home"), 48);
    assert.equal(nextTooth(36, "End"), 38);
  });
});

describe("patient code", () => {
  it("accepts pseudonymous references", () => {
    for (const code of ["AH-2026", "ah26", "Pt 0042", "Klinik-12/3", "Ole", "JH 1990 b"]) {
      assert.equal(patientCodeIssue(code), null, code);
    }
  });

  it("refuses what looks like a full name, a CPR number or an email", () => {
    assert.equal(patientCodeIssue("Anna Hansen"), "looksLikeName");
    assert.equal(patientCodeIssue("anna Hansen Jensen"), "looksLikeName");
    assert.equal(patientCodeIssue("Søren Ærø"), "looksLikeName");
    assert.equal(patientCodeIssue("010190-1234"), "looksLikeCpr");
    assert.equal(patientCodeIssue("0101901234"), "looksLikeCpr");
    assert.equal(patientCodeIssue("a@b.dk"), "looksLikeEmail");
  });

  it("the schema turns those into field errors", () => {
    const base = { guideTypeId: "g1", surgeryDate: "", notes: "" };
    assert.deepEqual(
      firstIssue(detailsDraftSchema.safeParse({ ...base, patientCode: "Anna Hansen" })),
      ["patientCode:looksLikeName"],
    );
    assert.ok(detailsDraftSchema.safeParse({ ...base, patientCode: "AH-2026" }).success);
    assert.deepEqual(
      firstIssue(detailsDraftSchema.safeParse({ ...base, patientCode: "<script>" })),
      ["patientCode:patientCodeChars"],
    );
  });
});

describe("wizard schemas", () => {
  it("details: drafts may be incomplete, submitting needs code and guide type", () => {
    const empty = { patientCode: "", guideTypeId: null, surgeryDate: "", notes: "" };
    assert.ok(detailsDraftSchema.safeParse(empty).success);
    assert.deepEqual(firstIssue(detailsSchema.safeParse(empty)), [
      "patientCode:required",
      "guideTypeId:required",
    ]);
  });

  it("details: only real dates", () => {
    const base = { patientCode: "AH", guideTypeId: "g", notes: "" };
    assert.ok(detailsSchema.safeParse({ ...base, surgeryDate: "2026-11-30" }).success);
    for (const surgeryDate of ["2026-02-30", "30-11-2026", "tomorrow"]) {
      assert.ok(!detailsSchema.safeParse({ ...base, surgeryDate }).success, surgeryDate);
    }
  });

  const site = {
    fdiTooth: 36,
    implantSystemId: "sys",
    implantSystemOther: "",
    diameter: 4.1,
    length: 10,
    surgicalKitId: null,
  };

  it("sites: at least one, unique teeth, a system or 'Other' per site", () => {
    assert.ok(sitesSchema.safeParse({ sites: [site] }).success);
    assert.deepEqual(firstIssue(sitesSchema.safeParse({ sites: [] })), ["sites:siteRequired"]);
    assert.ok(!sitesDraftSchema.safeParse({ sites: [site, site] }).success, "duplicate tooth");
    const noSystem = { ...site, implantSystemId: null };
    assert.ok(sitesDraftSchema.safeParse({ sites: [noSystem] }).success, "fine in a draft");
    assert.deepEqual(firstIssue(sitesSchema.safeParse({ sites: [noSystem] })), [
      "sites.0.implantSystemId:systemRequired",
    ]);
    assert.ok(
      sitesSchema.safeParse({ sites: [{ ...noSystem, implantSystemOther: "Brand X" }] }).success,
    );
  });

  it("sites: 'Let Dentnord suggest' is null; sizes stay plausible", () => {
    assert.ok(
      sitesSchema.safeParse({ sites: [{ ...site, diameter: null, length: null }] }).success,
    );
    assert.ok(!sitesSchema.safeParse({ sites: [{ ...site, diameter: 40 }] }).success);
    assert.ok(!sitesSchema.safeParse({ sites: [{ ...site, fdiTooth: 19 }] }).success);
  });

  it("submit needs the confirmation", () => {
    assert.ok(submitSchema.safeParse({ consent: true }).success);
    assert.ok(!submitSchema.safeParse({ consent: false }).success);
  });
});

describe("case file rules", () => {
  it("requires CBCT and an intraoral scan", () => {
    assert.deepEqual(REQUIRED_FILE_KINDS, ["CBCT", "INTRAORAL_SCAN"]);
  });

  it("allows the right extensions per slot, case-insensitively", () => {
    assert.ok(checkCaseUpload("CBCT", "scan.ZIP", 10).ok);
    assert.ok(checkCaseUpload("CBCT", "slice.dcm", 10).ok);
    assert.ok(checkCaseUpload("INTRAORAL_SCAN", "upper.stl", 10).ok);
    assert.ok(checkCaseUpload("INTRAORAL_SCAN", "bite.obj", 10).ok);
    assert.ok(checkCaseUpload("PHOTO", "IMG_1.HEIC", 10).ok);
    assert.deepEqual(checkCaseUpload("CBCT", "scan.stl", 10), { ok: false, reason: "extension" });
    assert.deepEqual(checkCaseUpload("OTHER", "run.exe", 10), { ok: false, reason: "extension" });
    assert.deepEqual(checkCaseUpload("OTHER", "page.html", 10), { ok: false, reason: "extension" });
    assert.deepEqual(checkCaseUpload("PLAN_REPORT", "plan.pdf", 10), { ok: false, reason: "kind" });
  });

  it("enforces 1 byte to 2 GB", () => {
    assert.ok(checkCaseUpload("CBCT", "a.zip", MAX_CASE_FILE_BYTES).ok);
    assert.deepEqual(checkCaseUpload("CBCT", "a.zip", MAX_CASE_FILE_BYTES + 1), {
      ok: false,
      reason: "tooLarge",
    });
    assert.deepEqual(checkCaseUpload("CBCT", "a.zip", 0), { ok: false, reason: "empty" });
  });

  it("derives the MIME type from the extension, not the browser", () => {
    const r = checkCaseUpload("INTRAORAL_SCAN", "x.STL", 5);
    assert.ok(r.ok && r.mimeType === "model/stl");
  });

  it("sanitises file names", () => {
    assert.equal(sanitizeFileName("C:\\scans\\Kæbe øvre (1).STL"), "Kaebe_oevre_1.stl");
    assert.equal(sanitizeFileName("../../etc/passwd"), "passwd");
    assert.equal(sanitizeFileName(".hidden.zip"), "hidden.zip");
    assert.equal(sanitizeFileName("   "), "file");
    assert.equal(sanitizeFileName("x".repeat(300) + ".zip").length, 120);
    assert.ok(sanitizeFileName("x".repeat(300) + ".zip").endsWith(".zip"));
    assert.equal(extensionOf("archive.tar.GZ"), ".gz");
  });

  it("builds storage keys only from safe parts", () => {
    assert.equal(
      buildCaseFileKey({ caseId: "c123", fileId: "f456", fileName: "Scan 1.stl" }),
      "cases/c123/f456/Scan_1.stl",
    );
    assert.equal(
      buildCaseFileKey({ prefix: "test/", caseId: "c1", fileId: "f1", fileName: "a.zip" }),
      "test/cases/c1/f1/a.zip",
    );
    assert.throws(() => buildCaseFileKey({ caseId: "../x", fileId: "f", fileName: "a.zip" }));
    assert.throws(() =>
      buildCaseFileKey({ prefix: "../", caseId: "c", fileId: "f", fileName: "a.zip" }),
    );
    assert.equal(caseKeyPrefix("test/", "c1"), "test/cases/c1/");
  });
});

describe("R2 endpoint", () => {
  it("follows the bucket jurisdiction", async () => {
    const { r2Endpoint } = await import("../../src/lib/r2-endpoint");
    const id = "0123456789abcdef0123456789abcdef";
    assert.equal(r2Endpoint(id, "eu"), `https://${id}.eu.r2.cloudflarestorage.com`);
    assert.equal(r2Endpoint(id, "default"), `https://${id}.r2.cloudflarestorage.com`);
    assert.throws(
      () => r2Endpoint(`https://${id}.r2.cloudflarestorage.com`, "eu"),
      "a URL is not an account id",
    );
  });
});
