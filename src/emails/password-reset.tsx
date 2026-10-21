import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, EmailLinkFallback, emailText } from "./components/email-layout";
import { getEmailTranslator, type EmailLocale } from "./i18n";

// To the user: a password reset link (Better Auth `sendResetPassword`). Valid for one hour.

type Props = { locale: EmailLocale; name: string; resetUrl: string };

export function PasswordResetEmail({ locale, name, resetUrl }: Props) {
  const t = getEmailTranslator(locale);
  return (
    <EmailLayout lang={locale} preview={t("passwordReset.preview")} footer={t("footer")}>
      <Text style={emailText.heading}>{t("passwordReset.heading")}</Text>
      <Text style={emailText.body}>{t("greeting", { name })}</Text>
      <Text style={emailText.body}>{t("passwordReset.body")}</Text>
      <EmailButton href={resetUrl}>{t("passwordReset.cta")}</EmailButton>
      <EmailLinkFallback href={resetUrl} label={t("linkFallback")} />
      <Text style={emailText.muted}>{t("passwordReset.ignore")}</Text>
    </EmailLayout>
  );
}

export function buildPasswordResetEmail(props: Props) {
  const t = getEmailTranslator(props.locale);
  return {
    subject: t("passwordReset.subject"),
    react: <PasswordResetEmail {...props} />,
    link: props.resetUrl,
  };
}
