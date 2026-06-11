# Plan 005: Add Playwright E2E coverage for the POS checkout flow

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d97b06e..HEAD -- tests/e2e playwright.config.ts features/pos pages`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/004-surface-print-failures.md (only if executed concurrently — it touches POS; otherwise none)
- **Category**: tests
- **Planned at**: commit `d97b06e`, 2026-06-10

## Why this matters

The POS sale flow — open a shift, build a cart, take payment, close the
shift — is the reason this product exists, and it has **zero browser-level
coverage**. The Playwright suite (`tests/e2e/`) covers only auth and product
CRUD. The DB-level integration tests (`tests/*.test.ts`) verify server
mutators but cannot catch React state bugs, broken modals, or wiring
regressions in the checkout UI (an area with heavy recent churn:
quick-sale mode, redesigned checkout modal, delivery info, discounts).
After this plan, a refactor that breaks "cashier completes a cash sale"
fails CI-able E2E instead of being discovered at a till.

## Current state

- E2E framework: Playwright (`playwright.config.ts`), `testDir: "tests/e2e"`,
  single chromium project with a `setup` project dependency
  (`tests/e2e/auth.setup.ts`) that registers/bootstraps a user + organization
  automatically when `PLAYWRIGHT_LOGIN_EMAIL` is not set. `workers: 1`,
  `fullyParallel: false` — one shared bootstrap account; specs must tolerate
  sequential execution. The config auto-starts `bun run dev` (port 3000) and
  `bun run zero:dev` (port 4848) when not already running; Postgres must be
  up first (`docker compose up -d`).
- Existing layout (`tests/e2e/README.md`):
  - `tests/e2e/auth/` — login, register, org selection/creation specs
  - `tests/e2e/products/` — product CRUD specs (use these as the structural
    exemplar: e.g. `tests/e2e/products/create-product.spec.ts`)
  - `tests/e2e/helpers/` — `auth.ts`, `bootstrap.ts`, `env.ts`, `products.ts`
    (shared login / org-selection / product-form steps)
- Smoke tagging convention: specs tagged `@smoke` run via
  `bun run e2e:playwright:smoke` (`--grep @smoke`).
- The POS lives at two routes: `pages/(app)/pos/+Page.tsx` (v1, the
  established flow) and `pages/(app)/posv2/+Page.tsx` (newer grid). Target
  **`/pos` (v1)** — it is the flow wired to checkout/shift modals via
  `features/pos/pos-page-context.tsx`.
- Flow facts the specs must respect (from
  `features/pos/hooks/use-pos-checkout.ts` and `features/pos/pos-page.tsx`):
  - A sale requires an **open shift** (`activeShiftId`); the POS page
    prompts to open a shift (starting cash) when none is active, and there
    is a close-shift modal with per-method actual amounts.
  - Checkout has a quick-sale mode (single cash payment, Zap icon toggle)
    and a full checkout modal (mixed payments, credit when
    `allowCreditSales`).
  - Printing is optional: with no printer configured the sale still
    completes (do not assert on print behavior).
- Selector convention: existing specs/helpers locate elements by role and
  accessible name (read `tests/e2e/helpers/products.ts` before writing
  anything — reuse its style; UI copy is Spanish).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Infra | `docker compose up -d` | postgres + zero-cache healthy |
| Browsers (once) | `bunx playwright install chromium` | exit 0 |
| All e2e | `bun run e2e:playwright` | all pass |
| Only new specs | `bunx playwright test tests/e2e/pos` | all pass |
| Smoke | `bun run e2e:playwright:smoke` | all pass |
| Lint | `bun run fix && bun run check` | exit 0 |

## Scope

**In scope**:
- `tests/e2e/pos/` (create; new spec files)
- `tests/e2e/helpers/` (add a `shifts.ts` or `pos.ts` helper if needed)
- `tests/e2e/README.md` (document the new folder in the Layout table)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any application code (`features/`, `pages/`, `server/`, `src/`). If a flow
  can't be automated without an app change (e.g. a missing accessible name),
  that's a STOP/report, not a code change.
- `playwright.config.ts` — config is already correct.
- `tests/*.test.ts` (DB integration suite).

## Git workflow

- Branch: `advisor/005-pos-checkout-e2e`
- Conventional commit, e.g. `test(e2e): cover POS checkout and shift lifecycle`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Explore the live flow once, manually via Playwright

Start infra + app (`docker compose up -d`, then `bunx playwright test
tests/e2e/auth --grep @smoke` to confirm the harness works). Then run
`bunx playwright test --ui` or use `page.pause()` in a scratch spec to walk
the `/pos` route once: note the exact accessible names/roles for: open-shift
modal (starting cash input + confirm button), product card "add" affordance,
cart line items, checkout button, payment method inputs, confirm-sale
button, close-shift modal fields. Record them as constants in
`tests/e2e/helpers/pos.ts`.

**Verify**: the auth smoke spec passes; you have a written list of selectors.

### Step 2: Seed a sellable product

Each spec needs a product with known price. Reuse
`tests/e2e/helpers/products.ts` to create one through the UI (the products
specs already do this), or through the same API the helpers use — do not
seed via direct DB access (e2e suite has no DB helper; keep it that way).
Create the product in a `test.beforeAll` or at the start of the spec, with a
unique name (`POS E2E ${Date.now()}`) so reruns don't collide.

**Verify**: a scratch run shows the product appears in the POS catalog
search.

### Step 3: Spec 1 — `tests/e2e/pos/cash-sale.spec.ts` (@smoke)

Flow: log in (reuse auth helper) → navigate to `/pos` → open shift with
starting cash (e.g. 50000) if prompted → search/add the seeded product to
cart → open checkout → pay exact total in cash → confirm → assert success
feedback (sale completes: cart empties / success state visible; assert on
what the UI actually shows from Step 1 notes).

Tag the describe/test title with `@smoke`.

**Verify**: `bunx playwright test tests/e2e/pos/cash-sale.spec.ts` → passes
twice in a row (run it twice — idempotency matters with the shared
bootstrap org).

### Step 4: Spec 2 — `tests/e2e/pos/split-payment.spec.ts`

Same setup; pay with two methods (e.g. cash + card portions summing to the
total) through the full checkout modal. Assert sale completes and cart
clears.

**Verify**: `bunx playwright test tests/e2e/pos/split-payment.spec.ts` → passes.

### Step 5: Spec 3 — `tests/e2e/pos/shift-close.spec.ts`

Flow: ensure an open shift (open if needed) → make one quick cash sale →
close the shift entering actual amounts → assert the close-shift summary
shows expected vs. actual (the UI computes expected cash = starting cash +
cash sales; assert the displayed expected value matches
starting + sale total). After closing, assert the POS prompts for a new
shift (or shows closed state).

Caveat: because the bootstrap org is shared and specs run sequentially
(`workers: 1`), this spec must not assume it owns the only shift ever —
open its own shift at the start and close it within the test.

**Verify**: `bunx playwright test tests/e2e/pos/shift-close.spec.ts` → passes.

### Step 6: Full suite + docs

Update the Layout table in `tests/e2e/README.md` with a `pos/` row.

**Verify**: `bun run e2e:playwright` → ALL specs pass (including the
pre-existing auth/products ones); `bun run e2e:playwright:smoke` includes
the new cash-sale spec; `bun run fix && bun run check` → exit 0.

## Test plan

This plan IS the test plan. New coverage:

1. Cash quick/standard sale end-to-end (@smoke).
2. Split (mixed-method) payment through the checkout modal.
3. Shift lifecycle: open → sell → close with reconciliation numbers visible.

Credit-sale E2E is deliberately deferred: it requires `allowCreditSales` org
settings plus a customer with a credit account via UI — note it in
`tests/e2e/README.md` as a TODO if you confirm it's nontrivial.

## Done criteria

- [ ] `ls tests/e2e/pos/` shows 3 spec files
- [ ] `bun run e2e:playwright` exits 0 with the new specs included
- [ ] `bun run e2e:playwright:smoke` runs the cash-sale spec
- [ ] No files under `features/`, `pages/`, `server/`, `src/` modified (`git status`)
- [ ] `tests/e2e/README.md` layout table updated
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The `/pos` flow cannot be driven via accessible roles/names (e.g. critical
  buttons lack accessible labels) — report the exact elements; adding
  test-ids to app code is out of scope for this plan and needs a small
  follow-up plan.
- The bootstrap org arrives with POS module disabled or no payment methods
  configured, and you cannot enable them through the UI — report what
  settings the org needs.
- Specs are flaky (>1 failure in 3 consecutive full runs) due to Zero sync
  timing — report the racy assertion rather than papering over it with long
  timeouts.

## Maintenance notes

- These specs share one bootstrap account; anyone adding parallelism
  (`workers > 1`) must first give each spec its own org.
- When `posv2` replaces v1, these specs are the checklist of behaviors the
  new UI must support; port them, don't delete them.
- Future credit-sale and cancellation E2E specs belong in this same folder.
