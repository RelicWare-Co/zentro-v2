# Plan 010: Decide the fate of `features/pos` vs `features/posv2`

> **Executor instructions**: This is a **decision plan**, not an
> implementation plan. Do NOT change any code. Read the "Current state"
> evidence, run the drift check, then present the three options to the
> maintainer and record their decision. Once a decision is made, a
> follow-up implementation plan can be written (see "Next steps after
> decision"). If anything in the "STOP conditions" section occurs, stop
> and report — do not improvise. When done, update the status row for
> this plan in `plans/README.md` — unless a reviewer dispatched you and
> told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ac183ef..HEAD -- features/pos/ features/posv2/ README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MEDIUM
- **Depends on**: none (product decision required)
- **Category**: debt
- **Planned at**: commit `4ac183ef`, 2026-07-08

## Why this matters

Both `features/pos` (66 files) and `features/posv2` (19 files) are
active and routed per `README.md:188` (`/pos` and `/posv2`). They share
some code — `features/posv2/components/cart-panel-v2.tsx:15` imports
`formatCurrency` from `features/pos/utils`, and `posv2` components pull
`usePosPage`, types, checkout sub-sections, and printing helpers from
`features/pos/` — but they maintain separate component trees, checkout
flows, and cart logic. This creates a double-maintenance burden and
divergence risk: any change to checkout behavior, cart semantics, or
printing must be reasoned about across two UI surfaces, and the shared
business logic in `features/pos/` is coupled to one of the two UIs it
serves. The backlog note in `plans/README.md:51-53` already flags this
as needing a maintainer decision before any consolidation plan is worth
writing.

## Current state

- `features/pos/` — 66 files, the original POS with full checkout,
  printing, table orders, shift management. Owns `utils.ts`, `hooks/`,
  `printing/`, `sale-modes/`, multiple React contexts
  (`pos-page-context`, `pos-cart-context`, `pos-checkout-context`,
  `pos-shift-context`, etc.), and the `pos.schema.ts` / `pos.shared.ts`
  contracts.
- `features/posv2/` — 19 files, a newer POS UI with its own
  `cart-panel-v2`, `checkout-section-v2`, `product-grid-card`,
  `product-list-item`, `payment-method-grid-v2`, `pos-v2-layout`, and
  `pos-v2-header`. It has a single `hooks/` file
  (`use-keyboard-barcode-scanner.client.ts`) and a
  `posv2-barcode.shared.ts` helper, but no `utils.ts` and no
  `printing/` directory.
- `features/posv2/` imports from `features/pos/`:
  - `formatCurrency`, `calculateItemTotal`, `calculatePriceWithTax`,
    `calculateCartTotals` (from `features/pos/utils.ts`) — used across
    7 `posv2` components.
  - `usePosPage` (from `features/pos/pos-page-context`) — used across
    9 `posv2` components; `posv2` does not define its own page context.
  - Types: `CartItem`, `Product`, `ActiveShift`,
    `PosExtensionRenderProps` (from `features/pos/types` and
    `features/pos/pos-extension.shared`).
  - Checkout sub-sections: `CheckoutCreditSection`,
    `CheckoutCustomerSection`, `CheckoutDiscountSection`,
    `CheckoutSummaryFooter` (from `features/pos/components/checkout/`)
    — reused directly inside `checkout-details-modal.tsx`.
  - Printing: `openPosCashDrawer` (from
    `features/pos/printing/print-sale-receipt.client`) — used in
    `pos-v2-layout.tsx`.
  - Shared UI helpers: `buildTableItemStatusBadge`,
    `isPosOverlayBlockingCatalog`, `openPosCashDrawer`.
- `README.md:188` documents both routes as active:
  `/pos` ("Punto de venta") and `/posv2` ("POS alternativo (v2)").
- The `features/posv2/` components are UI-layer replacements; the
  business logic (checkout, sale creation, shift operations) is shared
  from `features/pos/` via the `usePosPage` context and reused checkout
  sub-sections. `posv2` does not duplicate `utils.ts`, `printing/`, the
  schema, or the checkout hook — it depends on `features/pos/` for
  those.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 4ac183ef..HEAD -- features/pos/ features/posv2/ README.md` | empty or reviewed |
| Count pos files | `find features/pos -type f \| wc -l` | 66 (or note delta) |
| Count posv2 files | `find features/posv2 -type f \| wc -l` | 19 (or note delta) |
| List posv2→pos imports | `grep -rn "from \"@/features/pos/" features/posv2/` | matches as documented above |

No typecheck, lint, or test commands — this plan makes no code changes.

## Scope

**In scope**:
- `plans/README.md` (status row)
- A decision document (this plan, with the maintainer's decision
  recorded in the "Decision record" section below once made).

**Out of scope** (do NOT touch):
- Any code under `features/pos/` or `features/posv2/` — this plan is
  decision-only.
- Route registration, context refactors, component deletion, or
  migration of any kind — those belong to the follow-up implementation
  plan written after the decision.

## Git workflow

- No branch, no commit — this plan produces a decision, not a code
  change. The only file edit is the `plans/README.md` status row (and
  filling in the "Decision record" below if the maintainer decides
  inline).

## Steps

### Step 1: Run the drift check

Run `git diff --stat 4ac183ef..HEAD -- features/pos/ features/posv2/
README.md`. If the output is non-empty, review whether the changes
materially affect the "Current state" evidence (e.g. `posv2` gained its
own `utils.ts`, or one of the routes was removed). On a material
mismatch, STOP.

**Verify**: drift output reviewed; no material contradiction with
Current state.

### Step 2: Present the options to the maintainer

Present the three options below with their evidence. Ask the maintainer
to pick one. Do not advocate — lay out the trade-offs and let them
decide.

#### Option A — Deprecate `posv2`, consolidate into `pos`

Keep `features/pos/` as the single POS. Remove the `/posv2` route and
delete (or archive) `features/posv2/`. Any UX improvements that
motivated `posv2` are ported back into `features/pos/` components.

**Evidence for**:
- `features/pos/` is the larger, more complete tree (66 files vs 19):
  it owns `utils.ts`, `printing/`, `sale-modes/`, all contexts, the
  schema, and the checkout hook.
- `posv2` already depends on `features/pos/` for all business logic —
  it is a UI shell over `pos` internals, not an independent
  implementation.
- Eliminates the double-maintenance surface entirely.
- The checkout sub-sections (`CheckoutCreditSection`, etc.) already
  live in `features/pos/components/checkout/` and are reused by
  `posv2`; consolidating means no cross-tree reuse to reason about.

**Evidence against**:
- Discards the `posv2` UI work (layout, header, product grid/list,
  payment-method grid) unless explicitly ported back.
- If `posv2` was an intentional redesign that the maintainer prefers
  visually, this throws it away.

#### Option B — Deprecate `pos` UI, migrate to `posv2`

Make `features/posv2/` the canonical POS UI. Move the shared business
logic (`utils.ts`, `printing/`, `hooks/`, contexts, schema, checkout
hook) either into `posv2` or into a shared location, then remove the
`/pos` route and the `features/pos/` UI components.

**Evidence for**:
- `posv2` is the newer UI; if it represents the intended future
  design, committing to it removes the legacy surface.
- `posv2` already consumes `pos` internals through a narrow interface
  (`usePosPage`, `utils`, types, checkout sub-sections) — the
  extraction boundary is already partially drawn.

**Evidence against**:
- `posv2` is the smaller tree (19 files) and owns none of the business
  logic — migrating means lifting `utils.ts`, `printing/`, contexts,
  the checkout hook, and `sale-modes/` into `posv2` or a shared module,
  which is a larger refactor than Option A.
- `features/pos/` has features `posv2` does not surface (table orders,
  shift management UI, sale modes) — these would need to be rebuilt or
  ported into the `posv2` UI before `pos` can be removed.
- Higher risk: the migration touches the core checkout path.

#### Option C — Keep both, define a clear boundary

Keep both routes active but document a strict boundary: `features/pos/`
owns all business logic (`utils`, `hooks`, `printing`, contexts,
schema, checkout); `features/posv2/` owns only UI components and must
not duplicate logic. Codify the import rules (already de facto) and
add a lint/architecture test to enforce them.

**Evidence for**:
- Lowest immediate effort — no deletion, no migration.
- Preserves both UIs if the maintainer genuinely wants both (e.g. A/B
  or different store formats).
- The current import pattern already approximates this boundary.

**Evidence against**:
- Does not eliminate the double-maintenance burden — two component
  trees still need parallel updates for any UX change.
- Divergence risk remains; the boundary requires ongoing discipline
  and enforcement.
- Leaves the `plans/README.md:51-53` backlog item open indefinitely.

### Step 3: Record the decision

Once the maintainer chooses, fill in the "Decision record" section
below with: the chosen option, the date, and a one-line rationale.
Then update `plans/README.md` status row for plan 010.

## Decision record

> **Status**: AWAITING DECISION — no option selected yet.
>
> **Chosen option**: _(to be filled by maintainer: A / B / C)_
>
> **Date**: _(to be filled)_
>
> **Rationale**: _(one line)_
>
> **Follow-up implementation plan**: _(to be written after decision;
> reference its number here once created)_

## Test plan

No automated tests — this plan makes no code changes. The "test" is the
maintainer's decision being recorded unambiguously in the Decision
record and reflected in the `plans/README.md` status row.

## Done criteria

- [ ] Drift check run and reviewed; no material contradiction with
  Current state (or STOP was triggered).
- [ ] The three options were presented to the maintainer with their
  evidence.
- [ ] The maintainer's decision is recorded in the "Decision record"
  section above (option, date, rationale).
- [ ] `plans/README.md` status row for plan 010 updated (e.g.
  `DONE (decision: Option X)` or `BLOCKED (awaiting maintainer
  decision)`).
- [ ] No code files outside `plans/` were modified.

## STOP conditions

Stop and report back if:

- The drift check shows `features/posv2/` has gained its own
  `utils.ts`, `printing/`, or a independent checkout hook since
  `4ac183ef` — the dependency profile in Current state is stale and the
  options need re-evaluation.
- The `/pos` or `/posv2` route has been removed from `README.md` since
  `4ac183ef` — one of the two surfaces is already gone, and this plan
  may be moot.
- The maintainer has already made a decision and recorded it elsewhere
  — skip to writing the follow-up implementation plan instead of
  re-asking.
- The file counts (66 / 19) have changed materially — re-confirm the
  evidence before presenting options.

## Maintenance notes

- This plan is a prerequisite for any `pos`/`posv2` consolidation
  work. Do not start an implementation plan until the Decision record
  is filled.
- The backlog entry in `plans/README.md:51-53` should be resolved
  (removed or linked to this plan) once the decision is recorded.
- If Option A or B is chosen, the follow-up implementation plan must
  account for the shared checkout sub-sections
  (`features/pos/components/checkout/checkout-{credit,customer,discount,summary-footer}-section.tsx`)
  that `posv2` reuses — they need to land in whichever tree survives
  (or a shared location).
- The `formatCurrency` duplication noted in `plans/README.md:48-50`
  (6× across features + `features/pos/utils.ts:9` + `lib/utils.ts:8`)
  is orthogonal but related — any consolidation should fold the
  currency formatter into the single `lib/` helper at the same time.
