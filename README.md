# Dentnord

Website, dentist portal and admin dashboard for Dentnord (surgical guides for dental implants).

```bash
pnpm install
cp .env.example .env   # fill in values
pnpm db:migrate && pnpm db:seed
pnpm dev               # http://localhost:3000/da
```

See `CLAUDE.md` for architecture, conventions and commands.
