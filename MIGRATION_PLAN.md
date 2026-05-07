# Zentro Reborn Migration Plan

This document is the source of truth for migrating the remaining application code from `../zentro-reborn` into this Vike + oRPC project.

Future agents must read this file before migration work, update the checkboxes as milestones are completed, and keep notes current when scope or ordering changes.

## Migration Rules

- Keep this project on Vike. Do not reintroduce TanStack Router, TanStack Start route files, route trees, or `_auth` route wrappers.
- Keep this project on oRPC OpenAPI transport only. Do not add `RPCLink`, `RPCHandler`, `/rpc`, or TanStack Start server functions.
- Convert every old `*.functions.ts` API surface into oRPC contracts and routers:
  - Browser-safe schemas and contracts go under `schemas/**` and `server/orpc/contracts/**`.
  - Server handlers go under `server/orpc/routers/**`.
  - React consumption uses `orpcQuery.<module>.<procedure>.queryOptions()` or `.mutationOptions()`.
- Preserve Vike runtime boundaries:
  - Server-only code must use `.server.ts` where appropriate or live under `server/**`.
  - Browser components must not import Drizzle tables, `server/auth`, router implementations, or DB helpers.
  - Vike routes use `pages/**/+Page.tsx`, `+guard.ts`, and `+data.server.ts` only when server-side route data is required.
- Prefer copying UI behavior and UX from `../zentro-reborn`, but adapt imports, data hooks, mutations, redirects, and auth checks to this project.
- Keep the migration incremental. Each milestone should end with `bunx tsc --noEmit` and `bun run build`; run more focused tests when test tooling is added.
- Update this document in the same change whenever a milestone is completed, split, blocked, or materially re-scoped.

## Source Inventory

Original project root: `../zentro-reborn`

Major source areas to migrate:

- Routes:
  - `src/routes/_auth/dashboard.tsx`
  - `src/routes/_auth/organization.tsx`
  - `src/routes/_auth/pos.tsx`
  - `src/routes/_auth/products.tsx`
  - `src/routes/_auth/sales.tsx`
  - `src/routes/_auth/shifts.tsx`
  - `src/routes/_auth/settings.tsx`
  - `src/routes/_auth/restaurants.tsx`
  - `src/routes/_auth/kitchen.tsx`
  - `src/routes/login.tsx`
  - `src/routes/join.tsx`
- Features:
  - `src/features/auth`
  - `src/features/organization`
  - `src/features/modules`
  - `src/features/dashboard`
  - `src/features/settings`
  - `src/features/products`
  - `src/features/customers`
  - `src/features/credit`
  - `src/features/pos`
  - `src/features/restaurants`
  - `src/features/core/sales`
- Database schemas already present in this repo:
  - `database/drizzle/schema/auth.schema.ts`
  - `database/drizzle/schema/customer.schema.ts`
  - `database/drizzle/schema/feature.schema.ts`
  - `database/drizzle/schema/inventory.schema.ts`
  - `database/drizzle/schema/pos.schema.ts`
  - `database/drizzle/schema/restaurant.schema.ts`
  - `database/drizzle/schema/sales.schema.ts`
  - `database/drizzle/schema/credit.schema.ts`

## Current Status

- [x] Base Vike app is created.
- [x] better-auth server/client wiring exists.
- [x] Organization selection and join-link oRPC module exists.
- [x] Base Zentro layout from `../zentro-reborn/src/components/AppLayout.tsx` has been adapted to Vike in `components/AppLayout.tsx`.
- [x] Vike scaffold routes and Star Wars example code have been removed.
- [ ] Remaining feature APIs have been migrated from TanStack Start server functions to oRPC.
- [ ] Remaining feature pages have been migrated from TanStack Router routes to Vike pages.
- [ ] Full end-to-end app workflow has been verified.

## Milestone 0: Baseline And Guardrails

Goal: make sure the repo stays stable before large feature migration starts.

- [ ] Confirm `AGENTS.md` links to this file and requires future agents to update checkboxes.
- [ ] Run `bun install` if dependencies have changed locally.
- [ ] Run `bunx tsc --noEmit`.
- [ ] Run `bun run build`.
- [ ] Inspect `git status --short` and identify unrelated user changes before editing.
- [ ] Confirm Vike auth guards redirect:
  - unauthenticated `/dashboard` -> `/login`
  - authenticated without active organization -> `/organization`
  - authenticated with active organization -> dashboard content
- [ ] Decide whether to add test tooling now or defer until feature modules are migrated.

Acceptance criteria:

- Typecheck and build pass.
- No scaffold/example code remains referenced by routes or navigation.
- This plan reflects the actual current status.

## Milestone 1: Shared Migration Foundation

Goal: create reusable patterns so every feature migration follows the same shape.

- [ ] Document or create a small example oRPC module that includes:
  - `schemas/<module>.ts`
  - `server/orpc/contracts/<module>.ts`
  - `server/orpc/routers/<module>.ts`
  - registration in `server/orpc/contracts/index.ts`
  - registration in `server/orpc/routers/index.ts`
  - React usage through `orpcQuery`
- [ ] Decide where migrated feature UI will live:
  - recommended: `features/<module>/**` for domain UI/hooks/types
  - keep generic UI in `components/ui/**`
  - keep route wrappers thin under `pages/**`
- [ ] Add any missing shared libraries from `../zentro-reborn/src/lib/**` only if still needed:
  - `site.ts`
  - `app-build.ts`
  - other non-router utilities
- [ ] Audit dependencies used by migrated UI:
  - `@tanstack/react-table`
  - `date-fns`
  - POS printer packages
  - testing packages
  - TanStack DB packages, only if still intentionally used
- [ ] Add dependencies only when a migrated feature actually requires them.
- [ ] Keep old TanStack Router dependencies out of this repo.

Acceptance criteria:

- Future modules have a clear, repeated pattern.
- No browser module imports server handlers, DB tables, or auth server modules.
- `bunx tsc --noEmit` passes after foundation changes.

## Milestone 2: Organization, Access Control, And Modules

Goal: finish the organization management surface and dynamic module navigation before feature pages depend on it.

Source files:

- `../zentro-reborn/src/features/organization/**`
- `../zentro-reborn/src/features/modules/**`
- `../zentro-reborn/src/routes/_auth/organization.tsx`

Tasks:

- [ ] Compare current `server/organization/**`, `schemas/organization.ts`, and `server/orpc/routers/organization.ts` against the old organization feature.
- [ ] Port missing organization management schemas:
  - member list
  - invitation list
  - join-link management
  - role/permission labels
  - organization settings fields
- [ ] Port missing organization management procedures to oRPC:
  - query organization management data
  - create/revoke join links
  - invite members if still needed
  - update member roles if still needed
  - remove members if still needed
- [ ] Port `access-control.shared.ts` and server policy behavior only where not already present.
- [ ] Port module registry primitives:
  - `module-definition.ts`
  - `module-registry.ts`
  - `module-access.shared.ts`
  - `module-access.server.ts` adapted into oRPC
- [ ] Replace old `useOrganizationCapabilities` server-function hook with an oRPC-backed hook.
- [ ] Update `components/AppLayout.tsx` to include module-provided navigation once capabilities are available.
- [ ] Create Vike page `pages/organization/+Page.tsx` for management mode, while preserving organization-selection behavior for users without active org.

Acceptance criteria:

- Organization management page works without TanStack Router.
- Sidebar shows only navigation allowed for the active organization and enabled modules.
- Active organization switching clears query cache and returns to organization selection.
- `bunx tsc --noEmit` and `bun run build` pass.

## Milestone 3: Settings

Goal: migrate business settings because POS, receipts, restaurants, and sales depend on them.

Source files:

- `../zentro-reborn/src/features/settings/**`
- `../zentro-reborn/src/routes/_auth/settings.tsx`

Tasks:

- [ ] Port `settings.shared.ts` schemas to `schemas/settings.ts`.
- [ ] Create `server/orpc/contracts/settings.ts`.
- [ ] Create `server/orpc/routers/settings.ts`.
- [ ] Register settings contract/router.
- [ ] Convert old `settings.functions.ts` calls to oRPC procedures.
- [ ] Port `use-settings.ts` to use `orpcQuery`.
- [ ] Create `pages/settings/+Page.tsx`.
- [ ] Add `pages/settings/+guard.ts` requiring auth and active org.
- [ ] Ensure settings reads/writes are scoped by active organization.
- [ ] Verify form loading, optimistic/cache invalidation behavior, and error states.

Acceptance criteria:

- Settings page can load and save settings through `/api`.
- No browser code imports settings server code directly.
- Cache keys come from oRPC/TanStack Query.
- Typecheck and build pass.

## Milestone 4: Products And Inventory Catalog

Goal: migrate product/category CRUD and make catalog APIs available for POS.

Source files:

- `../zentro-reborn/src/features/products/**`
- `../zentro-reborn/src/routes/_auth/products.tsx`
- relevant schema in `database/drizzle/schema/inventory.schema.ts`

Tasks:

- [ ] Port product and category schemas to `schemas/products.ts`.
- [ ] Create `server/orpc/contracts/products.ts`.
- [ ] Create `server/orpc/routers/products.ts`.
- [ ] Register products contract/router.
- [ ] Port product queries:
  - list products
  - list categories
  - product detail if present
- [ ] Port mutations:
  - create product
  - update product
  - delete/deactivate product
  - create/update/delete category
- [ ] Port UI components:
  - `products-table-columns.tsx`
  - `category-dialog.tsx`
  - `delete-product-dialog.tsx`
  - `product-form-sheet.tsx`
- [ ] Port `use-products.ts` to oRPC.
- [ ] Add `pages/products/+Page.tsx` and `+guard.ts`.
- [ ] Add dependency `@tanstack/react-table` if the migrated table requires it.
- [ ] Verify inventory records are organization-scoped.

Acceptance criteria:

- Products page supports list/create/edit/delete behavior.
- Product/category mutations invalidate or update generated oRPC query keys.
- POS can later consume the same catalog procedures or dedicated POS catalog procedures.
- Typecheck and build pass.

## Milestone 5: Customers And Credit

Goal: migrate customer management and credit/account-balance logic before POS checkout.

Source files:

- `../zentro-reborn/src/features/customers/**`
- `../zentro-reborn/src/features/credit/**`
- relevant schemas in `database/drizzle/schema/customer.schema.ts` and `credit.schema.ts`

Tasks:

- [ ] Port customer schemas to `schemas/customers.ts`.
- [ ] Create customers contract/router and register them.
- [ ] Port customer queries/mutations:
  - list/search customers
  - create customer
  - update customer
  - customer detail if present
- [ ] Port credit schemas to `schemas/credit.ts`.
- [ ] Create credit contract/router and register them.
- [ ] Port credit queries/mutations:
  - account summary
  - ledger/history
  - payment/adjustment creation if present
- [ ] Convert old `customers.functions.ts` and `credit.functions.ts` to oRPC.
- [ ] Port or adapt tests from old `*.server.test.ts` once this repo has test tooling.
- [ ] Keep customer picker APIs compatible with the POS migration.

Acceptance criteria:

- Customer search and creation can be called from browser through oRPC.
- Credit operations enforce organization membership and permissions.
- Typecheck and build pass.

## Milestone 6: Dashboard

Goal: replace placeholder dashboard metrics with real organization data.

Source files:

- `../zentro-reborn/src/features/dashboard/**`
- `../zentro-reborn/src/routes/_auth/dashboard.tsx`

Tasks:

- [ ] Port dashboard response schema to `schemas/dashboard.ts`.
- [ ] Create dashboard contract/router and register them.
- [ ] Convert old `dashboard.functions.ts` to oRPC.
- [ ] Port dashboard page UI into `pages/dashboard/+Page.tsx`.
- [ ] Ensure metrics use active organization context from `requireOrgMiddleware`.
- [ ] Add loading, empty, and error states consistent with the app layout.
- [ ] Confirm dashboard does not duplicate heavy POS/sales queries when a compact aggregate query is enough.

Acceptance criteria:

- Dashboard shows real data for the active organization.
- Placeholder metric cards are removed.
- Typecheck and build pass.

## Milestone 7: Sales Core And Sales History

Goal: migrate sale creation/read models before full POS checkout UI.

Source files:

- `../zentro-reborn/src/features/core/sales/**`
- `../zentro-reborn/src/features/pos/server/sales.ts`
- `../zentro-reborn/src/features/pos/server/sales-history.ts`
- `../zentro-reborn/src/routes/_auth/sales.tsx`
- relevant schemas in `database/drizzle/schema/sales.schema.ts`

Tasks:

- [ ] Port shared sale types to `schemas/sales.ts` or a server-safe type module as appropriate.
- [ ] Create sales contract/router and register them.
- [ ] Port sale history query.
- [ ] Port sale detail query.
- [ ] Port sale creation logic from `create-sale.server.ts` into a server-only service used by oRPC handlers.
- [ ] Ensure sale creation runs inside a DB transaction.
- [ ] Ensure product stock, customer, credit, payment, and tax/discount behavior matches old app.
- [ ] Port sales history UI to `pages/sales/+Page.tsx`.
- [ ] Add `pages/sales/+guard.ts`.
- [ ] Port sale detail sheet if used outside POS.

Acceptance criteria:

- Sales history loads from oRPC.
- Sale creation service is reusable by POS checkout.
- All writes are active-organization scoped and transactional.
- Typecheck and build pass.

## Milestone 8: POS Runtime

Goal: migrate the main point-of-sale workflow.

Source files:

- `../zentro-reborn/src/features/pos/**`
- `../zentro-reborn/src/routes/_auth/pos.tsx`

Tasks:

- [ ] Port POS schemas to `schemas/pos.ts`.
- [ ] Create POS contract/router and register them, or reuse products/customers/sales contracts where cleaner.
- [ ] Port server catalog/query logic:
  - `server/catalog.ts`
  - `server/shifts.ts`
  - `server/sales.ts`
  - `server/utils.ts`
  - `server/types.ts`
- [ ] Port hooks to oRPC:
  - `usePosQueries.ts`
  - `usePosCart.ts`
  - `usePosShift.ts`
  - `usePosCheckout.ts`
  - `useCreateCustomerModal.ts`
  - `useModifierModal.ts`
- [ ] Port UI components:
  - `PosHeader.tsx`
  - `CategoryTabs.tsx`
  - `ProductGrid.tsx`
  - `ProductCard.tsx`
  - `CartPanel.tsx`
  - `CartItemCard.tsx`
  - `CustomerPicker.tsx`
  - `SaleDetailSheet.tsx`
  - `ThermalReceipt.tsx`
  - `LocalPrinterSettingsCard.tsx`
  - shift modals under `components/modals/**`
- [ ] Add `pages/pos/+Page.tsx` and `+guard.ts`.
- [ ] Add POS printer dependencies only when printing code is ported:
  - `@point-of-sale/receipt-printer-encoder`
  - `@point-of-sale/receipt-printer-status`
  - `@point-of-sale/webbluetooth-receipt-printer`
  - `@point-of-sale/webserial-receipt-printer`
  - `@point-of-sale/webusb-receipt-printer`
- [ ] Mark browser-only printer modules as `.client.ts` or keep them isolated from SSR imports.
- [ ] Ensure local printer settings stay browser-local and never run during SSR.
- [ ] Verify mobile and desktop POS layouts in browser.

Acceptance criteria:

- User can open/close a shift.
- User can browse products/categories.
- User can add/edit/remove cart items.
- User can select/create a customer.
- User can checkout and create a sale.
- Receipt/printing code does not break SSR.
- Typecheck and build pass.

## Milestone 9: Shifts

Goal: migrate shift management outside the POS screen.

Source files:

- `../zentro-reborn/src/features/pos/server/shifts.ts`
- `../zentro-reborn/src/routes/_auth/shifts.tsx`

Tasks:

- [ ] Decide whether shifts live under `pos` oRPC or a separate `shifts` module.
- [ ] Port shift list/detail procedures.
- [ ] Port open/close shift mutations if not already fully covered by POS.
- [ ] Create `pages/shifts/+Page.tsx` and `+guard.ts`.
- [ ] Ensure shift totals are computed consistently with sales/payment records.

Acceptance criteria:

- Shifts page shows current and historical shifts.
- Open/close behavior is consistent between `/pos` and `/shifts`.
- Typecheck and build pass.

## Milestone 10: Restaurant Module And Kitchen

Goal: migrate the restaurant-specific module, kitchen view, and module navigation.

Source files:

- `../zentro-reborn/src/features/restaurants/**`
- `../zentro-reborn/src/routes/_auth/restaurants.tsx`
- `../zentro-reborn/src/routes/_auth/kitchen.tsx`
- relevant schema in `database/drizzle/schema/restaurant.schema.ts`

Tasks:

- [ ] Port restaurant schemas to `schemas/restaurants.ts`.
- [ ] Create restaurants contract/router and register them.
- [ ] Port `restaurants.module.ts` and register it in the module registry.
- [ ] Port restaurant settings components:
  - `RestaurantModuleSettingsCard.tsx`
- [ ] Port restaurant hooks to oRPC:
  - `use-restaurants.ts`
- [ ] Port restaurant procedures from `restaurants.functions.ts`.
- [ ] Add `pages/restaurants/+Page.tsx` and `+guard.ts`.
- [ ] Add `pages/kitchen/+Page.tsx` and `+guard.ts`.
- [ ] Port kitchen ticket document generation:
  - `printing/kitchenTicketDocuments.tsx`
- [ ] Ensure kitchen screen and restaurant navigation are gated by module access.

Acceptance criteria:

- Restaurant module can be enabled/configured.
- Sidebar shows restaurant/kitchen entries only when permitted.
- Kitchen page works without importing server-only code into the browser.
- Typecheck and build pass.

## Milestone 11: Printing And Local Device Integrations

Goal: migrate receipt and kitchen printing safely with SSR boundaries.

Source files:

- `../zentro-reborn/src/features/pos/printing/**`
- `../zentro-reborn/src/features/restaurants/printing/**`

Tasks:

- [ ] Identify every file that uses `window`, `navigator`, WebUSB, WebSerial, WebBluetooth, canvas, or DOM APIs.
- [ ] Rename browser-only modules to `.client.ts` / `.client.tsx` or lazy-load them from browser event handlers.
- [ ] Port receipt document builders that are pure and SSR-safe.
- [ ] Port browser printer manager as client-only code.
- [ ] Port PDF fallback if still needed.
- [ ] Add printer dependencies.
- [ ] Verify build does not evaluate browser-only printer packages during SSR.
- [ ] Verify local settings are stored per browser and per organization when needed.

Acceptance criteria:

- SSR build passes with printer code present.
- Opening POS does not request device permissions until the user starts printer setup.
- Receipt preview and print flow work in supported browsers.

## Milestone 12: Tests And Quality Gates

Goal: recover confidence from the old server tests under the new API architecture.

Source files:

- `../zentro-reborn/src/test/**`
- old `*.server.test.ts` files across features

Tasks:

- [ ] Decide test runner for this repo, likely `bun test` or `vitest`.
- [ ] Add test dependencies only if needed.
- [ ] Port test DB helpers from `src/test/**`.
- [ ] Adapt server tests to call service functions or oRPC handlers directly.
- [ ] Prioritize tests for:
  - organization access control
  - module access
  - product CRUD
  - sale creation transaction behavior
  - POS checkout
  - credit ledger
  - restaurant module access
- [ ] Add `test` script to `package.json` once tests exist.
- [ ] Update `AGENTS.md` command list when test tooling is added.

Acceptance criteria:

- A meaningful test suite runs locally.
- Typecheck, build, and tests pass.
- Critical business rules from the old app are covered.

## Milestone 13: PWA, App Shell, And Deployment Parity

Goal: decide which app-shell/deployment features from the old app still belong in this Vike app.

Source files:

- `../zentro-reborn/src/components/AppBootSplash.tsx`
- `../zentro-reborn/src/components/AppUpdateNotifier.tsx`
- `../zentro-reborn/src/components/DeploymentSkewProtection.tsx`
- `../zentro-reborn/src/components/PwaRegistrar.tsx`
- `../zentro-reborn/public/**`
- `../zentro-reborn/scripts/docker-release.sh`
- `../zentro-reborn/Dockerfile`

Tasks:

- [ ] Decide whether to port PWA manifest, icons, service worker, and update notifier.
- [ ] If porting, adapt for Vike SSR/client boundaries.
- [ ] Port public assets:
  - favicon sizes
  - manifest
  - app icons
  - robots.txt
- [ ] Port deployment skew protection only if deployment environment needs it.
- [ ] Decide whether Docker release scripts apply to the new project.
- [ ] Update `AGENTS.md` with any new deployment commands or workflows.

Acceptance criteria:

- Production build still passes.
- PWA/service-worker behavior does not interfere with local dev.
- Deployment docs match actual scripts.

## Milestone 14: Final Parity Audit

Goal: verify the migrated app has feature parity with the original app where intended.

Tasks:

- [ ] Compare route list:
  - `/login`
  - `/join`
  - `/organization`
  - `/dashboard`
  - `/settings`
  - `/products`
  - `/customers` if exposed as standalone
  - `/credit` if exposed as standalone
  - `/pos`
  - `/shifts`
  - `/sales`
  - `/restaurants`
  - `/kitchen`
- [ ] Compare old `src/features/**` with new `features/**`, `server/orpc/**`, and `schemas/**`.
- [ ] Search for remaining TanStack Start/TanStack Router patterns in migrated code:
  - `createFileRoute`
  - `useNavigate` from `@tanstack/react-router`
  - `Link` from `@tanstack/react-router`
  - `createServerFn`
  - `serverOnly`
  - route tree imports
- [ ] Search for server-only imports in browser code.
- [ ] Run `bunx tsc --noEmit`.
- [ ] Run `bun run build`.
- [ ] Run tests when available.
- [ ] Verify key workflows manually in browser:
  - login/register
  - organization selection
  - organization management
  - settings save
  - product CRUD
  - customer create/search
  - POS checkout
  - sale history/detail
  - shift open/close
  - restaurant/kitchen if enabled
  - logout
- [ ] Update `README.md` and `AGENTS.md` for any final commands, conventions, or known limitations.

Acceptance criteria:

- The intended original app functionality is available in the Vike/oRPC architecture.
- No legacy router/server-function architecture remains.
- Build, typecheck, and tests pass.
- This plan is fully checked or has explicit notes explaining deferred scope.

## Migration Notes

Use this section for short dated notes as milestones progress.

- 2026-05-07: Base layout migration completed. Vike scaffold examples removed. Remaining migration should focus on converting old feature server functions to oRPC before porting each page UI.
