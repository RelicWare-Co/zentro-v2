# Playwright E2E (web)

End-to-end browser tests for Zentro via [Playwright](https://playwright.dev).

## Prerequisites

1. Postgres: `docker compose up -d`
2. Playwright browsers: `bunx playwright install chromium` (once after install)
3. Tests start the app and Zero cache automatically via `playwright.config.ts` when nothing is already listening on ports 3000 and 4848.

For local iteration you can still run `bun run dev` and `bun run zero:dev` yourself; Playwright reuses existing servers outside CI.

## Environment

Set credentials before running flows that sign in, pick an organization, or register:

```bash
export PLAYWRIGHT_BASE_URL=http://localhost:3000
export PLAYWRIGHT_LOGIN_EMAIL=you@example.com
export PLAYWRIGHT_LOGIN_PASSWORD=your-password
export PLAYWRIGHT_ORG_NAME="Your Organization Name"
```

Optional:

```bash
export PLAYWRIGHT_NEW_ORG_NAME="Playwright Test Store"
export PLAYWRIGHT_REGISTER_NAME="Playwright E2E"
export PLAYWRIGHT_REGISTER_EMAIL=""   # auto-generated if empty
export PLAYWRIGHT_REGISTER_PASSWORD=your-password
```

Legacy `MAESTRO_*` variable names are still read as fallbacks during migration.

See `.env.example` for documented names.

## Commands

```bash
bun run e2e:playwright              # all flows
bun run e2e:playwright:smoke        # @smoke tag only
bun run e2e:playwright:ui            # interactive UI mode
bun run e2e:playwright:debug        # debug mode
bun run e2e:playwright:report       # open last HTML report
```

## Layout

| Path | Purpose |
|------|---------|
| `auth/` | Login, register, org selection, org creation |
| `products/` | Product CRUD smoke flows |
| `helpers/` | Shared login, org selection, and product form steps |

Each spec is isolated: top-level tests launch `/login` and sign in when needed.

After login, org selection is detected by the heading **Elige Cómo Quieres Entrar** (not the badge alone).

Product flows target `#product-form-*` ids on the create-product sheet — the same contract as the former Maestro flows. Do not fill money fields via shared placeholder `0`; use the dedicated price/cost/stock inputs.
