import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, EmailLinkFallback, emailText } from "./components/email-layout";
import { getEmailTranslator, type EmailLocale } from "./i18n";

// To the admin: a new dentist registered and waits for approval.

type Props = {
  locale: EmailLocale;
  reviewUrl: string;
  dentist: { name: string; email: string; clinicName: string; country: string; phone: string };
};

export function DentistRegisteredEmail({ locale, reviewUrl, dentist }: Props) {
  const t = getEmailTranslator(locale);
  const rows = [
    [t("dentistRegistered.name"), dentist.name],
    [t("dentistRegistered.clinic"), dentist.clinicName],
    [t("dentistRegistered.email"), dentist.email],
    [t("dentistRegistered.phone"), dentist.phone],
    [t("dentistRegistered.country"), dentist.country],
  ] as const;
  return (
    <EmailLayout lang={locale} preview={t("dentistRegistered.preview")} footer={t("footer")}>
      <Text style={emailText.heading}>{t("dentistRegistered.heading")}</Text>
      <Text style={emailText.body}>{t("dentistRegistered.body")}</Text>
      {rows.map(([label, value]) => (
        <div key={label}>
          <Text style={emailText.label}>{label}</Text>
          <Text style={emailText.value}>{value || "–"}</Text>
        </div>
      ))}
      <EmailButton href={reviewUrl}>{t("dentistRegistered.cta")}</EmailButton>
      <EmailLinkFallback href={reviewUrl} label={t("linkFallback")} />
    </EmailLayout>
  );
}

export function buildDentistRegisteredEmail(props: Props) {
  const t = getEmailTranslator(props.locale);
  return {
    subject: t("dentistRegistered.subject", { clinic: props.dentist.clinicName }),
    react: <DentistRegisteredEmail {...props} />,
    link: props.reviewUrl,
  };
}
