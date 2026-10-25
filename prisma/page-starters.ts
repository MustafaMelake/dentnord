/**
 * Starter copy for the Services / About / Contact pages (SiteSetting rows "page.*").
 *
 * Neutral texts that only describe how the dentist portal works: no numbers, credentials, prices,
 * names, reviews or claims. Every row is stored with `starter: true`, so the admin's content
 * checklist lists the page until someone reviews it and saves it from /admin/pages/*.
 *
 * Insert-only: a page that already has a row (edited or not) is never touched.
 */
import type { PrismaClient } from "../src/generated/prisma/client";

const t = (da: string, en: string) => ({ da, en });

export const PAGE_STARTERS = {
  "page.services": {
    title: t(
      "Boreskabeloner og digital implantatplanlægning",
      "Surgical guides and digital implant planning",
    ),
    intro: t(
      "Digital implantatplanlægning og 3D-printede boreskabeloner til tandklinikker. Send dine scanninger via tandlægeportalen, gennemgå planen online, og godkend den, før noget bliver produceret.",
      "Digital implant planning and 3D-printed surgical guides for dental clinics. Send your scans through the dentist portal, review the plan online and approve it before anything is produced.",
    ),
    listHeading: t("Det kan vi hjælpe dig med", "What we can help you with"),
    processHeading: t("Sådan bestiller du", "How ordering works"),
    processBody: t(
      "Opret en tandlægekonto, og indsend en case med din CBCT og intraorale scanning.\n\nVi planlægger implantatpositionerne og sender dig planen til gennemsyn. Du kan godkende den eller bede om ændringer.\n\nNår du har godkendt planen, bliver skabelonen produceret og sendt til din klinik.",
      "Create a dentist account and submit a case with your CBCT and intraoral scan.\n\nWe plan the implant positions and send you the plan to review. You can approve it or ask for changes.\n\nOnce you have approved the plan, the guide is produced and shipped to your clinic.",
    ),
    ctaTitle: t("Klar til at planlægge din næste case?", "Ready to plan your next case?"),
    ctaBody: t(
      "Indsend dine scanninger via tandlægeportalen, og få en plan til gennemsyn.",
      "Submit your scans through the dentist portal and get a plan to review.",
    ),
    ctaLabel: t("Indsend en case", "Submit a case"),
    imageId: null,
    starter: true,
  },
  "page.about": {
    title: t("Om Dentnord", "About Dentnord"),
    intro: t(
      "Dentnord designer og producerer boreskabeloner til tandimplantater, planlagt sammen med den tandlæge, der indsætter dem.",
      "Dentnord designs and produces surgical guides for dental implants, planned together with the dentist who places them.",
    ),
    expertiseHeading: t("Kompetenceområder", "Areas of expertise"),
    approachHeading: t("Sådan arbejder vi", "How we work"),
    approachBody: t(
      "Hver plan tager udgangspunkt i dine scanninger og den behandling, du har planlagt. Vi planlægger implantatpositionerne digitalt og deler planen med dig, før noget bliver produceret.\n\nSkabelonen bliver først lavet, når du har godkendt planen, så du har kontrollen over resultatet.",
      "Every plan starts from your scans and the treatment you have in mind. We plan the implant positions digitally and share the plan with you before anything is produced.\n\nThe guide is only made once you have approved the plan, so you stay in control of the result.",
    ),
    statsHeading: t("Dentnord i tal", "Dentnord in numbers"),
    ctaTitle: t("Lad os planlægge din næste case sammen", "Let's plan your next case together"),
    ctaBody: t(
      "Opret en tandlægekonto, og indsend dine scanninger via portalen.",
      "Create a dentist account and submit your scans through the portal.",
    ),
    ctaLabel: t("Indsend en case", "Submit a case"),
    imageId: null,
    starter: true,
  },
  "page.contact": {
    title: t("Kontakt os", "Get in touch"),
    intro: t(
      "Spørgsmål om en case, vores ydelser eller tandlægeportalen? Send os en besked.",
      "Questions about a case, our services or the dentist portal? Send us a message.",
    ),
    detailsHeading: t("Kontaktoplysninger", "Contact details"),
    formHeading: t("Send en besked", "Send a message"),
    formIntro: t(
      "Udfyld formularen, så svarer vi dig på e-mail.",
      "Fill in the form and we'll reply by email.",
    ),
    starter: true,
  },
} as const;

/** Creates the missing page rows. Returns the keys it created (existing rows are left alone). */
export async function seedPageTexts(db: PrismaClient) {
  const created: string[] = [];
  for (const [key, value] of Object.entries(PAGE_STARTERS)) {
    const existing = await db.siteSetting.findUnique({ where: { key }, select: { key: true } });
    if (existing) continue;
    await db.siteSetting.create({ data: { key, value } });
    created.push(key);
  }
  return created;
}
