import { Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ContactForm } from "@/components/marketing/pages/contact-form";
import { PageHero } from "@/components/marketing/pages/page-hero";
import { pageText } from "@/components/marketing/pages/page-text";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { Missing } from "@/components/shared/missing";
import { localized } from "@/lib/utils";
import { getContactPageSetting, getContactSetting } from "@/server/queries/site-settings";

// Contact: the page texts from /admin/pages/contact, the contact details from /admin/settings and
// the contact form (messages land in /admin/messages).

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t, page] = await Promise.all([
    getLocale(),
    getTranslations("pages"),
    getContactPageSetting(),
  ]);
  return {
    title: pageText(page.title, locale) || t("contact"),
    description: pageText(page.intro, locale) || undefined,
  };
}

export default async function ContactPage() {
  const [locale, t, tNav, page, contact] = await Promise.all([
    getLocale(),
    getTranslations("contactPage"),
    getTranslations("nav"),
    getContactPageSetting(),
    getContactSetting(),
  ]);
  const text = (key: Exclude<keyof typeof page, "starter">) => pageText(page[key], locale);
  const address = localized(contact.address, locale);

  return (
    <main className="pb-16 sm:pb-24">
      <PageHero
        label={tNav("contact")}
        title={text("title") || tNav("contact")}
        intro={text("intro")}
        missingIntro={<Missing field="contactPage.intro" />}
      />

      <Container className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
        <section aria-labelledby="contact-details">
          <Reveal className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h2 id="contact-details" className="text-display-sm text-ink">
                {text("detailsHeading") || t("detailsLabel")}
              </h2>
              {!text("detailsHeading") && <Missing field="contactPage.detailsHeading" />}
            </div>
            <dl className="flex flex-col divide-y divide-line border-y border-line">
              {contact.email ? (
                <Detail icon={<Mail className="size-4" />} label={t("email")}>
                  <a href={`mailto:${contact.email}`} className="text-brand hover:underline">
                    {contact.email}
                  </a>
                </Detail>
              ) : null}
              {contact.phone ? (
                <Detail icon={<Phone className="size-4" />} label={t("phone")}>
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, "")}`}
                    className="text-brand hover:underline"
                  >
                    {contact.phone}
                  </a>
                </Detail>
              ) : null}
              {address ? (
                <Detail icon={<MapPin className="size-4" />} label={t("address")}>
                  <span className="whitespace-pre-line">{address}</span>
                </Detail>
              ) : null}
              {contact.cvr ? (
                <Detail label={t("cvr")}>
                  <span className="font-mono tabular-nums">{contact.cvr}</span>
                </Detail>
              ) : null}
            </dl>
            <div className="flex flex-wrap gap-2 empty:hidden">
              {!contact.email && <Missing field="contact.email" />}
              {!contact.phone && <Missing field="contact.phone" />}
              {!address && <Missing field="contact.address" />}
              {!contact.cvr && <Missing field="contact.cvr" />}
            </div>
          </Reveal>
        </section>

        <section aria-labelledby="contact-form-heading">
          <Reveal className="flex flex-col gap-6 rounded-media border border-line bg-surface p-6 sm:p-10">
            <div className="flex flex-col gap-3">
              <h2 id="contact-form-heading" className="text-display-sm text-ink">
                {text("formHeading") || t("formLabel")}
              </h2>
              {text("formIntro") && <p className="text-ink-muted">{text("formIntro")}</p>}
              {(!text("formHeading") || !text("formIntro")) && <Missing field="contactPage.form" />}
            </div>
            <ContactForm />
          </Reveal>
        </section>
      </Container>
    </main>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-5">
      <span
        aria-hidden
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-ice text-brand"
      >
        {icon ?? <span className="font-mono text-[0.625rem]">CVR</span>}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="text-sm text-ink-muted">{label}</dt>
        <dd className="text-ink">{children}</dd>
      </div>
    </div>
  );
}
