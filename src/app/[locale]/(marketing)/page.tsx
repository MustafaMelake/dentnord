import { getTranslations } from "next-intl/server";

// TODO: real landing page (hero with the 3D surgical guide, services, process, cases, CTA).
export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <p className="text-eyebrow font-medium text-accent uppercase">{t("eyebrow")}</p>
      <h1 className="max-w-[14ch] text-display-xl">{t("title")}</h1>
      <p className="max-w-[48ch] text-lead text-muted-foreground">{t("subtitle")}</p>
    </main>
  );
}
