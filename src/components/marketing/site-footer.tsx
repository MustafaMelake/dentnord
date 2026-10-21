import { getLocale, getTranslations } from "next-intl/server";

import { Container } from "@/components/shared/container";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { Missing } from "@/components/shared/missing";
import { Link } from "@/i18n/navigation";
import { localized } from "@/lib/utils";
import { getContactSetting, getCurrentYear } from "@/server/queries/site-settings";

import { Logo } from "./logo";

export async function SiteFooter() {
  const [t, tNav, locale, contact, year] = await Promise.all([
    getTranslations("footer"),
    getTranslations("nav"),
    getLocale(),
    getContactSetting(),
    getCurrentYear(),
  ]);
  const address = localized(contact.address, locale);

  const links = [
    { href: "/services", label: tNav("services") },
    { href: "/portfolio", label: tNav("portfolio") },
    { href: "/about", label: tNav("about") },
    { href: "/contact", label: tNav("contact") },
    { href: "/login", label: tNav("portal") },
  ] as const;

  return (
    <footer className="mt-24 border-t border-line">
      <Container className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:py-20">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Link href="/" aria-label={tNav("home")} className="w-fit rounded-full text-ink">
            <Logo />
          </Link>
          <p className="max-w-[36ch] text-ink-muted">{t("tagline")}</p>
        </div>

        <nav aria-labelledby="footer-explore" className="lg:col-span-3">
          <h2 id="footer-explore" className="mb-4 font-mono text-label text-ink-muted">
            {t("explore")} /
          </h2>
          <ul className="flex flex-col gap-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink underline-offset-4 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-4">
          <h2 className="mb-4 font-mono text-label text-ink-muted">{t("contact")} /</h2>
          <dl className="grid gap-3">
            {contact.email ? (
              <div>
                <dt className="sr-only">{t("email")}</dt>
                <dd>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-ink underline-offset-4 hover:underline"
                  >
                    {contact.email}
                  </a>
                </dd>
              </div>
            ) : (
              <Missing field="contact.email" />
            )}
            {contact.phone ? (
              <div>
                <dt className="sr-only">{t("phone")}</dt>
                <dd className="text-ink">
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {contact.phone}
                  </a>
                </dd>
              </div>
            ) : (
              <Missing field="contact.phone" />
            )}
            {address ? (
              <div>
                <dt className="sr-only">{t("address")}</dt>
                <dd className="whitespace-pre-line text-ink-muted">{address}</dd>
              </div>
            ) : (
              <Missing field="contact.address" />
            )}
          </dl>
          <div className="mt-6 flex items-center gap-3">
            <span className="font-mono text-label text-ink-muted">{t("language")}</span>
            <LocaleSwitcher />
          </div>
        </div>
      </Container>

      <Container className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-6 font-mono text-label text-ink-muted">
        <span>{t("rights", { year })}</span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/terms" className="underline-offset-4 hover:text-ink hover:underline">
            {t("terms")}
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
            {t("privacy")}
          </Link>
          {contact.cvr ? (
            <span>{t("cvr", { cvr: contact.cvr })}</span>
          ) : (
            <Missing field="contact.cvr" />
          )}
        </span>
      </Container>
    </footer>
  );
}
