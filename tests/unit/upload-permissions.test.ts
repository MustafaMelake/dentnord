import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENTIST_FILE_KINDS } from "../../src/lib/case-files";
import { CASE_STATUSES, type Actor } from "../../src/lib/case-workflow-rules";
import {
  canDownload,
  canRemove,
  canUpload,
  checkFileType,
  isViewable,
  LAB_FILE_KINDS,
  type PlanState,
} from "../../src/lib/upload-permissions";

const ALL_KINDS = [...DENTIST_FILE_KINDS, ...LAB_FILE_KINDS];
const PLANS: PlanState[] = ["none", "unsent", "sent"];
const ACTORS: Actor[] = ["DENTIST", "ADMIN"];

/** The rule, stated once more in plain terms: what the test expects. */
function expectedUpload(actor: Actor, status: string, kind: string, plan: PlanState) {
  if (actor === "DENTIST")
    return (
      (DENTIST_FILE_KINDS as readonly string[]).includes(kind) &&
      plan === "none" &&
      (status === "DRAFT" || status === "NEEDS_FILES")
    );
  return (
    (LAB_FILE_KINDS as readonly string[]).includes(kind) &&
    plan === "unsent" &&
    (status === "IN_PLANNING" || status === "CHANGES_REQUESTED")
  );
}

describe("upload permissions", () => {
  it("matches the rule for every actor × status × kind × plan state", () => {
    let n = 0;
    for (const actor of ACTORS)
      for (const status of CASE_STATUSES)
        for (const kind of ALL_KINDS)
          for (const plan of PLANS) {
            assert.equal(
              canUpload({ actor, status, kind, plan }).ok,
              expectedUpload(actor, status, kind, plan),
              `${actor} upload ${kind} in ${status} (plan ${plan})`,
            );
            n++;
          }
    assert.equal(n, 2 * CASE_STATUSES.length * ALL_KINDS.length * 3);
  });

  it("the dentist can't upload after submitting, except while files are requested", () => {
    for (const status of CASE_STATUSES) {
      const ok = canUpload({ actor: "DENTIST", status, kind: "CBCT", plan: "none" }).ok;
      assert.equal(ok, status === "DRAFT" || status === "NEEDS_FILES", status);
    }
  });

  it("the dentist can never upload plan files; the admin can never upload dentist files", () => {
    for (const kind of LAB_FILE_KINDS)
      assert.deepEqual(
        canUpload({ actor: "DENTIST", status: "NEEDS_FILES", kind, plan: "unsent" }),
        {
          ok: false,
          reason: "kind",
        },
      );
    for (const kind of DENTIST_FILE_KINDS)
      assert.deepEqual(canUpload({ actor: "ADMIN", status: "IN_PLANNING", kind, plan: "unsent" }), {
        ok: false,
        reason: "kind",
      });
  });

  it("plan files go only into a plan still being prepared", () => {
    assert.deepEqual(
      canUpload({ actor: "ADMIN", status: "IN_PLANNING", kind: "PLAN_REPORT", plan: "none" }),
      {
        ok: false,
        reason: "planRequired",
      },
    );
    assert.deepEqual(
      canUpload({ actor: "ADMIN", status: "IN_PLANNING", kind: "PLAN_REPORT", plan: "sent" }),
      {
        ok: false,
        reason: "planRequired",
      },
    );
    assert.deepEqual(
      canUpload({
        actor: "ADMIN",
        status: "AWAITING_APPROVAL",
        kind: "PLAN_REPORT",
        plan: "unsent",
      }),
      { ok: false, reason: "wrongState" },
    );
  });
});

describe("remove permissions", () => {
  it("the dentist removes anything in a draft, only unfinished uploads in NEEDS_FILES, nothing else", () => {
    for (const status of CASE_STATUSES)
      for (const complete of [true, false]) {
        const ok = canRemove({ actor: "DENTIST", status, kind: "CBCT", plan: "none", complete }).ok;
        const expected = status === "DRAFT" || (status === "NEEDS_FILES" && !complete);
        assert.equal(ok, expected, `${status} complete=${complete}`);
      }
  });

  it("the admin removes only plan files of an unsent plan while planning", () => {
    for (const status of CASE_STATUSES)
      for (const plan of PLANS)
        for (const kind of ALL_KINDS) {
          const ok = canRemove({ actor: "ADMIN", status, kind, plan, complete: true }).ok;
          const expected =
            (LAB_FILE_KINDS as readonly string[]).includes(kind) &&
            plan === "unsent" &&
            (status === "IN_PLANNING" || status === "CHANGES_REQUESTED");
          assert.equal(ok, expected, `${kind} ${status} ${plan}`);
        }
  });
});

describe("download permissions", () => {
  it("the dentist never sees a plan that is still being prepared", () => {
    for (const status of CASE_STATUSES) {
      assert.equal(canDownload({ actor: "DENTIST", status, plan: "unsent" }).ok, false);
      assert.equal(canDownload({ actor: "DENTIST", status, plan: "sent" }).ok, true);
      assert.equal(canDownload({ actor: "DENTIST", status, plan: "none" }).ok, true);
    }
  });

  it("the admin downloads anything except from drafts", () => {
    for (const status of CASE_STATUSES)
      for (const plan of PLANS)
        assert.equal(canDownload({ actor: "ADMIN", status, plan }).ok, status !== "DRAFT");
  });
});

describe("file types", () => {
  it("lab files: report is a pdf, 3D files are stl/ply/obj/glb, the guide is stl", () => {
    assert.equal(checkFileType("PLAN_REPORT", "plan.pdf", 1000).ok, true);
    assert.equal(checkFileType("PLAN_REPORT", "plan.docx", 1000).ok, false);
    assert.equal(checkFileType("PLAN_3D", "implants.glb", 1000).ok, true);
    assert.equal(checkFileType("GUIDE_STL", "guide.obj", 1000).ok, false);
    assert.equal(checkFileType("PLAN_REPORT", "plan.pdf", 300 * 1024 ** 2).ok, false);
    // Dentist kinds still follow the slot rules.
    assert.equal(checkFileType("CBCT", "dicom.zip", 1000).ok, true);
    assert.equal(checkFileType("CBCT", "plan.pdf", 1000).ok, false);
  });

  it("the viewer shows 3D formats only", () => {
    for (const name of ["a.stl", "b.PLY", "c.obj", "d.glb"]) assert.equal(isViewable(name), true);
    for (const name of ["dicom.zip", "x.dcm", "plan.pdf", "photo.jpg"])
      assert.equal(isViewable(name), false);
  });
});
