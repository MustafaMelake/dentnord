import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, EmailLinkFallback, emailText } from "./components/email-layout";
import { getEmailTranslator, type EmailLocale } from "./i18n";

// To the admin: someone sent the contact form. Who wrote, not what: the message itself is only in
// the admin inbox, so nothing a visitor typed (patient details included) ends up in an email.

type Props = {
  locale: EmailLocale;
  inboxUrl: string;
  sender: { name: string; clinic: string; email: string; phone: string };
};

export function ContactMessageEmail({ locale, inboxUrl, sender }: Props) {
  const t = getEmailTranslator(locale);
  const rows = [
    [t("contactMessage.name"), sender.name],
    [t("contactMessage.clinic"), sender.clinic],
    [t("contactMessage.email"), sender.email],
    [t("contactMessage.phone"), sender.phone],
  ] as const;
  return (
    <EmailLayout lang={locale} preview={t("contactMessage.preview")} footer={t("footer")}>
      <Text style={emailText.heading}>{t("contactMessage.heading")}</Text>
      <Text style={emailText.body}>{t("contactMessage.body")}</Text>
      {rows.map(([label, value]) => (
        <div key={label}>
          <Text style={emailText.label}>{label}</Text>
          <Text style={emailText.value}>{value || "–"}</Text>
        </div>
      ))}
      <EmailButton href={inboxUrl}>{t("contactMessage.cta")}</EmailButton>
      <EmailLinkFallback href={inboxUrl} label={t("linkFallback")} />
    </EmailLayout>
  );
}

export function buildContactMessageEmail(props: Props) {
  const t = getEmailTranslator(props.locale);
  return {
    subject: t("contactMessage.subject", { name: props.sender.name }),
    react: <ContactMessageEmail {...props} />,
    link: props.inboxUrl,
  };
}
