import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AccountControl } from "@/components/marketing/header-account";
import { HeaderAccountSlot } from "@/components/marketing/header-account-slot";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

// The header shell is static (prerendered); only the account control streams in, behind <Suspense>,
// with the signed-out Login link as its fallback, so the prerendered header is complete and keeps its
// height when the account menu arrives.
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
      <SiteHeader
        accountSlot={
          <Suspense fallback={<AccountControl user={null} />}>
            <HeaderAccountSlot />
          </Suspense>
        }
      />
      <div id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </div>
      <SiteFooter />
    </SmoothScroll>
  );
}
