# Dentnord

Website, dentist portal and admin dashboard for **Dentnord**: Dr. Hossam's practice in Denmark, which
designs and manufactures **surgical guides for dental implants**. The users are **dentists, not
patients**. The site is bilingual (Danish and English).

The app has three parts:

| Part                | Routes                    | What it does                                                                                                                                                                                                    |
| ------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marketing site**  | `/[locale]/…` (`da`/`en`) | Home, Services, Portfolio, About, Contact, plus an interactive 3D surgical-guide model. All content comes from the database.                                                                                    |
| **Dentist portal**  | `/[locale]/portal/…`      | Sign-up (the admin must approve it), case submission (CBCT/DICOM, intraoral scans, FDI implant sites, implant system, guide type, kit), status tracking, plan approval or change requests, messages to the lab. |
| **Admin dashboard** | `/admin/…` (English only) | Cases and status changes, dentist approvals, and editing of every catalog and page text (services, prices, guide types, implant systems, kits, portfolio, site settings).                                       |

> **Read [CLAUDE.md](CLAUDE.md) before changing code.** It is the detailed, authoritative guide to the
> architecture, conventions and rules (GDPR, uploads, auth, caching, case workflow). [AGENTS.md](AGENTS.md)
> warns that Next.js 16 differs from older versions: check `node_modules/next/dist/docs/` before relying
> on older Next.js knowledge. This README is the entry point and doesn't repeat them.

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack, Cache Components), React 19, TypeScript (strict)
- **UI:** Tailwind CSS v4, shadcn/ui, lucide-react, motion, gsap, Lenis, three + React Three Fiber + drei
- **i18n:** next-intl 4 (`messages/da.json`, `messages/en.json`)
- **Data:** PostgreSQL on Neon (Frankfurt, EU), Prisma 7 with `@prisma/adapter-pg`
- **Auth:** Better Auth (email + password, admin approval, two-factor authentication, mandatory for the admin)
- **Validation and forms:** zod 4, react-hook-form
- **Files:** Cloudflare R2 (EU jurisdiction) through the AWS S3 SDK. Browsers upload directly to R2
  (presigned PUTs, Uppy multipart); file bytes never pass through the app.
- **Email:** Resend + react-email
- **Env:** `@t3-oss/env-nextjs` (`src/env.ts`)
- **Tooling:** pnpm, ESLint, Prettier (with the Tailwind plugin), Playwright, `node:test` + tsx
- **Hosting:** Vercel (with a daily Vercel Cron job)

CLAUDE.md lists the allowed dependencies. Ask the project owner before adding anything outside that list.

## Prerequisites

- **Node.js 20.9 or newer** (Next.js 16's minimum; developed on Node 22)
- **pnpm 12** (the version is pinned in `package.json` → `packageManager`; `corepack enable` picks it up)
- Access to the project's **Neon** database (the `dev` branch) from the project owner
- Optional for local work, required for the full E2E suite: **Cloudflare R2** credentials and buckets
  (without them, uploads show "not configured" and nothing crashes)
- Optional: a **Resend** API key (without one, emails are printed to the server console)

Development happens on Windows as well as macOS and Linux, so keep scripts cross-platform.

## First-time setup

1. **Clone and install**

   ```bash
   git clone <repository URL> dentnord
   cd dentnord
   pnpm install          # postinstall runs `prisma generate` (client in src/generated/prisma, gitignored)
   ```

2. **Create `.env`** from the template. `.env` is gitignored: never commit it.

   ```bash
   cp .env.example .env
   ```

   `.env.example` explains every variable. The minimum to run locally:

   | Variable                    | Value                                                                                                |
   | --------------------------- | ---------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`              | the Neon **`dev`** branch's **pooled** connection string (host contains `-pooler`)                   |
   | `DIRECT_URL`                | the same branch's **unpooled** connection string (used only by the Prisma CLI for migrations)        |
   | `NEON_BRANCH`               | `dev`                                                                                                |
   | `BETTER_AUTH_SECRET`        | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `BETTER_AUTH_URL`           | `http://localhost:3000`                                                                              |
   | `NEXT_PUBLIC_SITE_URL`      | `http://localhost:3000`                                                                              |
   | `ADMIN_EMAIL`, `EMAIL_FROM` | keep the template values or use your own                                                             |
   | `SEED_ADMIN_PASSWORD`       | the password for the local admin account (12+ characters), used by the seed                          |

   Get the connection strings from the Neon console (project `dentnord-eu`, branch `dev` → Connect), or
   with the Neon CLI (`neon env pull` writes `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH`;
   copy `DATABASE_URL_UNPOOLED` into `DIRECT_URL`). See [CLAUDE.md → Database](CLAUDE.md) for details.
   **Never point a local `.env` at the `production` branch.**

3. **Database schema.** Apply the committed migrations to `dev`:

   ```bash
   pnpm exec prisma migrate deploy
   ```

   Use `pnpm db:migrate` only when you change `prisma/schema.prisma` (it creates a new migration).

4. **Seed** example catalog data, the site settings, the page texts and the admin user. The seed only
   creates rows that are missing, so you can run it again safely:

   ```bash
   pnpm db:seed
   ```

   Seeded catalog rows are marked "EXAMPLE"/"EKSEMPEL" until someone edits them in the admin.

5. **Run**

   ```bash
   pnpm dev              # http://localhost:3000/da (Danish) or /en
   ```

   Log in at `/en/login` with `ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. The admin must set up
   two-factor authentication (an authenticator app) before `/admin` opens.

## Scripts

| Command                        | What it does                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                     | Development server (Turbopack) on port 3000                                                                                       |
| `pnpm build`                   | `prisma generate` + `next build` + the CSS check (`scripts/check-build-css.mjs`). Fails if the shipped CSS is stale or incomplete |
| `pnpm start`                   | Serves the production build                                                                                                       |
| `pnpm lint`                    | ESLint                                                                                                                            |
| `pnpm typecheck`               | `next typegen` + `tsc --noEmit`                                                                                                   |
| `pnpm format` / `format:check` | Prettier: write / check                                                                                                           |
| `pnpm test:unit` (`pnpm test`) | Unit tests (`tests/unit`, `node:test` + tsx): schemas, redirects, CSP, workflow rules, storage limits, seed guard…                |
| `pnpm test:e2e`                | Playwright end-to-end tests against a local production build (see [Tests](#tests))                                                |
| `pnpm check:css [--url …]`     | Checks the built CSS (fonts, theme variables, every class used). With `--url`, checks a deployed site instead                     |
| `pnpm db:generate`             | Regenerates the Prisma client                                                                                                     |
| `pnpm db:migrate`              | `prisma migrate dev`: creates and applies a migration. **Local `dev` branch only, never production**                              |
| `pnpm db:push`                 | `prisma db push` (schema without a migration; for throwaway branches only)                                                        |
| `pnpm db:seed`                 | Seeds example data and the admin user (refuses to run against production unless explicitly allowed, see `prisma/seed-guard.ts`)   |
| `pnpm db:seed:pages`           | Creates only the missing page texts (useful on production, see the script's header)                                               |
| `pnpm db:studio`               | Prisma Studio (database browser)                                                                                                  |
| `pnpm auth:generate`           | After adding a Better Auth plugin: merges its tables into `prisma/schema.prisma`                                                  |

## Architecture at a glance

```
src/app/[locale]/        marketing site, auth pages and dentist portal (root layout #1, da/en)
src/app/admin/           admin dashboard (root layout #2, English only)
src/app/api/             Better Auth, case-file upload/download routes, storage-cleanup cron
src/proxy.ts             Next 16 "proxy" (formerly middleware): optimistic auth gate + locale routing
src/components/          ui/ (shadcn), marketing/, portal/, admin/, auth/, cases/, three/ (3D), shared/, motion/
src/server/actions/      Server Actions (all mutations, validated with zod)
src/server/queries/      reads; session.ts is the auth data-access layer
src/server/services/     business logic (case workflow, uploads, dentist review, erasure, …)
src/lib/                 db, auth, R2/storage, email, validation schemas, utilities
src/emails/              react-email templates
src/env.ts               typed environment (import `env` from "@/env", never read process.env directly)
messages/{da,en}.json    UI strings (admin strings only in en.json)
prisma/                  schema, migrations, seed
tests/unit, tests/e2e    unit and Playwright tests
docs/go-live.md          checklist for the move to the dentnord.dk domain (Vercel, DNS, R2, Resend)
```

The ground rules, in brief (details in [CLAUDE.md](CLAUDE.md)):

- **No hard-coded content.** Services, prices, catalogs, portfolio and page texts live in the database
  and are edited in `/admin`. Anything not filled in is hidden on the public site, never shown as a
  placeholder.
- **GDPR.** Cases store a patient code, never a patient name. Case files sit in a private EU bucket and
  are reached only through short-lived signed URLs after an authorization check.
- **Security in layers.** The proxy does a quick cookie check, and every layout, page, action and route
  checks the session against the database again. Role, dentist id and status never come from the client.
- **Case status changes** go only through `server/services/case-workflow.ts`, using the rules in
  `lib/case-workflow-rules.ts`.

## Databases: dev vs production

The Neon project (`dentnord-eu`, Frankfurt) has two branches:

| Branch       | Used by                                            | Notes                                                                                   |
| ------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `dev`        | local development, seeds, E2E tests                | `NEON_BRANCH=dev` in `.env`. Can be reset to a fresh copy of production (see CLAUDE.md) |
| `production` | the live site only, through Vercel's env variables | nothing local points at it                                                              |

- Check `NEON_BRANCH` in `.env` before touching data. The E2E helpers refuse `production`, and the seed
  runs there only with deliberate extra settings (`prisma/seed-guard.ts`).
- Create migrations locally with `pnpm db:migrate` (on `dev`). Apply them to production with
  **`prisma migrate deploy`** and production's unpooled URL, **before** deploying code that needs them.
  Never run `migrate dev` against production. Exact commands: CLAUDE.md → Database.
- `DATABASE_URL` (pooled) is for the app, `DIRECT_URL` (unpooled) for the Prisma CLI. Never run
  migrations over the pooler.

## Tests

```bash
pnpm test:unit                    # fast, no database or network
pnpm exec playwright install chromium   # once, before the first E2E run
pnpm test:e2e                     # builds, starts on :3000, runs every spec
E2E_SKIP_BUILD=1 pnpm test:e2e    # reuses the existing .next build made by a previous E2E run
```

The E2E suite runs against a local **production build** and the database in `.env`, which must be the
`dev` branch. It creates users with an `e2e-` email prefix and deletes them afterwards. The upload and
lifecycle specs use the real R2 buckets (under the `test/` key prefix, deleted at the end), so they need
R2 credentials and a bucket CORS rule allowing `http://localhost:3000`. Every spec fails on any
Content-Security-Policy violation.

Before finishing a change, run:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:unit && pnpm build
```

Add `pnpm test:e2e` when you touch auth, the portal or the admin.

## Deployment (Vercel)

- Vercel runs `pnpm build` for every deployment: pushes to the production branch go to **Production**,
  while other branches and pull requests (including Dependabot's) go to **Preview**.
- **The build is the gate.** `pnpm build` generates the Prisma client (it needs no database), validates
  the environment (`src/env.ts`), compiles, and checks the emitted CSS. If any step fails, the
  deployment fails and the live site stays on the previous one. Keep these steps in the build script.
  Turbopack's build cache is off in `next.config.ts` for the same reason.
- **Environment variables** live in Vercel only (Settings → Environment Variables), separately for
  Production and Preview. Variables read at build time (`NEXT_PUBLIC_SITE_URL`, `R2_MEDIA_PUBLIC_URL`,
  `CSP_REPORT_ONLY`) need a redeploy after a change.
- **Preview deployments need their own values.** A Preview environment missing a required variable fails
  with `Invalid environment variables: …` (e.g. `NEXT_PUBLIC_SITE_URL` on Dependabot pull requests).
  Set `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL`, `DATABASE_URL` (the **`dev`** branch, never
  production), `BETTER_AUTH_SECRET`, `EMAIL_FROM` and `ADMIN_EMAIL` for Preview. The validation is
  deliberately not relaxed. The table and the reasons are in
  [docs/go-live.md → Preview environment](docs/go-live.md#preview-environment-dependabot-and-branch-deployments).
- **Database migrations are not run by the build.** Apply them to production with `prisma migrate deploy`
  before pushing code that needs them (see [Databases](#databases-dev-vs-production)).
- **Cron:** `vercel.json` calls `/api/cron/storage-cleanup` daily (Production only). It needs
  `CRON_SECRET`; without it the job does nothing.
- **After a deploy**, check the shipped CSS against production:
  `pnpm check:css --url https://<production-host>/en https://<production-host>/da`.
- **Moving to the real domain** (dentnord.dk: DNS, env values, R2 CORS, Resend domain verification,
  email verification): follow [docs/go-live.md](docs/go-live.md) top to bottom.
