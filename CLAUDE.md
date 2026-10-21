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
`@prisma/adapter-pg`) on PostgreSQL (Neon, Frankfurt) · Better Auth (email+password, Prisma adapter) ·
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
- **No invented facts** in copy: stats, prices, names, reviews use `[placeholder]`s, listed in
  `docs/content-todo.md`. Photos use `PlaceholderImage` (same props as `next/image`).
- Windows/PowerShell dev machine: keep scripts cross-platform.

## Design system

- **Tokens** (`src/app/globals.css` `@theme`): `canvas`, `surface`, `surface-2`, `ink`, `ink-muted`,
  `line`, `brand`, `brand-deep`, `brand-soft`, `brand-ice`. Use these in marketing UI. shadcn's
  semantic slots (`background`, `primary`, …) derive from them; shadcn `accent` is a **neutral grey**,
  not the brand. Radii: `rounded-card` (16px UI), `rounded-media` / `rounded-media-lg` (28/32px images),
  `rounded-full` pills. Type: `text-display-{sm…2xl}`, `text-lead`, `text-label`; `font-mono` for
  index labels. Width: `max-w-page` (1440) via `<Container>`. Fonts: Geist + Geist Mono (`src/lib/fonts.ts`).
- **`cn` from `@/lib/utils` only** (configured with our custom font sizes). shadcn's CLI writes
  `import { cn } from "cn"` into new components: change it to `@/lib/utils`.
- **Components:** `components/shared/` (Button/ButtonLink/ArrowCircle pills, Container, SectionLabel/
  SectionHeading, Chip, StatusBadge, PlaceholderImage, LocaleSwitcher) and `components/marketing/`
  (SiteHeader, SiteFooter, Logo, `home/*` sections). Portal/admin use shadcn `components/ui/*`.
- **Motion** (`components/motion/`, `motion/react`): Reveal/RevealItem, SplitText, FadeIn (CSS, for
  above the fold), ScrollWords, Parallax, Counter, MagneticButton, SmoothScroll (Lenis, in the
  marketing layout only). Springs, 0.4–0.8s, subtle. Every animated element gets `data-motion`, so
  `prefers-reduced-motion` and no-JS show the final state (globals.css + `<noscript>`).
- **Header over the home hero** is pure CSS (`data-over-hero` + the `over-hero:` variant). Don't use
  `usePathname` in layout-level client components: it suspends on routes with unknown params.
- **3D** (`components/three/`): always through `<GuideViewerLazy>` (dynamic, client-only, mounts in view,
  pauses off-screen, poster fallback). Real model: `public/models/guide.glb` (see README there);
  Draco decoders are self-hosted in `public/draco/`.
- **Marketing data** comes from cached queries (`server/queries/catalog.ts`, `site-settings.ts`, with
  `"use cache"` + `cacheTag`). Admin mutations must `revalidateTag()` the matching tag.

## Database (Neon)

- Project `dentnord-eu` (`small-river-39570877`), region **aws-eu-central-1 (Frankfurt)**, Postgres 18,
  default branch `production`. Linked via `.neon` (gitignored); policy in `neon.ts`.
  Don't use the older London project `aged-flower-65703337`: it is outside the EU.
- `DATABASE_URL` = **pooled** (`-pooler`), used by the app through `@prisma/adapter-pg` (node-postgres,
  Node runtime everywhere). `DIRECT_URL` = **unpooled**, used only by the Prisma CLI via
  `prisma.config.ts` (Prisma 7 has no `directUrl` in schema.prisma). Never run migrations over the pooler.
- `neon deploy` / `neon env pull` rewrite `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` in
  `.env`. If credentials change, copy `DATABASE_URL_UNPOOLED` into `DIRECT_URL`.
- Connection strings go through `withVerifiedSsl()` (`src/lib/pg-url.ts`) to pin `sslmode=verify-full`.
- Schema changes: `pnpm db:migrate` (creates + applies a migration). Test risky migrations on a Neon
  branch first (`neon checkout <name> --create`).

## Commands

```
pnpm dev | build | start
pnpm lint | typecheck | format | format:check
pnpm db:generate | db:migrate | db:push | db:seed | db:studio
pnpm auth:generate     # after adding Better Auth plugins: merges auth tables into schema.prisma
pnpm check:css [--url <page>…]   # shipped CSS matches source (fonts, theme vars, every class); runs in `pnpm build`
```

`pnpm build` runs `prisma generate` itself: on Vercel a restored install cache skips `postinstall`, and the
client in `src/generated/` is gitignored. It needs no database URL. `pnpm build` also fails if the emitted CSS is stale or incomplete (`scripts/check-build-css.mjs`). Keep it in the
build script: Vercel runs `pnpm build`, so a bad build never replaces the live deployment. Turbopack's build
cache is off in `next.config.ts` for the same reason. After a deploy, run
`pnpm check:css --url https://dentnord.vercel.app/en https://dentnord.vercel.app/da` against production.

Before finishing work: `pnpm typecheck && pnpm lint && pnpm build`.
