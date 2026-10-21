import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthPage } from "@/components/auth/auth-page";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.resetPassword");
  // The URL carries a reset token: keep it out of indexes and referrers.
  return { title: t("title"), robots: { index: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.resetPassword");
  return (
    <AuthPage title={t("title")} intro={t("intro")}>
      <Suspense fallback={<Skeleton className="h-56 rounded-card" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthPage>
  );
}
