/**
 * Seed — run with `pnpm db:seed` (after `pnpm db:migrate`).
 *
 * ⚠️  EVERYTHING BELOW IS EXAMPLE DATA. Services, prices, guide types, implant systems (diameters and
 * lengths) and kits are placeholders for development. Verify against manufacturer catalogs and
 * Dentnord's real price list, then edit everything from the admin dashboard.
 *
 * Idempotent: rows are upserted by their unique keys, so existing rows are left as they are (catalog
 * rows are only created, never overwritten).
 * The admin user comes from ADMIN_EMAIL + SEED_ADMIN_PASSWORD. Their password is only set on first creation.
 * Refuses to run against `production` unless SEED_ADMIN_PASSWORD is set in the shell (see seed-guard.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../src/generated/prisma/client";
import { withVerifiedSsl } from "../src/lib/pg-url";
import { seedPageTexts } from "./page-starters";
import { seedRefusal } from "./seed-guard";

// The guard compares against the .env FILE, because `pnpm db:seed` (Prisma CLI) has usually loaded
// .env into the environment already. loadEnvFile never overrides variables that are already set.
const dotenv = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};
if (existsSync(".env")) process.loadEnvFile(".env");

const refusal = seedRefusal(process.env, dotenv);
if (refusal) {
  console.error(`✗ ${refusal}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
// The target, without credentials: Neon endpoint id + declared branch.
console.log(
  `→ seeding NEON_BRANCH=${process.env.NEON_BRANCH ?? "?"} at ${new URL(databaseUrl).hostname.split(".")[0]}`,
);

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: withVerifiedSsl(databaseUrl) }),
});

const EXAMPLE = "EXAMPLE — verify before going live.";
const t = (da: string, en: string) => ({ da, en });

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("⚠ ADMIN_EMAIL or SEED_ADMIN_PASSWORD missing: skipping admin user.");
    return;
  }
  if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", dentistStatus: "APPROVED" },
    });
    console.log(`✓ admin exists (${email}): role ensured, password unchanged`);
    return;
  }

  const id = crypto.randomUUID();
  await db.user.create({
    data: {
      id,
      email,
      name: "Dr. Hossam",
      emailVerified: true,
      role: "ADMIN",
      dentistStatus: "APPROVED",
      preferredLocale: "en",
      accounts: {
        create: {
          id: crypto.randomUUID(),
          accountId: id,
          providerId: "credential", // Better Auth's email+password provider
          password: await hashPassword(password),
        },
      },
    },
  });
  console.log(`✓ admin created (${email})`);
}

async function seedServices() {
  const services = [
    {
      slug: "implant-planning",
      title: t("Digital implantatplanlægning", "Digital implant planning"),
      summary: t(
        `EKSEMPEL: Prostetisk drevet planlægning ud fra CBCT og intraoral scanning. ${EXAMPLE}`,
        `EXAMPLE: Prosthetically driven planning from CBCT and intraoral scan. ${EXAMPLE}`,
      ),
      priceAmount: 95000,
      icon: "ScanLine",
    },
    {
      slug: "surgical-guide",
      title: t("Boreskabelon", "Surgical guide"),
      summary: t(
        `EKSEMPEL: 3D-printet boreskabelon med metalhylstre, klar til brug. ${EXAMPLE}`,
        `EXAMPLE: 3D-printed surgical guide with metal sleeves, ready to use. ${EXAMPLE}`,
      ),
      priceAmount: 165000,
      icon: "Crosshair",
    },
    {
      slug: "full-arch",
      title: t("Helkæbe og stackable guides", "Full-arch & stackable guides"),
      summary: t(
        `EKSEMPEL: Knogleforankrede, stablede skabeloner til helkæbebehandling. ${EXAMPLE}`,
        `EXAMPLE: Bone-anchored, stackable guides for full-arch treatment. ${EXAMPLE}`,
      ),
      priceAmount: null,
      icon: "Layers",
    },
    {
      slug: "planning-consultation",
      title: t("Planlægningskonsultation", "Planning consultation"),
      summary: t(
        `EKSEMPEL: Gennemgang af planen online inden produktion. ${EXAMPLE}`,
        `EXAMPLE: Online review of the plan before production. ${EXAMPLE}`,
      ),
      priceAmount: 0,
      icon: "MessagesSquare",
    },
  ];
  for (const [i, s] of services.entries()) {
    await db.service.upsert({
      where: { slug: s.slug },
      create: { ...s, sortOrder: i, priceNote: t("ekskl. moms", "excl. VAT") },
      update: {},
    });
  }
  console.log(`✓ ${services.length} services`);
}

async function seedGuideTypes() {
  const guideTypes = [
    { slug: "tooth-supported", name: t("Tandstøttet", "Tooth-supported"), priceAmount: 165000 },
    {
      slug: "mucosa-supported",
      name: t("Slimhindestøttet", "Mucosa-supported"),
      priceAmount: 185000,
    },
    { slug: "bone-supported", name: t("Knoglestøttet", "Bone-supported"), priceAmount: 225000 },
    { slug: "pilot-drill", name: t("Pilotbor-skabelon", "Pilot drill guide"), priceAmount: 120000 },
  ];
  for (const [i, g] of guideTypes.entries()) {
    await db.guideType.upsert({
      where: { slug: g.slug },
      create: { ...g, sortOrder: i, description: t(`EKSEMPEL. ${EXAMPLE}`, `EXAMPLE. ${EXAMPLE}`) },
      update: {},
    });
  }
  console.log(`✓ ${guideTypes.length} guide types`);
}

async function seedImplantSystemsAndKits() {
  // EXAMPLE dimensions (mm), not authoritative.
  const systems = [
    {
      brand: "Straumann",
      line: "BLX",
      diameters: [3.5, 3.75, 4.0, 4.5, 5.0, 5.5, 6.5],
      lengths: [6, 8, 10, 12, 14, 16, 18],
    },
    {
      brand: "Straumann",
      line: "Bone Level Tapered",
      diameters: [2.9, 3.3, 4.1, 4.8],
      lengths: [8, 10, 12, 14, 16, 18],
    },
    {
      brand: "Nobel Biocare",
      line: "NobelActive",
      diameters: [3.0, 3.5, 4.3, 5.0, 5.5],
      lengths: [8.5, 10, 11.5, 13, 15, 18],
    },
    {
      brand: "Nobel Biocare",
      line: "NobelParallel CC",
      diameters: [3.75, 4.3, 5.0, 5.5],
      lengths: [7, 8.5, 10, 11.5, 13, 15, 18],
    },
    { brand: "MIS", line: "C1", diameters: [3.3, 3.75, 4.2, 5.0], lengths: [8, 10, 11.5, 13, 16] },
    { brand: "MIS", line: "V3", diameters: [3.3, 3.9, 4.3, 5.0], lengths: [8, 10, 11.5, 13, 16] },
    {
      brand: "Neodent",
      line: "Helix GM",
      diameters: [3.5, 3.75, 4.0, 4.3, 5.0, 6.0],
      lengths: [8, 10, 11.5, 13, 16, 18],
    },
    {
      brand: "Neodent",
      line: "Drive GM",
      diameters: [3.5, 4.3, 5.0],
      lengths: [8, 10, 11.5, 13, 16],
    },
  ];
  for (const [i, s] of systems.entries()) {
    await db.implantSystem.upsert({
      where: { brand_line: { brand: s.brand, line: s.line } },
      create: { ...s, sortOrder: i, notes: EXAMPLE },
      update: {},
    });
  }

  const kits = [
    { name: "Straumann Guided Surgery Cassette", manufacturer: "Straumann", brand: "Straumann" },
    {
      name: "NobelGuide Guided Surgery Kit",
      manufacturer: "Nobel Biocare",
      brand: "Nobel Biocare",
    },
    { name: "MIS Guided Surgery Kit", manufacturer: "MIS", brand: "MIS" },
    { name: "Neodent Guided Surgery Kit (GM)", manufacturer: "Neodent", brand: "Neodent" },
  ];
  for (const [i, { brand, ...k }] of kits.entries()) {
    const compatible = await db.implantSystem.findMany({ where: { brand }, select: { id: true } });
    await db.surgicalKit.upsert({
      where: { name: k.name },
      create: {
        ...k,
        sortOrder: i,
        description: t(`EKSEMPEL. ${EXAMPLE}`, `EXAMPLE. ${EXAMPLE}`),
        implantSystems: { connect: compatible },
      },
      update: {},
    });
  }
  console.log(`✓ ${systems.length} implant systems, ${kits.length} surgical kits`);
}

async function seedSiteSettings() {
  const settings = {
    contact: {
      email: process.env.ADMIN_EMAIL ?? "info.dentnord@gmail.com",
      phone: "",
      address: t("", ""),
      cvr: "",
    },
    // Shown on the pending-approval page: "we review new accounts within [X] working days".
    accounts: { reviewDays: null },
    hero: {
      eyebrow: t("Guidet implantatkirurgi", "Guided implant surgery"),
      title: t(
        "EKSEMPEL: Præcise boreskabeloner, planlagt sammen med dig.",
        "EXAMPLE: Precise surgical guides, planned with you.",
      ),
    },
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.siteSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log(`✓ ${Object.keys(settings).length} site settings`);
}

async function seedPages() {
  const created = await seedPageTexts(db);
  console.log(
    `✓ page texts: ${created.length ? `created ${created.join(", ")}` : "already there"}`,
  );
}

async function main() {
  await seedAdmin();
  await seedServices();
  await seedGuideTypes();
  await seedImplantSystemsAndKits();
  await seedSiteSettings();
  await seedPages();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
