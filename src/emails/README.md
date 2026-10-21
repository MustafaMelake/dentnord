react-email templates (`@react-email/components`), sent via `src/lib/email.ts` from
`src/server/services/notifications.ts`. Strings live in `messages/*.json` under `emails`, rendered in the
recipient's `preferredLocale` (`i18n.ts`).

- `dentist-registered`: to the admin, a new dentist waits for approval
- `account-approved`: to the dentist (also on re-activation)
- `account-rejected`: to the dentist, optional reason
- `password-reset`: reset link (Better Auth `sendResetPassword`), valid one hour

Planned: case-status-changed, new-message. Never include patient data; use the case number + a portal link.
