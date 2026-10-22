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
react-markdown (no raw HTML) · @t3-oss/env-nextjs · ESLint + Prettier (tailwind plugin) · pnpm ·
@playwright/test (dev).

**Do not add dependencies outside this list without asking the user first.**

## Layout

```
src/app/[locale]/            root layout #1 (html lang from `next/root-params`)
  (marketing)/ (auth)/ (portal)/portal/
src/app/admin/               root layout #2 (English, no locale segment)
src/app/api/                 auth/[...all] (Better Auth), uploads/* (case-file multipart + downloads)
src/proxy.ts                 Next 16 "proxy" (formerly middleware): auth gate + next-intl routing
src/components/              ui/ (shadcn, generated) marketing/ portal/ admin/ three/ shared/
src/lib/                     db, auth*, r2 + storage (cases) + media-storage, email, price, validation/, utils
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
  (Without a root param, `i18n/request.ts` falls back to English, so shared server components that call
  `useTranslations` render in English under /admin.)
- Catalog rows referenced by cases are deactivated (`active = false`), not deleted.
- Case numbers come from `allocateCaseNumber(tx)` inside the create transaction (`DN-YYYY-NNNN`).
- `CaseFile.sizeBytes` is BigInt: convert it before passing to client components.
- **No invented facts** in copy. Stats, prices, names, reviews, photos come from the admin; anything
  not filled in is **hidden** on the public site, never shown as `[X]`. Render
  `<Missing field="…" />` in its place: an admin-only marker (see "Content management" below).
  Images go through `SiteImage` (next/image, or a decorative gradient while none is uploaded).
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
- **Marketing data** comes from cached queries (`server/queries/catalog.ts`, `content.ts`, `media.ts`,
  `site-settings.ts`, with `"use cache"` + `cacheTag(TAGS.…)` from `server/cache-tags.ts`). Admin Server
  Actions call `updateTag()` with the matching tag after every write (read-your-own-writes), so the
  public site updates on the next request without a deploy.

## Database (Neon)

- Project `dentnord-eu` (`small-river-39570877`), region **aws-eu-central-1 (Frankfurt)**, Postgres 18,
  default branch `production`. Linked via `.neon` (gitignored); policy in `neon.ts`.
  Don't use the older London project `aged-flower-65703337`: it is outside the EU.
- **Two branches, two environments:**
  - **local = `dev`** (`.env`, `.neon` checked out to `dev`). Dev work, seeds and E2E tests write here.
  - **production = `production`** (Vercel's env vars only). Nothing local points at it.
  - Check before touching data: `NEON_BRANCH` in `.env` must say `dev`. The E2E helpers refuse `production`.
- **Reset `dev`** to a fresh copy of production (drops all dev data, including test users):
  `neon branches reset dev --parent --project-id small-river-39570877`, then `pnpm db:seed`
  (and `pnpm exec prisma migrate deploy` if `dev` has migrations production doesn't yet). The endpoint
  stays the same, so `.env` keeps working. `dev` was created with `neon branches create` (no TTL); don't
  recreate it with `neon checkout dev --create`, which applies `neon.ts`'s 7-day expiry.
- **Migrations:** create them locally with `pnpm db:migrate` (`prisma migrate dev`, against `dev` only).
  Apply them to production with **`prisma migrate deploy`, never `migrate dev`** (which can reset data and
  generate new migrations), using production's unpooled URL, before pushing code that needs them:
  `DIRECT_URL="<production unpooled URL>" pnpm exec prisma migrate deploy`
  (`neon connection-string production --project-id small-river-39570877` prints it; don't paste it into
  files or logs).
- `DATABASE_URL` = **pooled** (`-pooler`), used by the app through `@prisma/adapter-pg` (node-postgres,
  Node runtime everywhere). `DIRECT_URL` = **unpooled**, used only by the Prisma CLI via
  `prisma.config.ts` (Prisma 7 has no `directUrl` in schema.prisma). Never run migrations over the pooler.
- `neon deploy` / `neon env pull` rewrite `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` in
  `.env`. If credentials change, copy `DATABASE_URL_UNPOOLED` into `DIRECT_URL`.
- Connection strings go through `withVerifiedSsl()` (`src/lib/pg-url.ts`) to pin `sslmode=verify-full`.
- Schema changes: `pnpm db:migrate` (creates + applies a migration on `dev`). Test risky migrations on
  a throwaway branch first (`neon checkout <name> --create`, auto-expires after 7 days).

## Auth & accounts

- Better Auth, email + password. Sign-in / sign-up / password reset / change password run through the
  `/api/auth` endpoints (browser `authClient`), because Better Auth's **rate limiting only applies to HTTP
  requests**, not to `auth.api.*` calls from Server Actions. Rate-limit state lives in the `rate_limit`
  table (works across serverless instances); enabled in production builds only.
- Sign-up is validated server-side by `hooks.before` in `src/lib/auth.ts` with the same zod schema the form
  uses (`src/lib/validation/auth.ts`); `databaseHooks` force `DENTIST` + `PENDING`, stamp
  `termsAcceptedAt`, and refuse to create sessions for `REJECTED` dentists. `/update-user`,
  `/change-email` and `/delete-user` are disabled; profile edits go through `server/actions/account.ts`.
- Access: proxy (cookie cache, re-checks the DB before denying) → layout gate → every page/action via
  `server/queries/session.ts` (`requireAdmin`, `requireApprovedDentist`). Dentist data goes through
  `server/queries/dentist.ts` (`getDentistScope`, `ownCaseWhere`, `getOwnCase`): the dentist id always
  comes from the session.
- Admin decisions (`server/services/dentist-review.ts`): approve / reject (= disable when approved) /
  re-activate, in one transaction with an `AuditLog` row; rejecting deletes all the dentist's sessions.
- The admin user is created **only** by the seed (`ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`). No admin sign-up.
  The admin changes their password at `/admin/account` (account menu); the dentist form is shared
  (`components/auth/change-password-form.tsx`).
- The seed refuses (`prisma/seed-guard.ts`) to run on `production` unless `SEED_ADMIN_PASSWORD` is set
  and differs from the `.env` value, and refuses a `DATABASE_URL` that differs from `.env`'s unless
  `NEON_BRANCH` differs too. It compares with the `.env` **file**, because `pnpm db:seed` runs through
  Prisma's CLI, which has already loaded `.env` into the environment. Test guards through
  `pnpm db:seed`, not `tsx prisma/seed.ts`. Production seed:
  `DATABASE_URL=<prod pooled> NEON_BRANCH=production SEED_ADMIN_PASSWORD=<chosen> pnpm db:seed`.
- Local `.env` keeps `BETTER_AUTH_URL` / `NEXT_PUBLIC_SITE_URL` = `http://localhost:3000` (the trusted
  origin); production values live in Vercel only. `pnpm test:e2e` pins them to localhost regardless.
- Emails (`src/lib/email.ts`, templates in `src/emails/`, strings in `messages/*.json` → `emails`):
  sent via Resend when `RESEND_API_KEY` is a real key, otherwise logged to the console (links redacted in
  production builds). Always queued with `sendInBackground` (Next `after()`); a failed email never fails
  the action.

## Content management (admin)

- Pages: `/admin/services` (+ `[id]`, `new`), `/admin/catalog` (guide types, implant systems, kits),
  `/admin/portfolio` (+ `[id]`, `new`), `/admin/settings` (numbers, contact, doctor, testimonials,
  photos, accounts, legal), and the dashboard's **Content checklist** (`server/queries/content-checklist.ts`).
- Every admin mutation goes through `runAdminAction(schema, input, handler)`
  (`server/services/admin-action.ts`): `requireAdmin()` FIRST (so a direct POST of the action id by a
  non-admin never reaches validation or the DB), then the same zod schema as the form
  (`lib/validation/admin.ts`), then the handler, which writes an `AuditLog` row in the same transaction
  (`recordAudit`, before/after summary) and calls `updateTag`. List operations (reorder, publish/active,
  delete-or-archive) are shared in `server/services/content-admin.ts`.
- Admin forms: react-hook-form + `zodResolver(schema, undefined, { raw: true })` (the action re-parses
  the raw input), building blocks in `components/admin/form-kit.tsx` (bilingual fields with a
  missing-translation marker, kroner price input, mm chip input, save bar, unsaved-changes warning),
  `sortable-list.tsx` (motion Reorder, keyboard ↑/↓), `image-picker.tsx`. Don't pass functions from
  server pages to these client components; constants shared with server pages live in plain modules
  (e.g. `components/admin/tabs.ts`), since a `"use client"` module's exports are only references there.
- Prices: the admin types kroner ("1 250,00"); `lib/price.ts` parses/formats; the DB stores øre.
- Site settings are `SiteSetting` JSON rows (`stats`, `contact`, `doctor`, `accounts`, `legal`,
  `images`), normalised by the getters in `server/queries/site-settings.ts`.
- "Missing content" registry: `lib/content-fields.ts` (field → admin link; labels in
  `admin.content.fields`). Public pages render `<Missing field>` (server) / `<MissingMarker>` (client);
  it shows only when the `dn_admin` hint cookie is set (`lib/admin-hint.ts`, set by the proxy after a
  DB-checked admin visit to /admin, cleared on logout). It's not a security boundary: it only reveals
  which public fields are empty, and the static pages stay identical for everyone.
- Seeded catalog rows contain "EXAMPLE"/"EKSEMPEL" (`looksLikeExample`): flagged in the admin and
  counted by the checklist until edited.
- Testimonials: publishing needs consent (form, action and a DB `CHECK` constraint).
- **Media** (public images): R2 bucket `R2_MEDIA_BUCKET` (public read) served from
  `R2_MEDIA_PUBLIC_URL` (also allowed for next/image in `next.config.ts`, read at build time). Admin asks
  `createMediaUpload` for a presigned PUT (type + length signed; jpg/png/webp/avif ≤ 10 MB) → browser
  PUTs directly → `finalizeMediaUpload` HEADs the object, re-checks type/size against an HMAC upload
  token, and records a `MediaAsset` (alt text in da + en required). Without real R2 credentials or a
  public URL (`lib/r2.ts`, `lib/media-storage.ts`), the picker shows "Image uploads not configured".
  Case files stay in the private `R2_CASES_BUCKET` (`lib/storage.ts`).

## Cases & uploads

- Wizard: `components/cases/wizard/*` (`case-wizard.tsx` orchestrates; autosave through a save queue;
  the DRAFT is created on the first save, URL `/portal/cases/<id>/edit?step=N`). Server side:
  `server/actions/cases.ts` → `server/services/cases.ts` (own DRAFT only; `submitCase` re-validates
  everything and allocates the case number). Admin views are read-only (`server/queries/admin-cases.ts`).
- **Every case file is a multipart upload** (`use-case-uploads.ts`, one Uppy instance per wizard so step
  changes never abort uploads). `POST /api/uploads/multipart` registers it: the server checks kind /
  extension / size (`lib/case-files.ts`), builds the key, creates the multipart upload in R2 and the
  `CaseFile` row (UPLOADING), and returns **our file id** (R2's upload id never leaves the server). Uppy
  gets `s3Multipart = { uploadId: <file id>, key }`; its `signRequest` maps part PUTs to
  `GET …/[id]/[part]` (15-min URL with the part's exact `Content-Length` signed in, fixed 16 MiB parts, so
  R2 enforces the declared size) and list / complete / abort to our routes, which talk to R2 themselves.
  Complete = list parts server-side, complete, HEAD, size check → COMPLETE + `CaseEvent`, else delete
  the object and mark it FAILED. So the bucket's CORS only needs `PUT` + exposed `ETag`. Those three
  routes answer like S3, errors included (`<Error><Code>…`): Vercel strips `x-amz-*` response
  headers, so the error code must be in the body.
- Route order: `requireUploadUser` (DB session, APPROVED dentist for writes; admin may only download)
  → per-user rate limit (`server/services/rate-limit.ts`, `rate_limit` table) → zod → service
  (`server/services/case-uploads.ts`, ownership + DRAFT + row state). Downloads:
  `/api/uploads/files/[id]/download` → 303 to a 5-minute signed GET (owner, or admin for non-drafts).
- `R2_KEY_PREFIX` (default empty) prefixes every case key; E2E runs use `test/` and the teardown deletes
  everything under it (`tests/e2e/support/db-cli.ts`). E2E contexts add `x-forwarded-for` only to
  localhost requests: on R2 requests it would fail CORS.

## Commands

```
pnpm dev | build | start
pnpm lint | typecheck | format | format:check
pnpm db:generate | db:migrate | db:push | db:seed | db:studio
pnpm auth:generate     # after adding Better Auth plugins: merges auth tables into schema.prisma
pnpm check:css [--url <page>…]   # shipped CSS matches source (fonts, theme vars, every class); runs in `pnpm build`
pnpm test:unit         # node:test + tsx: zod schemas, redirect helpers (tests/unit)
pnpm test:e2e          # Playwright vs a local production build on port 3000, DB = `dev` (tests/e2e)
E2E_SKIP_BUILD=1 pnpm test:e2e   # reuse the existing .next build
```

E2E tests create users with an `e2e-` email prefix and delete them (plus their audit rows) after each run.
Each test context gets its own `x-forwarded-for`, so the rate limiter doesn't merge them (on Vercel the
edge sets that header, so clients can't spoof it).

`pnpm build` runs `prisma generate` itself: on Vercel a restored install cache skips `postinstall`, and the
client in `src/generated/` is gitignored. It needs no database URL. `pnpm build` also fails if the emitted CSS is stale or incomplete (`scripts/check-build-css.mjs`). Keep it in the
build script: Vercel runs `pnpm build`, so a bad build never replaces the live deployment. Turbopack's build
cache is off in `next.config.ts` for the same reason. After a deploy, run
`pnpm check:css --url https://dentnord.vercel.app/en https://dentnord.vercel.app/da` against production.

Before finishing work: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:unit && pnpm build`
(and `pnpm test:e2e` when touching auth, the portal or the admin).
