import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-display-md">{t("title")}</h1>
      <Link href="/" className="text-accent underline-offset-4 hover:underline">
        {t("back")}
      </Link>
    </main>
  );
}
