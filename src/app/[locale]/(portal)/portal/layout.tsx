import { getTranslations } from "next-intl/server";
import * as rootParams from "next/root-params";
import { Suspense } from "react";

import { requireApprovedDentist } from "@/server/queries/session";

// TODO: portal shell (sidebar, account menu).
export default function PortalLayout({ children }: LayoutProps<"/[locale]/portal">) {
  return (
    <Suspense fallback={<PortalFallback />}>
      <ApprovedDentistGate>{children}</ApprovedDentistGate>
    </Suspense>
  );
}

// Authoritative check (DB). Nothing below renders unless the user is an APPROVED dentist.
async function ApprovedDentistGate({ children }: { children: React.ReactNode }) {
  const locale = (await rootParams.locale()) ?? "da";
  await requireApprovedDentist(locale);
  return children;
}

async function PortalFallback() {
  const t = await getTranslations("common");
  return <p className="p-6 text-sm text-muted-foreground">{t("loading")}</p>;
}
