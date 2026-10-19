import { SiteHeader } from "@/components/marketing/site-header";

// TODO: footer, Lenis smooth scroll provider.
export default function MarketingLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
