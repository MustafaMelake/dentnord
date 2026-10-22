import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, EmailLinkFallback, emailText } from "./components/email-layout";
import { getEmailTranslator, type EmailLocale } from "./i18n";

// To the admin: a dentist submitted a case. No patient data: case number, clinic, guide type and
// the number of implant sites only.

type Props = {
  locale: EmailLocale;
  caseUrl: string;
  caseNumber: string;
  dentistName: string;
  clinicName: string;
  guideType: string;
  implantCount: number;
};

export function CaseSubmittedEmail({
  locale,
  caseUrl,
  caseNumber,
  dentistName,
  clinicName,
  guideType,
  implantCount,
}: Props) {
  const t = getEmailTranslator(locale);
  const rows = [
    [t("caseSubmitted.caseNumber"), caseNumber],
    [t("caseSubmitted.dentist"), [dentistName, clinicName].filter(Boolean).join(", ")],
    [t("caseSubmitted.guideType"), guideType],
    [t("caseSubmitted.implants"), String(implantCount)],
  ] as const;
  return (
    <EmailLayout
      lang={locale}
      preview={t("caseSubmitted.preview", { caseNumber })}
      footer={t("footer")}
    >
      <Text style={emailText.heading}>{t("caseSubmitted.heading")}</Text>
      {rows.map(([label, value]) => (
        <div key={label}>
          <Text style={emailText.label}>{label}</Text>
          <Text style={emailText.value}>{value || "–"}</Text>
        </div>
      ))}
      <EmailButton href={caseUrl}>{t("caseSubmitted.cta")}</EmailButton>
      <EmailLinkFallback href={caseUrl} label={t("linkFallback")} />
    </EmailLayout>
  );
}

export function buildCaseSubmittedEmail(props: Props) {
  const t = getEmailTranslator(props.locale);
  return {
    subject: t("caseSubmitted.subject", { caseNumber: props.caseNumber, clinic: props.clinicName }),
    react: <CaseSubmittedEmail {...props} />,
    link: props.caseUrl,
  };
}
