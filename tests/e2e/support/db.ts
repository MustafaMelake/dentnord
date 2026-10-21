import { execFileSync } from "node:child_process";

// Test setup/teardown against the database in .env (must be the Neon `dev` branch; db-cli.ts
// refuses `production`). Runs db-cli.ts in a tsx child process, see the note there.

function run<T>(op: string, args: object = {}): T {
  const out = execFileSync(
    process.execPath,
    ["--import", "tsx", "tests/e2e/support/db-cli.ts", JSON.stringify({ op, args })],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return JSON.parse(out) as T;
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
