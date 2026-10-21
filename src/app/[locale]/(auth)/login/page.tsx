import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm, LoginNotice } from "@/components/auth/login-form";
import { env } from "@/env";
import { Link } from "@/i18n/navigation";
import { getContactSetting } from "@/server/queries/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

// Static shell: the form reads `?next=` on submit, and only the URL notices need <Suspense>.
export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  const contact = await getContactSetting();
  return (
    <AuthPage
      title={t("title")}
      intro={t("intro")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link
            href="/register"
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            {t("register")}
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginNotice />
      </Suspense>
      <LoginForm contactEmail={contact?.email || env.ADMIN_EMAIL} />
    </AuthPage>
  );
}
