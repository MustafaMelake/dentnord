// Neon connection strings come with `sslmode=require` (rewritten on every `neon env pull`).
// node-postgres currently treats that as `verify-full` but will switch to weaker libpq semantics in
// pg v9, and warns about it. Pin `verify-full` so certificates and hostnames are always verified.
// Shared by src/lib/db.ts and prisma/seed.ts, so it must stay free of server-only/env imports.
export function withVerifiedSsl(connectionString: string) {
  const url = new URL(connectionString);
  if (["prefer", "require", "verify-ca"].includes(url.searchParams.get("sslmode") ?? "")) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}
