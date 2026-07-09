# Plan 017: Add Playwright E2E coverage for shift lifecycle and credit POS flows

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ac183ef..HEAD -- tests/e2e/ tests/e2e/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MEDIUM
- **Depends on**: none (but benefits from 009 for shift query stability)
- **Category**: tests
- **Planned at**: commit `4ac183ef`, 2026-07-08

## Why this matters

`tests/e2e/README.md:61-62` has two explicit TODOs for missing E2E coverage:

1. **Shift lifecycle** — opening a shift, making sales, closing the shift with
   cash reconciliation. The TODO notes a blocker: "duplicate mutate processing
   during automated shift close" under the Zero dev runner.
2. **Credit-sale POS** — selling to a customer on credit and verifying the
   credit account balance updates. The TODO notes a blocker: "E2E helpers
   cannot enable credit settings and create customers with credit accounts
   through the UI."

These are two of the most business-critical flows in a POS system. Without E2E
coverage, regressions in shift reconciliation or credit accounting can ship
undetected. The existing E2E suite covers auth, product CRUD, and POS checkout
— adding shift and credit flows completes the critical-path coverage.

## Current state

- `tests/e2e/README.md:61`:
  ```
  TODO: add shift lifecycle coverage once the close-shift flow is stable under the Zero dev runner; the current blocker is duplicate mutate processing during automated shift close.
  ```
- `tests/e2e/README.md:62`:
  ```
  TODO: add credit-sale POS coverage after the E2E helpers can enable credit settings and create customers with credit accounts through the UI.
  ```
- Existing E2E layout (`tests/e2e/README.md:48-53`):
  | Path | Purpose |
  |------|---------|
  | `auth/` | Login, register, org selection, org creation |
  | `products/` | Product CRUD smoke flows |
  | `pos/` | POS checkout and split-payment flows |
  | `helpers/` | Shared login, org selection, and product form steps |
- E2E commands: `bun run e2e:playwright` (all), `bun run e2e:playwright:smoke`
  (@smoke tag only).
- Playwright config: `playwright.config.ts` auto-starts the app and Zero cache
  on ports 3000 and 4848 if nothing is already listening.
- Auth setup: `auth.setup.ts` creates a bootstrap account via API when
  `PLAYWRIGHT_LOGIN_EMAIL` is not set.
- Plan 005 (`plans/005-pos-checkout-e2e.md`) is BLOCKED with the note:
  "shift-close UI flow hits duplicate Zero mutate processing under Playwright".
  This means the shift-close blocker is a known issue that may still be present.
- The credit settings are organization-level settings stored in
  `organization.metadata` (see `features/settings/settings.shared.ts`).
  Enabling credit in E2E requires either a UI flow through settings or a
  direct API/DB setup step.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| E2E (all) | `bun run e2e:playwright` | all pass |
| E2E (smoke) | `bun run e2e:playwright:smoke` | all pass |
| E2E (debug) | `bun run e2e:playwright:debug` | interactive |
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run fix && bun run check` | exit 0 |

## Scope

**In scope**:
- `tests/e2e/shifts/` (create — shift lifecycle spec(s))
- `tests/e2e/credit/` (create — credit POS sale spec(s))
- `tests/e2e/helpers/` (add shift and credit helper functions if needed)
- `tests/e2e/README.md` (update the TODO lines to document the new coverage)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `playwright.config.ts` — the config already auto-starts servers; do not
  change it.
- `features/shifts/` or `features/credit/` production code — if the shift-close
  blocker (duplicate mutate processing) is still present, this plan should
  document it as a STOP condition, not fix the production code.
- `features/pos/` production code — the POS UI is not changing.

## Git workflow

- Branch: `advisor/017-e2e-shift-credit-coverage`
- Conventional commit, e.g. `test(e2e): add shift lifecycle and credit POS coverage`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Investigate the shift-close blocker

Before writing the shift lifecycle spec, determine whether the "duplicate
mutate processing" blocker from plan 005 is still present:

1. Start the dev environment: `docker compose up -d postgres`, `bun run dev`,
   `bun run zero:dev`.
2. Manually open a shift in the POS UI, make a test sale, and close the shift.
3. If the close succeeds without errors, the blocker may be resolved — proceed
   to Step 2.
4. If the close fails with "duplicate mutate processing" or similar Zero
   errors, STOP — the blocker is still present. Document the exact error and
   skip the shift-close portion of the spec (write only the open + sale
   portion, with a `test.skip` for close).

**Verify**: Document the result. If the blocker is resolved, proceed. If not,
write the spec with the close portion skipped and clearly annotated.

### Step 2: Write the shift lifecycle E2E spec

Create `tests/e2e/shifts/shift-lifecycle.spec.ts` following the pattern of
existing specs in `tests/e2e/pos/`:

1. **Setup**: Sign in (reuse `tests/e2e/helpers/` login helpers), select org.
2. **Open shift**: Navigate to POS, open a shift with a starting cash amount.
   Assert the shift appears as "open" in the shifts list.
3. **Make a sale**: Complete a simple cash sale (reuse checkout helpers from
   `tests/e2e/pos/`).
4. **Close shift**: Navigate to the close-shift modal, enter expected cash
   amounts, confirm closure. Assert the shift appears as "closed" with the
   correct reconciliation totals.
5. **Tag**: Add `@smoke` to the open + close flow if it passes reliably.

If the shift-close blocker is still present (Step 1), write steps 1-3 as
passing tests and step 4 as `test.skip` with a comment referencing the blocker.

**Verify**: `bun run e2e:playwright -- --grep shift` → shift spec passes (or
skips gracefully).

### Step 3: Write the credit-sale POS E2E spec

Create `tests/e2e/credit/credit-sale.spec.ts`:

1. **Setup**: Sign in, select org.
2. **Enable credit settings**: Either navigate to organization settings and
   enable credit, OR use a setup step that writes the credit settings directly
   via API/DB. If a UI path is too complex, add a helper in
   `tests/e2e/helpers/` that calls the settings API endpoint.
3. **Create a customer with a credit account**: Navigate to customers, create
   a customer, ensure the credit account is created (may be automatic on
   customer creation when credit is enabled — verify the actual flow).
4. **Make a credit sale**: In POS, select the customer, add items, choose
   "credit" as the payment method, complete the sale.
5. **Verify credit balance**: Navigate to the credit ledger, assert the
   customer's balance reflects the new charge.

**Verify**: `bun run e2e:playwright -- --grep credit` → credit spec passes.

### Step 4: Update `tests/e2e/README.md`

Replace the two TODO lines (61-62) with documentation of the new coverage:

- In the layout table, add `| shifts/ | Shift lifecycle: open, sale, close |`
  and `| credit/ | Credit-sale POS flow and balance verification |`.
- Remove or update the TODO lines to reflect what is now covered and what
  remains (e.g., if shift-close was skipped due to the blocker, note that).

**Verify**: `bun run e2e:playwright` → all specs pass (or skip gracefully).

### Step 5: Run full E2E suite and typecheck

**Verify**:
- `bun run e2e:playwright` → all pass (or known skips only)
- `bunx tsc --noEmit` → exit 0
- `bun run check` → exit 0

## Test plan

The deliverable IS the test plan — no additional tests needed beyond the specs
created in Steps 2 and 3.

## Done criteria

- [ ] `tests/e2e/shifts/shift-lifecycle.spec.ts` exists and passes (or skips
      gracefully if the shift-close blocker is still present)
- [ ] `tests/e2e/credit/credit-sale.spec.ts` exists and passes
- [ ] `tests/e2e/README.md` TODO lines updated to reflect new coverage
- [ ] `bun run e2e:playwright` → all pass (or known skips only)
- [ ] `bunx tsc --noEmit` exits 0; `bun run check` exits 0
- [ ] `git status` shows no modified files outside in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The "duplicate mutate processing" blocker on shift-close is still present
  under Playwright — write the spec with `test.skip` for the close portion and
  report the exact error. Do NOT attempt to fix the Zero mutate processing in
  this plan.
- Enabling credit settings requires a complex UI flow that cannot be
  simplified with an API helper — report the settings flow and suggest a
  follow-up plan for the helper.
- Customer credit account creation is not automatic and requires a separate
  UI flow not covered by existing helpers — report the flow and add a helper,
  or skip the spec with a documented reason.
- The Playwright config or server startup fails in the E2E environment — report
  the error; do not change `playwright.config.ts`.
- Any existing E2E spec breaks after adding the new specs — report which spec
  broke and why.

## Maintenance notes

- **Shift-close blocker**: plan 005 documented this as "duplicate Zero mutate
  processing during automated shift close." This is likely a Zero dev-runner
  issue where Playwright's fast interaction timing causes the same mutate to
  be processed twice. If this is resolved in a future Zero version, remove the
  `test.skip` and enable the close portion.
- **Credit settings setup**: if the API/DB setup approach is used, ensure it
  cleans up after the spec (or uses a fresh org per run) to avoid polluting
  subsequent specs.
- **`posv2`**: if `posv2` ever replaces `pos`, the credit-sale spec may need
  to target the `posv2` checkout flow instead. Update the spec selectors
  accordingly.
- These specs should be tagged `@smoke` once they pass reliably in CI, so they
  run on every PR via `bun run e2e:playwright:smoke`.
