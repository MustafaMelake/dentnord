import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthPage } from "@/components/auth/auth-page";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgotPassword");
  return { title: t("title"), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgotPassword");
  return (
    <AuthPage title={t("title")} intro={t("intro")}>
      <ForgotPasswordForm />
    </AuthPage>
  );
}
