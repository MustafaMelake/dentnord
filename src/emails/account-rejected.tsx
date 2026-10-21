import { Text } from "@react-email/components";

import { EmailLayout, emailText } from "./components/email-layout";
import { getEmailTranslator, type EmailLocale } from "./i18n";

// To the dentist: their account was not approved (or was disabled). The reason is optional.

type Props = { locale: EmailLocale; name: string; reason?: string | null; contactEmail: string };

export function AccountRejectedEmail({ locale, name, reason, contactEmail }: Props) {
  const t = getEmailTranslator(locale);
  return (
    <EmailLayout lang={locale} preview={t("accountRejected.preview")} footer={t("footer")}>
      <Text style={emailText.heading}>{t("accountRejected.heading")}</Text>
      <Text style={emailText.body}>{t("greeting", { name })}</Text>
      <Text style={emailText.body}>{t("accountRejected.body")}</Text>
      {reason && (
        <>
          <Text style={emailText.label}>{t("accountRejected.reasonLabel")}</Text>
          <Text style={emailText.quote}>{reason}</Text>
        </>
      )}
      <Text style={emailText.body}>{t("accountRejected.contact", { email: contactEmail })}</Text>
    </EmailLayout>
  );
}

export function buildAccountRejectedEmail(props: Props) {
  const t = getEmailTranslator(props.locale);
  return { subject: t("accountRejected.subject"), react: <AccountRejectedEmail {...props} /> };
}
