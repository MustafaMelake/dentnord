import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

export default async function MarketingLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("common");
  return (
    <SmoothScroll>
      <a
        href="#content"
        className="fixed top-3 left-3 z-[60] -translate-y-24 rounded-full bg-ink px-4 py-2 text-sm text-white transition-transform focus-visible:translate-y-0"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader />
      <div id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </div>
      <SiteFooter />
    </SmoothScroll>
  );
}
