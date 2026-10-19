@AGENTS.md

# Dentnord

B2B website for Dr. Hossam (Denmark), who designs and manufactures **surgical guides for dental
implants**. The audience is **dentists, not patients**.

1. **Marketing site** (`/[locale]/…`, premium look): Home, Services, Portfolio (cases), About, Contact,
   plus an interactive 3D surgical-guide model (React Three Fiber).
2. **Dentist portal** (`/[locale]/portal/…`): sign up (admin approval required), submit cases
   (CBCT/DICOM + intraoral scan STL/PLY + FDI implant sites, implant system, diameter, length,
   guide type, surgical kit), track status, approve the plan or request changes, message the lab.
3. **Admin dashboard** (`/admin/…`, English only): cases + statuses, dentist approvals, and editing of
   ALL catalogs/content (services, prices, guide types, implant systems, kits, portfolio, site settings).

## Stack

Next.js 16 (App Router, Turbopack, `cacheComponents`, `src/`) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 + shadcn/ui (radix-nova, `cn` package) · lucide-react · gsap + @gsap/react · lenis ·
motion · three + @react-three/fiber + drei · next-intl 4 · Prisma 7 (`prisma-client` generator,
`@prisma/adapter-pg`) on PostgreSQL (Neon, EU) · Better Auth (email+password, Prisma adapter) ·
zod 4 + react-hook-form · Cloudflare R2 (EU jurisdiction) via @aws-sdk/client-s3 + presigner ·
Uppy (core/dashboard/aws-s3 multipart) · Resend + react-email · @tanstack/react-table ·
@t3-oss/env-nextjs · ESLint + Prettier (tailwind plugin) · pnpm.

**Do not add dependencies outside this list without asking the user first.**

## Layout

```
src/app/[locale]/            root layout #1 (html lang from `next/root-params`)
  (marketing)/ (auth)/ (portal)/portal/
src/app/admin/               root layout #2 (English, no locale segment)
src/app/api/                 auth/[...all] (Better Auth), uploads/* (presign + multipart)
src/proxy.ts                 Next 16 "proxy" (formerly middleware): auth gate + next-intl routing
src/components/              ui/ (shadcn, generated) marketing/ portal/ admin/ three/ shared/
src/lib/                     db, auth, auth-options, auth-client, storage (R2), email, fonts, utils
src/server/actions/          "use server" mutations
src/server/queries/          reads; session.ts = auth Data Access Layer (requireAdmin, requireApprovedDentist)
src/server/services/         business logic (case-number, upload-guard, …)
src/i18n/                    routing.ts, request.ts, navigation.ts
src/emails/                  react-email templates
src/env.ts                   typed env (t3). Import `env` from "@/env", never read process.env directly
src/generated/prisma/        generated Prisma client (gitignored; `pnpm db:generate`)
messages/{da,en}.json        all UI strings. en.json is the type source and holds the admin namespace
prisma/schema.prisma, seed.ts
```

## Rules

- **No hardcoded catalog data.** Services, prices, guide types, implant systems, kits, portfolio
  and site texts come from the DB and are editable in /admin. Translatable DB text is JSON
  `{ "da": "...", "en": "..." }`; read it with `localized(value, locale)` from `@/lib/utils`.
- **GDPR:** cases store a **patient code only, never a patient name**. No patient data in emails or logs.
  Case files live in the private EU R2 bucket and are reached **only via short-lived signed URLs**
  issued after an authorization check.
- **Uploads go directly from the browser to R2** (presigned PUT / S3 multipart via Uppy). File
  bytes never pass through Next.js. API routes only sign URLs and record `CaseFile` rows.
- **Mutations = Server Actions + zod.** Validate input, re-check the session/role server-side
  (`src/server/queries/session.ts`), then call `src/server/services/*`. Never trust client-sent
  role, dentistId or status.
- **Every user-facing string goes in `messages/*.json`** (da + en; admin strings only in en.json
  under `admin`). Use `Link`/`redirect`/`useRouter` from `@/i18n/navigation` inside `[locale]`.
- **Auth layering:** proxy = optimistic check (cookie cache). Layouts/pages/actions/routes must still
  call the session DAL (DB-backed). `role` and `dentistStatus` are `input: false`, so users can't set them.
- **Cache Components:** anything reading cookies/headers/session/searchParams must sit inside
  `<Suspense>`. Don't `await` session or params at a layout's top level.
- **Locale outside `[locale]`:** in Server Actions, Route Handlers and /admin, pass the locale
  explicitly (`getTranslations({ locale, namespace })`), because `next/root-params` isn't available there.
- Catalog rows referenced by cases are deactivated (`active = false`), not deleted.
- Case numbers come from `allocateCaseNumber(tx)` inside the create transaction (`DN-YYYY-NNNN`).
- `CaseFile.sizeBytes` is BigInt: convert it before passing to client components.
- Design tokens live in `src/app/globals.css` (`:root` raw values → `@theme`). Fonts are set only in
  `src/lib/fonts.ts` (`font-display`, `font-sans`, `font-mono`). Type scale: `text-display-{sm…2xl}`,
  `text-lead`, `text-eyebrow`.
- Three.js scenes are client-only (`next/dynamic` with `ssr: false`).
- Windows/PowerShell dev machine: keep scripts cross-platform.

## Commands

```
pnpm dev | build | start
pnpm lint | typecheck | format | format:check
pnpm db:generate | db:migrate | db:push | db:seed | db:studio
pnpm auth:generate     # after adding Better Auth plugins: merges auth tables into schema.prisma
```

Before finishing work: `pnpm typecheck && pnpm lint && pnpm build`.
