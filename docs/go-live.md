# Go-live: moving to https://dentnord.dk

Everything that changes when the site moves from `https://dentnord.vercel.app` to
`https://dentnord.dk`. Work through it top to bottom. Items marked **rebuild** take effect only after a
new deployment, because they are read at build time.

## 1. Domain (Vercel + DNS)

- [ ] Vercel → Project → Settings → Domains: add `dentnord.dk` and `www.dentnord.dk`.
- [ ] Make `dentnord.dk` the primary domain and redirect `www.dentnord.dk` → `dentnord.dk` (308).
- [ ] Set the DNS records Vercel shows (A for the apex, CNAME for `www`) at the DNS host. Wait until
      both show "Valid configuration" and the certificate is issued.
- [ ] Keep `dentnord.vercel.app` working for previews. Optionally redirect it to `dentnord.dk` too.

## 2. Vercel environment variables (Production)

| Variable               | New value                                             | Notes                                                                                                 |
| ---------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_URL`      | `https://dentnord.dk`                                 | Auth endpoints, links in auth emails, secure cookies.                                                 |
| `NEXT_PUBLIC_SITE_URL` | `https://dentnord.dk`                                 | **rebuild**: inlined into the browser bundle; also the sitemap, robots.txt, OG URLs and CSP upgrades. |
| `R2_MEDIA_PUBLIC_URL`  | e.g. `https://media.dentnord.dk` (see 4)              | **rebuild**: allowed for next/image and in the CSP `img-src`.                                         |
| `EMAIL_FROM`           | `Dentnord <noreply@dentnord.dk>`                      | Only after the domain is verified in Resend (see 5).                                                  |
| `CRON_SECRET`          | 32+ random characters                                 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. See 6.                    |
| `EMAIL_VERIFICATION`   | `on`                                                  | Only after Resend sends from the domain (see 5).                                                      |
| `CSP_REPORT_ONLY`      | unset (enforced). `1` only for a trial deploy (see 7) | **rebuild**                                                                                           |

Vercel applies changed variables only to new deployments: redeploy after editing them.

### Trusted origins (www included)

Better Auth accepts requests from `NEXT_PUBLIC_SITE_URL` **and its www / apex twin**
(`src/lib/site-url.ts`): with `https://dentnord.dk` both `https://dentnord.dk` and
`https://www.dentnord.dk` are trusted. Nothing to configure. Check after the switch that logging in
works on both hosts (the `www` one redirects first).

## 3. R2 CORS (both buckets)

Cloudflare → R2 → bucket → Settings → CORS policy. Replace the origins and keep the rest of the current
rule (the JSON below is what the app needs at minimum: `PUT` for uploads, `GET` for the 3D viewer, the
`ETag` header exposed for multipart uploads). Remove
`http://localhost:3000` from the production buckets if it is there (local development has its own
`dev/` prefix, but the same buckets: keep localhost only if you still develop against them).

**`dentnord-cases`** (private; multipart part uploads + the 3D viewer's signed GETs):

```json
[
  {
    "AllowedOrigins": ["https://dentnord.dk", "https://www.dentnord.dk"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**`dentnord-media`** (public; the admin's image upload is a presigned PUT):

```json
[
  {
    "AllowedOrigins": ["https://dentnord.dk", "https://www.dentnord.dk"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

- [ ] Test: upload a case file in the portal, open a plan in the 3D viewer, upload an image in the admin.

## 4. Public media URL (optional custom domain)

The media bucket is served from its `r2.dev` URL today. For a stable, branded URL:

- [ ] Cloudflare → R2 → `dentnord-media` → Settings → Custom Domains: connect `media.dentnord.dk`
      (the DNS zone must be on Cloudflare for this).
- [ ] Set `R2_MEDIA_PUBLIC_URL=https://media.dentnord.dk` in Vercel and **rebuild**.
- [ ] Rewrite the stored image URLs (each `media_asset` row keeps the absolute URL it was uploaded
      under), on the production database:

  ```sql
  UPDATE "media_asset" SET "url" = 'https://media.dentnord.dk/' || "key";
  ```

- [ ] Only then disable the bucket's `r2.dev` access.

## 5. Email (Resend)

- [ ] Resend → Domains → add `dentnord.dk`, add the DNS records it shows (SPF, DKIM; add a DMARC
      record too, e.g. `v=DMARC1; p=quarantine; rua=mailto:<you>`), wait for "Verified".
- [ ] Set `EMAIL_FROM=Dentnord <noreply@dentnord.dk>` and redeploy. Send a password reset to yourself
      and check it arrives (not in spam) with working links to `https://dentnord.dk/...`.
- [ ] Then turn on email verification: `EMAIL_VERIFICATION=on`, redeploy. New dentists confirm their
      address (24-hour link) before they can log in. **Existing accounts** whose email was never
      confirmed are asked to confirm at their next login (a new link is sent when they enter the right
      password). The admin was seeded as confirmed.

## 6. Storage cleanup cron

`vercel.json` runs `GET /api/cron/storage-cleanup` daily at 02:30 UTC (production deployments only):
uploads stuck for 24 h are aborted, drafts without activity for 60 days are deleted with their files.

- [ ] `CRON_SECRET` is set in Production (without it the route answers 503 and does nothing).
- [ ] Vercel → Project → Settings → Cron Jobs shows the job; after the first night, its log line reads
      `[storage-cleanup] {"uploadsExpired":…,"draftsDeleted":…,"bytesFreed":"…","failures":0}`.
- [ ] Manual run: `curl -H "Authorization: Bearer $CRON_SECRET" https://dentnord.dk/api/cron/storage-cleanup`

## 7. Security headers

All responses carry a Content-Security-Policy, `X-Frame-Options: DENY`, HSTS (2 years,
`includeSubDomains`), `nosniff`, `Referrer-Policy` and `Permissions-Policy` (`src/lib/security-headers.ts`).

- [ ] **HSTS `includeSubDomains`**: once a browser has seen `dentnord.dk`, it will only use HTTPS for
      every `*.dentnord.dk` host for two years. Make sure no subdomain needs plain HTTP. (No `preload`
      is sent; add it only as a deliberate, hard-to-undo decision.)
- [ ] Optional trial: deploy once with `CSP_REPORT_ONLY=1`, click through the site (portal uploads,
      3D viewer, admin image upload) with the browser console open, then remove it and redeploy. The
      E2E suite already fails on any CSP violation.
- [ ] Check the headers:

  ```bash
  curl -sI https://dentnord.dk/da | grep -iE "content-security|x-frame|strict-transport|x-content-type|referrer-policy|permissions-policy|x-powered-by"
  ```

  The CSP's `connect-src` must name `https://dentnord-cases.<account>.eu.r2.cloudflarestorage.com`
  and the media bucket, `img-src` the media URL, and it must end with `upgrade-insecure-requests`.

## 8. Admin account

- [ ] Log in at `https://dentnord.dk/en/login`. The admin must set up two-factor authentication
      (authenticator app) before anything in `/admin` opens. Save the 10 backup codes in a password
      manager.
- [ ] Lost phone and backup codes: reset 2FA directly in the database (Neon SQL editor, production),
      then log in with the password and set it up again:

  ```sql
  DELETE FROM "two_factor" WHERE "userId" = (SELECT "id" FROM "user" WHERE "email" = '<admin email>');
  UPDATE "user" SET "twoFactorEnabled" = false WHERE "email" = '<admin email>';
  DELETE FROM "session" WHERE "userId" = (SELECT "id" FROM "user" WHERE "email" = '<admin email>');
  ```

## 9. After the switch

- [ ] `pnpm check:css --url https://dentnord.dk/en https://dentnord.dk/da`
- [ ] `https://dentnord.dk/robots.txt` names `Sitemap: https://dentnord.dk/sitemap.xml`;
      the sitemap lists `https://dentnord.dk/da/…` and `…/en/…` with hreflang links.
- [ ] Google Search Console: add the `dentnord.dk` domain property and submit the sitemap.
- [ ] Share a page link in Slack / LinkedIn / mail: the Open Graph image and title appear.
- [ ] Register a test dentist (with `EMAIL_VERIFICATION=on`: confirm the email), approve them, submit
      a case with files, then delete the test dentist from `/admin/dentists/<id>` (GDPR erasure).
