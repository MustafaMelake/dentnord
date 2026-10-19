Server Actions (`"use server"`) for all mutations. Each action:

1. validates input with a zod schema,
2. re-checks the session/role via `src/server/queries/session.ts` (never trust the client),
3. calls `src/server/services/*` for business logic,
4. passes `locale` explicitly to next-intl (`getTranslations({ locale, ... })`), because root params
   are not available in actions.
