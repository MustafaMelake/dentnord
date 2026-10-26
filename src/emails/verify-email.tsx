import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, EmailLinkFallback, emailText } from "./components/email-layout";
import { getEmailTranslator, type EmailLocale } from "./i18n";

// To a new user: confirm the email address (Better Auth `sendVerificationEmail`, only with
// EMAIL_VERIFICATION=on). Valid for 24 hours.

type Props = { locale: EmailLocale; name: string; verifyUrl: string };

export function VerifyEmail({ locale, name, verifyUrl }: Props) {
  const t = getEmailTranslator(locale);
  return (
    <EmailLayout lang={locale} preview={t("verifyEmail.preview")} footer={t("footer")}>
      <Text style={emailText.heading}>{t("verifyEmail.heading")}</Text>
      <Text style={emailText.body}>{t("greeting", { name })}</Text>
      <Text style={emailText.body}>{t("verifyEmail.body")}</Text>
      <EmailButton href={verifyUrl}>{t("verifyEmail.cta")}</EmailButton>
      <EmailLinkFallback href={verifyUrl} label={t("linkFallback")} />
      <Text style={emailText.muted}>{t("verifyEmail.ignore")}</Text>
    </EmailLayout>
  );
}

export function buildVerifyEmail(props: Props) {
  const t = getEmailTranslator(props.locale);
  return {
    subject: t("verifyEmail.subject"),
    react: <VerifyEmail {...props} />,
    link: props.verifyUrl,
  };
}
