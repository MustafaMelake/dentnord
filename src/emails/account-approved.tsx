import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, EmailLinkFallback, emailText } from "./components/email-layout";
import { getEmailTranslator, type EmailLocale } from "./i18n";

// To the dentist: their account was approved (or re-activated).

type Props = { locale: EmailLocale; name: string; portalUrl: string };

export function AccountApprovedEmail({ locale, name, portalUrl }: Props) {
  const t = getEmailTranslator(locale);
  return (
    <EmailLayout lang={locale} preview={t("accountApproved.preview")} footer={t("footer")}>
      <Text style={emailText.heading}>{t("accountApproved.heading")}</Text>
      <Text style={emailText.body}>{t("greeting", { name })}</Text>
      <Text style={emailText.body}>{t("accountApproved.body")}</Text>
      <EmailButton href={portalUrl}>{t("accountApproved.cta")}</EmailButton>
      <EmailLinkFallback href={portalUrl} label={t("linkFallback")} />
    </EmailLayout>
  );
}

export function buildAccountApprovedEmail(props: Props) {
  const t = getEmailTranslator(props.locale);
  return {
    subject: t("accountApproved.subject"),
    react: <AccountApprovedEmail {...props} />,
    link: props.portalUrl,
  };
}
