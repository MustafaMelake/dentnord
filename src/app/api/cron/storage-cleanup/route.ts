import { env } from "@/env";
import { isCronAuthorized } from "@/lib/storage-cleanup";
import { cleanUpStorage } from "@/server/services/storage-cleanup";

// GET (Vercel Cron, daily, see vercel.json): aborts uploads stuck for 24 h and deletes drafts
// untouched for 60 days (lib/storage-cleanup.ts). Vercel sends `Authorization: Bearer <CRON_SECRET>`;
// anything else gets 401, and without CRON_SECRET the job is off (503).

export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json({ error: "notConfigured" }, { status: 503, headers: NO_STORE });
  }
  if (!isCronAuthorized(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const result = await cleanUpStorage();
  const summary = { ...result, bytesFreed: result.bytesFreed.toString() };
  console.log("[storage-cleanup]", JSON.stringify(summary)); // counts only
  return Response.json(summary, { headers: NO_STORE });
}
