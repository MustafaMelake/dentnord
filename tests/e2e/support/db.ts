import { execFileSync } from "node:child_process";

// Test setup/teardown against the database in .env (must be the Neon `dev` branch; db-cli.ts
// refuses `production`). Runs db-cli.ts in a tsx child process, see the note there.

/** Connection failures (flaky network) are retried; anything else fails the test at once. */
const NETWORK_ERROR =
  /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|Can't reach database/;

function run<T>(op: string, args: object = {}): T {
  for (let attempt = 1; ; attempt++) {
    try {
      const out = execFileSync(
        process.execPath,
        ["--import", "tsx", "tests/e2e/support/db-cli.ts", JSON.stringify({ op, args })],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      return JSON.parse(out) as T;
    } catch (error) {
      const stderr = String((error as { stderr?: unknown }).stderr ?? "");
      if (attempt >= 3 || !NETWORK_ERROR.test(stderr)) {
        if (stderr) process.stderr.write(stderr);
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000 * attempt); // back off
    }
  }
}

export const E2E_PASSWORD = "e2e-Password-123";

export function uniqueEmail(label: string) {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
}

export function createUser({
  label,
  role = "DENTIST",
  status = "APPROVED",
  name = "E2E Dentist",
}: {
  label: string;
  role?: "ADMIN" | "DENTIST";
  status?: "PENDING" | "APPROVED" | "REJECTED";
  name?: string;
}) {
  const email = uniqueEmail(label);
  const { id } = run<{ id: string }>("createUser", {
    email,
    password: E2E_PASSWORD,
    name,
    role,
    status,
  });
  return { id, email, name, password: E2E_PASSWORD };
}

export type DbUser = {
  id: string;
  role: string;
  dentistStatus: string;
  termsAcceptedAt: string | null;
  rejectionReason: string | null;
  _count: { sessions: number };
};

export const getUser = (where: { email: string } | { id: string }) =>
  run<DbUser | null>("getUser", where);

export const getAudit = (targetId: string) =>
  run<{ action: string; actorId: string | null; actorEmail: string; metadata: unknown }[]>(
    "getAudit",
    {
      targetId,
    },
  );

export const cleanupE2EUsers = () => run<{ removed: number }>("cleanup").removed;

export const createService = (slug: string, title: string) =>
  run<{ id: string }>("createService", { slug, title });

export const getService = (id: string) =>
  run<{ title: { da: string; en: string }; published: boolean } | null>("getService", { id });

export const getSetting = (key: string) =>
  run<Record<string, unknown> | null>("getSetting", { key });

/** Restores a page.* setting (null deletes the row). */
export const setSetting = (key: string, value: Record<string, unknown> | null) =>
  run<{ ok: true }>("setSetting", { key, value });

export type DbContactMessage = {
  id: string;
  name: string;
  clinic: string;
  phone: string | null;
  message: string;
  locale: string;
  read: boolean;
};

export const getContactMessages = (email: string) =>
  run<DbContactMessage[]>("contactMessages", { email });

export const getTestimonials = (authorPrefix: string) =>
  run<{ id: string; authorName: string; consent: boolean; published: boolean }[]>(
    "getTestimonials",
    { authorPrefix },
  );

export type DbCaseFile = {
  id: string;
  kind: string;
  uploadStatus: string;
  sizeBytes: number;
  storageKey: string;
  scanPart: string | null;
};

export const getCaseFiles = (caseId: string) => run<DbCaseFile[]>("caseFiles", { caseId });

/** Objects in R2 under test/cases/{caseId}/ (E2E runs use the test/ key prefix). */
export const getR2Objects = (caseId: string) =>
  run<{ key: string; size: number }[]>("r2Objects", { caseId });

export const getCase = (caseId: string) =>
  run<{ status: string; caseNumber: string | null; events: { type: string }[] } | null>("getCase", {
    caseId,
  });

export const getEmailLog = (caseId: string) =>
  run<{ kind: string; to: string }[]>("emailLog", { caseId });

export type DbPlan = {
  id: string;
  version: number;
  sent: boolean;
  decision: string | null;
  decisionComment: string | null;
  approvalStatement: string | null;
  approvalLocale: string | null;
  files: { id: string; kind: string; uploadStatus: string }[];
};
export const getPlans = (caseId: string) => run<DbPlan[]>("casePlans", { caseId });

export const getTrail = (caseId: string) =>
  run<{ fromStatus: string | null; toStatus: string; type: string; note: string | null }[]>(
    "caseTrail",
    { caseId },
  );

/** A SUBMITTED case without files, straight in the DB (skips the wizard). */
export const createSubmittedCase = (email: string) =>
  run<{ id: string }>("createSubmittedCase", { email }).id;

export const getMessages = (caseId: string) =>
  run<{ internal: boolean; authorRole: string; body: string; readAt: string | null }[]>(
    "caseMessages",
    { caseId },
  );
