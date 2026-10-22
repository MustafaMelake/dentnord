// R2's S3 endpoint depends on the bucket's jurisdiction: buckets created with the EU jurisdiction
// are only reachable at https://<account>.eu.r2.cloudflarestorage.com. Pure (unit-tested).

export const R2_JURISDICTIONS = ["eu", "fedramp", "default"] as const;
export type R2Jurisdiction = (typeof R2_JURISDICTIONS)[number];

export function r2Endpoint(accountId: string, jurisdiction: R2Jurisdiction) {
  if (!/^[0-9a-f]{32}$/i.test(accountId))
    throw new Error("R2 account id must be 32 hex characters");
  const sub = jurisdiction === "default" ? "" : `${jurisdiction}.`;
  return `https://${accountId}.${sub}r2.cloudflarestorage.com`;
}
