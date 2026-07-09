# Playwright E2E (web)

End-to-end browser tests for Zentro via [Playwright](https://playwright.dev).

## Prerequisites

1. Postgres: `docker compose up -d`
2. Playwright browsers: `bunx playwright install chromium` (once after install)
3. Tests start the app and Zero cache automatically via `playwright.config.ts` when nothing is already listening on ports 3000 and 4848.
4. A **setup project** (`auth.setup.ts`) runs first (after servers are up) and creates a bootstrap account via API when `PLAYWRIGHT_LOGIN_EMAIL` is not set.

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

Without that file, `auth.setup.ts` registers a user + org automatically. Use `FRESH=1` (or `PLAYWRIGHT_E2E_FRESH=1`) to force a new bootstrap account, e.g. after resetting Postgres.

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
| `pos/` | POS checkout and split-payment flows |
| `shifts/` | Shift lifecycle: open, cash movement, sale, close |
| `credit/` | Credit-sale POS flow and balance verification |
| `sales/` | Sales advanced filters (Select inside Popover) |
| `helpers/` | Shared login, org selection, product, customer, settings, and POS form steps |

Each spec is isolated: top-level tests launch `/login` and sign in when needed.

After login, org selection is detected by the heading **Elige Cómo Quieres Entrar** (not the badge alone).

Product flows target `#product-form-*` ids on the create-product sheet. Do not fill money fields via shared placeholder `0`; use the dedicated price/cost/stock inputs.

Shift lifecycle coverage (`shifts/shift-lifecycle.spec.ts`) opens a shift, registers a cash
movement, completes a cash sale, and closes the shift with reconciliation. If the known
"duplicate Zero mutate processing" blocker resurfaces during automated shift close, the
close portion should be marked `test.skip` until the Zero dev runner is stable.

Credit-sale POS coverage (`credit/credit-sale.spec.ts`) enables credit settings, creates a
customer, makes a credit sale in POS, verifies the credit account balance on the credit
page, and records an abono (payment). Credit accounts are created automatically on the
first credit sale via `recordCreditSaleCharge`.
