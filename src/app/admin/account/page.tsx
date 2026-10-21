import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { requireAdmin } from "@/server/queries/session";

export const metadata: Metadata = { title: "Account" };

// The admin's own account. The admin is created by the seed only; this is where they change the
// seeded password.
export default async function AdminAccountPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin.account" });
  return (
    <>
      <ShellPageHeader title={t("title")} intro={t("intro")} />
      <Suspense fallback={<PageSkeleton />}>
        <Account />
      </Suspense>
    </>
  );
}

async function Account() {
  const [session, t] = await Promise.all([
    requireAdmin(),
    getTranslations({ locale: "en", namespace: "admin.account" }),
  ]);
  return (
    <section className="grid gap-6 rounded-card border border-line bg-surface p-5 sm:p-8 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-medium text-ink">{t("password.title")}</h2>
        <p className="text-sm text-ink-muted">{t("password.description")}</p>
        <p className="mt-2 text-sm text-ink-muted">
          {t("signedInAs", { email: session.user.email })}
        </p>
      </div>
      <div className="min-w-0">
        <ChangePasswordForm />
      </div>
    </section>
  );
}
