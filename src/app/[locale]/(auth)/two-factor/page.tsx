import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import * as rootParams from "next/root-params";
import { Suspense } from "react";

import { AuthPage } from "@/components/auth/auth-page";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import { postLoginPath } from "@/lib/redirects";
import { requireUser } from "@/server/queries/session";

// Two-factor setup. Admins land here (proxy, session DAL, login) until 2FA is on; dentists come from
// their account page. `?next=` is where to go afterwards (checked by postLoginPath).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("twoFactor.setup");
  return { title: t("title"), robots: { index: false } };
}

export default async function TwoFactorPage({ searchParams }: PageProps<"/[locale]/two-factor">) {
  const t = await getTranslations("twoFactor.setup");
  return (
    <AuthPage title={t("title")} width="md">
      <Suspense
        fallback={
          <div className="flex flex-col gap-5">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-14 rounded-full" />
          </div>
        }
      >
        <Setup searchParams={searchParams} />
      </Suspense>
    </AuthPage>
  );
}

async function Setup({ searchParams }: Pick<PageProps<"/[locale]/two-factor">, "searchParams">) {
  const param = await rootParams.locale();
  const locale = hasLocale(routing.locales, param) ? param : routing.defaultLocale;
  const session = await requireUser(locale);
  const next = (await searchParams).next;
  // Where this user belongs once 2FA is on (an admin: /admin or an /admin `next`).
  const target = postLoginPath(
    { ...session.user, twoFactorEnabled: true },
    locale,
    typeof next === "string" ? next : null,
  );
  if (session.user.twoFactorEnabled) redirect(target);

  return (
    <TwoFactorSetup
      email={session.user.email}
      next={target}
      required={session.user.role === "ADMIN"}
    />
  );
}
