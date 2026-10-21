import { z } from "zod";

import { parseKroner } from "@/lib/price";

// Admin content schemas, shared by the forms (react-hook-form + zodResolver) and the Server Actions.
// Error messages are keys in `admin.validation` (en.json). Translatable text is `{ da, en }`.

// ── Building blocks ──────────────────────────────────────────────────────────

const text = (max: number) => z.string().trim().max(max, { error: "tooLong" });

/** `{ da, en }` where either side may be empty (the form flags missing translations). */
export const bilingual = (max = 500) => z.object({ da: text(max), en: text(max) });

/** `{ da, en }` that needs at least one language filled in. */
export const bilingualRequired = (max = 500) =>
  bilingual(max).refine((v) => v.da !== "" || v.en !== "", { error: "requiredOneLanguage" });

/** `{ da, en }` that needs both languages (e.g. image alt text). */
export const bilingualBoth = (max = 500) =>
  z.object({
    da: text(max).min(1, { error: "required" }),
    en: text(max).min(1, { error: "required" }),
  });

export type Bilingual = { da: string; en: string };
export const emptyBilingual = (): Bilingual => ({ da: "", en: "" });

/** Normalises a JSON column into `{ da, en }` strings for a form. */
export function toBilingual(value: unknown): Bilingual {
  const v = (value && typeof value === "object" ? value : {}) as Partial<
    Record<"da" | "en", unknown>
  >;
  return { da: typeof v.da === "string" ? v.da : "", en: typeof v.en === "string" ? v.en : "" };
}

const id = z.string().trim().min(1).max(64);
const optionalId = id
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/** Optional whole number typed into a text input: "" → null. */
const optionalCount = (max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), { error: "wholeNumber" })
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || v <= max, { error: "tooLarge" });

// ── Prices ───────────────────────────────────────────────────────────────────

/** The price block of a form: kroner text + "from" + "price on request" → øre or null. */
export const priceSchema = z
  .object({
    onRequest: z.boolean(),
    amount: z.string().trim().max(32),
    from: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.onRequest) return;
    if (v.amount === "")
      ctx.addIssue({ code: "custom", path: ["amount"], message: "priceRequired" });
    else if (parseKroner(v.amount) === null) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "priceInvalid" });
    }
  })
  .transform((v) => ({
    priceAmount: v.onRequest ? null : parseKroner(v.amount),
    priceFrom: v.onRequest ? false : v.from,
  }));

// ── Catalog ──────────────────────────────────────────────────────────────────

export const serviceSchema = z.object({
  title: bilingualRequired(120),
  summary: bilingual(400),
  description: bilingual(4000),
  price: priceSchema,
  priceNote: bilingual(120),
  imageId: optionalId,
  published: z.boolean(),
});
export type ServiceInput = z.input<typeof serviceSchema>;

export const guideTypeSchema = z.object({
  name: bilingualRequired(120),
  description: bilingual(1000),
  active: z.boolean(),
});
export type GuideTypeInput = z.input<typeof guideTypeSchema>;

const millimetres = (min: number, max: number) =>
  z
    .array(
      z
        .number({ error: "numberInvalid" })
        .min(min, { error: "outOfRange" })
        .max(max, { error: "outOfRange" })
        .refine((n) => Math.round(n * 100) === n * 100, { error: "twoDecimals" }),
    )
    .max(40, { error: "tooMany" })
    .transform((list) => [...new Set(list)].sort((a, b) => a - b));

export const implantSystemSchema = z.object({
  brand: text(80).min(1, { error: "required" }),
  line: text(80).min(1, { error: "required" }),
  diameters: millimetres(1, 10),
  lengths: millimetres(3, 30),
  active: z.boolean(),
});
export type ImplantSystemInput = z.input<typeof implantSystemSchema>;

export const surgicalKitSchema = z.object({
  name: text(120).min(1, { error: "required" }),
  manufacturer: text(80),
  implantSystemIds: z.array(id).max(200),
  active: z.boolean(),
});
export type SurgicalKitInput = z.input<typeof surgicalKitSchema>;

// ── Testimonials ─────────────────────────────────────────────────────────────

export const testimonialSchema = z
  .object({
    quote: bilingualRequired(600),
    authorName: text(120).min(1, { error: "required" }),
    clinic: text(160),
    consent: z.boolean(),
    published: z.boolean(),
  })
  .refine((v) => !v.published || v.consent, { error: "consentRequired", path: ["published"] });
export type TestimonialInput = z.input<typeof testimonialSchema>;

// ── Portfolio ────────────────────────────────────────────────────────────────

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const portfolioSchema = z.object({
  slug: text(80).min(1, { error: "required" }).regex(SLUG_PATTERN, { error: "slugInvalid" }),
  title: bilingualRequired(160),
  summary: bilingual(600),
  guideTypeId: optionalId,
  implantCount: optionalCount(32),
  images: z.array(z.object({ mediaId: id, caption: bilingual(200) })).max(30, { error: "tooMany" }),
  published: z.boolean(),
});
export type PortfolioInput = z.input<typeof portfolioSchema>;

/** "Guided full-arch: Århus 2026" → "guided-full-arch-arhus-2026". */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// ── Site settings ────────────────────────────────────────────────────────────

export const statsSchema = z.object({
  clinics: optionalCount(100_000),
  yearsExperience: optionalCount(80),
  guidesDelivered: optionalCount(10_000_000),
  turnaroundDays: optionalCount(365),
});
export type StatsInput = z.input<typeof statsSchema>;

export const contactSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, { error: "emailInvalid" }),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9][0-9 ()-]{5,22}$/.test(v), { error: "phoneInvalid" }),
  address: bilingual(300),
  cvr: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{8}$/.test(v.replace(/\s/g, "")), { error: "cvrInvalid" }),
});
export type ContactInput = z.input<typeof contactSchema>;

export const doctorSchema = z.object({
  name: text(120),
  credentials: bilingual(160),
  bio: bilingual(1500),
  city: text(80),
  languages: bilingual(160),
  portraitId: optionalId,
  cardPhotoId: optionalId,
  expertise: z
    .array(z.object({ id, title: bilingualRequired(80), tag: bilingual(60) }))
    .max(12, { error: "tooMany" }),
});
export type DoctorInput = z.input<typeof doctorSchema>;

export const accountsSchema = z.object({ reviewDays: optionalCount(60) });
export type AccountsInput = z.input<typeof accountsSchema>;

export const legalSchema = z.object({
  terms: bilingual(50_000),
  privacy: bilingual(50_000),
});
export type LegalInput = z.input<typeof legalSchema>;

export const siteImagesSchema = z.object({ heroId: optionalId, technologyId: optionalId });
export type SiteImagesInput = z.input<typeof siteImagesSchema>;

// ── Media ────────────────────────────────────────────────────────────────────

export const MEDIA_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;
export type MediaType = keyof typeof MEDIA_TYPES;
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export const mediaUploadSchema = z.object({
  fileName: text(200).min(1),
  contentType: z.enum(Object.keys(MEDIA_TYPES) as [MediaType, ...MediaType[]], {
    error: "imageType",
  }),
  sizeBytes: z.number().int().min(1).max(MEDIA_MAX_BYTES, { error: "imageTooLarge" }),
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
});

export const mediaFinalizeSchema = z.object({
  key: text(300).min(1),
  token: text(1000).min(1),
  alt: bilingualBoth(200),
});

export const mediaAltSchema = z.object({ id, alt: bilingualBoth(200) });

// ── Lists ────────────────────────────────────────────────────────────────────

export const reorderSchema = z.object({ ids: z.array(id).min(1).max(500) });
