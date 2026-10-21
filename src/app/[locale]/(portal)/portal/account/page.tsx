import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import {
  ChangePasswordForm,
  ProfileForm,
  SignOutEverywhere,
} from "@/components/portal/account-forms";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { COUNTRIES, DEFAULT_COUNTRY, type ProfileInput } from "@/lib/validation/auth";
import { getOwnProfile } from "@/server/queries/dentist";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.account");
  return { title: t("title") };
}

export default async function PortalAccountPage() {
  const t = await getTranslations("portal.account");
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
  const locale = await getLocale();
  const [t, profile] = await Promise.all([
    getTranslations("portal.account"),
    getOwnProfile(locale),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <Panel title={t("profile.title")} description={t("profile.description")}>
        <ProfileForm
          email={profile.email}
          defaults={{
            name: profile.name,
            clinicName: profile.clinicName ?? "",
            phone: profile.phone ?? "",
            country: (COUNTRIES as readonly string[]).includes(profile.country ?? "")
              ? (profile.country as ProfileInput["country"])
              : DEFAULT_COUNTRY,
            address: profile.address ?? "",
            cvr: profile.cvr ?? "",
            preferredLocale: profile.preferredLocale === "en" ? "en" : "da",
          }}
        />
      </Panel>
      <Panel title={t("password.title")} description={t("password.description")}>
        <ChangePasswordForm />
      </Panel>
      <Panel title={t("sessions.title")} description={t("sessions.description")}>
        <SignOutEverywhere />
      </Panel>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-6 rounded-card border border-line bg-surface p-5 sm:p-8 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-medium text-ink">{title}</h2>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
