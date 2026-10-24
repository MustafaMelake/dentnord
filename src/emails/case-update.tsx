import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, EmailLinkFallback, emailText } from "./components/email-layout";
import { getEmailTranslator, type EmailLocale } from "./i18n";

// Case lifecycle emails (to the dentist or the lab). One template, one set of strings per kind in
// messages → emails.caseUpdate. GDPR: the case number, shipping details and a link only. Never free
// text typed by either side (messages, comments, reasons) and never the patient code: the reader
// opens the case to see those.

export const CASE_UPDATE_KINDS = [
  // to the dentist
  "needsFiles",
  "planReady",
  "shipped",
  "cancelled",
  "messageToDentist",
  // to the lab
  "resubmitted",
  "planApproved",
  "changesRequested",
  "delivered",
  "cancelledByDentist",
  "messageToAdmin",
] as const;
export type CaseUpdateKind = (typeof CASE_UPDATE_KINDS)[number];

type Props = {
  locale: EmailLocale;
  kind: CaseUpdateKind;
  caseUrl: string;
  caseNumber: string;
  /** shipped */
  shipping?: { carrier: string; trackingNumber: string; trackingUrl: string | null };
  /** planReady */
  planVersion?: number;
  /** lab emails: who it's about */
  clinic?: string;
};

export function CaseUpdateEmail({
  locale,
  kind,
  caseUrl,
  caseNumber,
  shipping,
  planVersion,
  clinic,
}: Props) {
  const t = getEmailTranslator(locale);
  const values = { caseNumber, version: planVersion ?? 1, clinic: clinic ?? "" };
  const rows: [string, string][] = [[t("caseUpdate.caseNumber"), caseNumber]];
  if (clinic) rows.push([t("caseUpdate.clinic"), clinic]);
  if (shipping) {
    rows.push([t("caseUpdate.carrier"), shipping.carrier]);
    rows.push([t("caseUpdate.trackingNumber"), shipping.trackingNumber]);
  }
  return (
    <EmailLayout
      lang={locale}
      preview={t(`caseUpdate.${kind}.subject`, values)}
      footer={t("footer")}
    >
      <Text style={emailText.heading}>{t(`caseUpdate.${kind}.heading`, values)}</Text>
      <Text style={emailText.value}>{t(`caseUpdate.${kind}.body`, values)}</Text>
      {rows.map(([label, value]) => (
        <div key={label}>
          <Text style={emailText.label}>{label}</Text>
          <Text style={emailText.value}>{value}</Text>
        </div>
      ))}
      {shipping?.trackingUrl && (
        <EmailButton href={shipping.trackingUrl}>{t("caseUpdate.track")}</EmailButton>
      )}
      <EmailButton href={caseUrl}>{t("caseUpdate.cta")}</EmailButton>
      <EmailLinkFallback href={caseUrl} label={t("linkFallback")} />
    </EmailLayout>
  );
}

export function buildCaseUpdateEmail(props: Props) {
  const t = getEmailTranslator(props.locale);
  const values = {
    caseNumber: props.caseNumber,
    version: props.planVersion ?? 1,
    clinic: props.clinic ?? "",
  };
  return {
    subject: t(`caseUpdate.${props.kind}.subject`, values),
    react: <CaseUpdateEmail {...props} />,
    link: props.caseUrl,
  };
}
