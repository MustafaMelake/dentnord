import { Check, Clock, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import * as rootParams from "next/root-params";
import { Suspense } from "react";

import { AuthPage } from "@/components/auth/auth-page";
import { LogoutButton } from "@/components/auth/logout-button";
import { ButtonLink } from "@/components/shared/button";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/env";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/queries/session";
import { getAccountsSetting, getContactSetting } from "@/server/queries/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.pendingApproval");
  return { title: t("label"), robots: { index: false } };
}

export default function PendingApprovalPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:my-auto">
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      }
    >
      <AccountStatus />
    </Suspense>
  );
}

// Reads the session from the DB, so a status change shows up on the next load.
async function AccountStatus() {
  const param = await rootParams.locale();
  const locale = hasLocale(routing.locales, param) ? param : routing.defaultLocale;
  const session = await requireUser(locale);
  if (session.user.role === "ADMIN") redirect("/admin");

  const t = await getTranslations("auth.pendingApproval");
  const [contact, accounts] = await Promise.all([getContactSetting(), getAccountsSetting()]);
  const contactEmail = contact.email || env.ADMIN_EMAIL;
  const status = session.user.dentistStatus;
  const logout = <LogoutButton label={t("logout")} loginPath={`/${locale}/login`} />;
  const tStatus = await getTranslations("dentistStatus");
  const contactLine = t.rich("contact", {
    email: contactEmail,
    mail: (chunks) => (
      <a href={`mailto:${contactEmail}`} className="text-brand underline-offset-4 hover:underline">
        {chunks}
      </a>
    ),
  });

  if (status === "APPROVED") {
    return (
      <AuthPage title={t("approvedTitle")} intro={t("approvedBody")}>
        <ButtonLink href="/portal/dashboard" size="lg" icon>
          {t("openPortal")}
        </ButtonLink>
      </AuthPage>
    );
  }

  if (status === "REJECTED") {
    return (
      <AuthPage title={t("rejectedTitle")} intro={t("rejectedBody")}>
        <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-5 text-sm text-ink-muted">
          <ShieldX aria-hidden className="size-5 shrink-0 text-destructive" />
          <p>{contactLine}</p>
        </div>
        {logout}
      </AuthPage>
    );
  }

  const steps = [
    { key: "registered", state: "done" },
    { key: "review", state: "current" },
    { key: "access", state: "todo" },
  ] as const;

  return (
    <AuthPage title={t("title")} intro={t("body")}>
      <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-label text-ink-muted">{t("label")}</p>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-deep">
            <Clock aria-hidden className="size-3.5" />
            {tStatus("PENDING")}
          </span>
        </div>
        <ol className="flex flex-col gap-3">
          {steps.map(({ key, state }) => (
            <li key={key} className="flex items-center gap-3 text-[0.9375rem]">
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                  state === "done" && "bg-brand text-white",
                  state === "current" && "border-2 border-brand bg-brand-ice",
                  state === "todo" && "border border-line bg-surface-2",
                )}
              >
                {state === "done" && <Check className="size-3.5" />}
              </span>
              <span className={state === "todo" ? "text-ink-muted" : "text-ink"}>
                {t(`steps.${key}`)}
              </span>
            </li>
          ))}
        </ol>
        {accounts.reviewDays !== null && (
          <p className="border-t border-line pt-4 text-sm text-ink-muted">
            {t("reviewTime", { days: accounts.reviewDays })}
          </p>
        )}
      </div>
      <p className="text-sm text-ink-muted">{contactLine}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        <p className="text-sm text-ink-muted">{t("signedInAs", { email: session.user.email })}</p>
        {logout}
      </div>
    </AuthPage>
  );
}
