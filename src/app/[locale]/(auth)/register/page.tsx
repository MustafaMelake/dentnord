import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthPage } from "@/components/auth/auth-page";
import { RegisterForm } from "@/components/auth/register-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");
  return { title: t("title") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  return (
    <AuthPage
      width="md"
      title={t("title")}
      intro={t("intro")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
            {t("login")}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthPage>
  );
}
