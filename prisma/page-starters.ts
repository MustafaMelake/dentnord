/**
 * Starter copy for the Home / Services / About / Contact pages (SiteSetting rows "page.*").
 *
 * Services / About / Contact: neutral texts that only describe how the dentist portal works: no
 * numbers, credentials, prices, names, reviews or claims. Home: the texts the home page showed
 * before they became editable (they used to live in messages/*.json), so the page looks the same
 * until the admin edits it. `{count}`, `{years}` and `{name}` are filled in from Settings.
 *
 * Every row is stored with `starter: true`, so the admin's content checklist lists the page until
 * someone reviews it and saves it from /admin/pages/*.
 *
 * Insert-only: a page that already has a row (edited or not) is never touched.
 */
import type { PrismaClient } from "../src/generated/prisma/client";

const t = (da: string, en: string) => ({ da, en });

export const PAGE_STARTERS = {
  "page.home": {
    metaTitle: t(
      "Dentnord — Præcise boreskabeloner til implantattandlæger",
      "Dentnord — Precise surgical guides for implant dentists",
    ),
    metaDescription: t(
      "Send din CBCT og intraorale scanning. Dentnord planlægger implantatpositionerne sammen med dig og leverer en printet boreskabelon med hylstre til din klinik.",
      "Send your CBCT and intraoral scan. Dentnord plans the implant positions with you and delivers a printed, sleeve-ready surgical guide to your clinic.",
    ),
    heroTrust: t(
      "Brugt af {count} tandklinikker i Danmark",
      "Trusted by {count} dental clinics in Denmark",
    ),
    heroTitle: t(
      "Præcise boreskabeloner til implantattandlæger.",
      "Precise surgical guides for implant dentists.",
    ),
    heroSubtitle: t(
      "Send din CBCT og intraorale scanning. Vi planlægger implantatpositionerne sammen med dig og leverer en printet skabelon med hylstre direkte til klinikken.",
      "Send your CBCT and intraoral scan. We plan the implant positions with you and deliver a printed, sleeve-ready guide to your clinic.",
    ),
    heroPrimaryCta: t("Indsend en case", "Submit a case"),
    heroSecondaryCta: t("Se ydelser", "Explore services"),
    heroDoctorRole: t("Tandlæge · implantatplanlægning", "Dentist · implant planning"),
    heroDoctorExperience: t("{years} års erfaring", "{years} years of experience"),
    workflowLabel: t("Sådan foregår det", "How it works"),
    workflowTitle: t("Fra scanning til skabelon i fire trin", "From scan to guide in four steps"),
    workflowStep1Title: t("Send dine scanninger", "Send your scans"),
    workflowStep1Body: t(
      "Upload CBCT (DICOM) og intraorale scanninger (STL/PLY) sikkert i portalen.",
      "Upload CBCT (DICOM) and intraoral scans (STL/PLY) securely in the portal.",
    ),
    workflowStep2Title: t("Digital planlægning", "Digital planning"),
    workflowStep2Body: t(
      "Vi planlægger implantatpositionerne protetisk med dit implantatsystem og dit kit.",
      "We plan the implant positions prosthetically, with your implant system and kit.",
    ),
    workflowStep3Title: t("Du godkender planen", "You approve the plan"),
    workflowStep3Body: t(
      "Gennemgå planen online, og godkend den eller bed om ændringer.",
      "Review the plan online, then approve it or ask for changes.",
    ),
    workflowStep4Title: t("Printet og afsendt", "Printed & shipped"),
    workflowStep4Body: t(
      "Skabelonen printes, monteres med hylstre og sendes til din klinik.",
      "Your guide is printed, fitted with sleeves and shipped to your clinic.",
    ),
    statement: t(
      "Præcision skal planlægges, ikke håbes på. Hver skabelon bygger på dine scanninger og en plan, du selv har gennemgået og godkendt, så operationen følger planen, og selve dagen byder på færre overraskelser.",
      "Precision is planned, not hoped for. Every guide starts from your scans and a plan you have reviewed and approved, so the surgery follows the plan and the day itself holds fewer surprises.",
    ),
    servicesLabel: t("Ydelser", "Services"),
    servicesTitle: t(
      "Planlægning og skabeloner til alle implantatcases",
      "Planning and guides for every implant case",
    ),
    portalLabel: t("Portalen", "The portal"),
    portalTitle: t(
      "En case, du kan følge fra scanning til levering",
      "A case you can follow, from scan to delivery",
    ),
    portalIntro: t(
      "Sådan ser din tandlægeportal ud: alle cases, filer og beslutninger samlet ét sted.",
      "This is your dentist portal: every case, file and decision in one place.",
    ),
    guideLabel: t("I 3D", "In 3D"),
    guideTitle: t("Se skabelonen, før den bliver printet", "See the guide before it's printed"),
    guideBody: t(
      "Træk for at dreje en boreskabelon: en gennemsigtig resinbue med metalhylstre ved de planlagte implantatpositioner. Planlagt digitalt, printet i eget laboratorium.",
      "Drag to rotate a surgical guide: a translucent resin arch with metal sleeves at the planned implant positions. Planned digitally, printed in-house.",
    ),
    guideCta: t("Indsend en case", "Submit a case"),
    aboutLabel: t("Om os", "About"),
    aboutTitle: t("Planlagt af en tandlæge, til tandlæger", "Planned by a dentist, for dentists"),
    aboutCta: t("Kontakt {name}", "Contact {name}"),
    aboutCtaGeneric: t("Kontakt os", "Contact us"),
    technologyLabel: t("Teknologi", "Technology"),
    technologyTitle: t("Digitalt fra scanning til hylster", "Digital from scan to sleeve"),
    technologyIntro: t(
      "Planlægning, print og efterbehandling under samme tag, så intet går tabt mellem trinene.",
      "Planning, printing and finishing under one roof, so nothing gets lost between steps.",
    ),
    technologyFeature1Title: t("Digital planlægning", "Digital planning"),
    technologyFeature1Body: t(
      "Protetisk drevet implantatplanlægning ud fra din CBCT og intraorale scanning.",
      "Prosthetically driven implant planning from your CBCT and intraoral scan.",
    ),
    technologyFeature2Title: t("3D-print i eget laboratorium", "In-house 3D printing"),
    technologyFeature2Body: t(
      "Skabelonerne printes og efterbehandles i vores eget laboratorium.",
      "Guides are printed and post-processed in our own lab.",
    ),
    technologyFeature3Title: t("Kompatible hylstre", "Sleeve compatibility"),
    technologyFeature3Body: t(
      "Hylstre, der passer til dit implantatsystem og dit kirurgiske kit.",
      "Sleeves matched to your implant system and surgical kit.",
    ),
    testimonialsLabel: t("Udtalelser", "Testimonials"),
    testimonialsTitle: t("Det siger tandlægerne", "What dentists say"),
    ctaTitle: t("Klar til at sende din første case?", "Ready to send your first case?"),
    ctaBody: t(
      "Opret en tandlægekonto, upload dine scanninger, og få en plan til gennemsyn.",
      "Create a dentist account, upload your scans and get a plan to review.",
    ),
    ctaPrimary: t("Indsend en case", "Submit a case"),
    ctaSecondary: t("Kontakt os", "Contact us"),
    starter: true,
  },
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
