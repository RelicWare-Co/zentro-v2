# ADR 0010: Decompose POS Page Context

## Status

Proposed

## Date

2026-06-29 (updated 2026-07-01)

## Context

`PosPageProvider` in `pos-page-context.tsx` is a 733-line god component (ADR-0008 already extracted table logic into adapters, reducing it from 927 lines). It manages:

- Catalog state (categories, products, search, pagination, modifiers, favorites)
- Cart state (items, discount, totals)
- Checkout state (payments, credit sale, cash change, finalization)
- Shift state (open/close/movement modals and handlers)
- Customer state (selection, credit accounts, create modal)
- Table/mode state (active table, kitchen send, table checkout)
- Modal state (active modal, open/close)
- Barcode scanning (v1 and v2 handlers)
- Receipt printing

The `PosPageState` interface has 40+ fields. `PosPageActions` has 40+ methods. The final `useMemo` has 60+ dependencies. Every component that needs any piece of POS state consumes the entire context, causing unnecessary re-renders.

This is the single biggest source of debt for adding features: every new capability adds state, actions, and dependencies to the same provider.

## Decision

Decompose the god context into **8 focused sub-contexts** (7 domain + 1 variant) that compose inside a thin shell provider, with a temporary `PosPageCompatProvider` for incremental migration.

### Sub-contexts (8 total)

```
PosPageProvider (thin shell — composition only, no hooks called here)
├── PosVariantProvider     — variant prop ("v1" | "v2") available to any consumer
├── PosModalProvider       — activeModal, isMobileCartOpen, isQuickSaleMode, modal openers
├── PosCatalogProvider     — settings, categories, products, search, pagination, modifiers, favorites
├── PosShiftProvider       — active shift, shift form/handlers, requireActiveShift guard
├── PosCustomerProvider    — customer selection, credit accounts, create-customer modal
├── PosSaleModeProvider    — sale mode adapters, deliveryInfo, receipt printing, finalize options
├── PosCartProvider        — cart state/actions (from activeMode), modifier modal, barcode, table mode
├── PosCheckoutProvider    — checkout state (from activeMode.checkout), finalize, quick sale, projected credit
└── PosPageCompatProvider  — assembles { state, actions, meta } from all sub-hooks (TEMPORARY)
```

### Composition order (outer → inner)

```
PosPageProvider (no hooks — pure JSX composition)
└── PosVariantProvider
    └── PosModalProvider
          └── PosCatalogProvider
                └── PosShiftProvider
                      └── PosCustomerProvider
                            └── PosSaleModeProvider    ← consumes modal + catalog + shift + customer
                                  └── PosCartProvider   ← consumes saleMode + shift + catalog
                                        └── PosCheckoutProvider  ← consumes saleMode + shift + customer + modal
                                              └── PosPageCompatProvider  ← consumes ALL sub-hooks
                                                    └── children
```

**Why the inner compat wrapper is necessary:** `PosPageProvider` cannot call `usePosModal()` in the same render where it creates `<PosModalProvider>` — the context wouldn't be available yet. The `PosPageCompatProvider` sits inside all 7 sub-providers, so it can legitimately call every sub-hook and assemble the legacy `{ state, actions, meta }` shape. This is the only component that calls `usePosPage()`.

### Why PosSaleModeProvider (deviation from original ADR)

The original ADR places the sale mode adapter in `PosCartProvider`. We add a dedicated `PosSaleModeProvider` instead because `SaleModeFactoryParams` requires data from 4 sub-contexts (shift, customer, catalog/settings, modal) plus receipt printing which needs customer + org data. Putting all that in `PosCartProvider` would make it a 250-line "integration" context — the same anti-pattern we're trying to fix. `PosSaleModeProvider` cleanly separates adapter lifecycle from cart state exposure.

### Why PosVariantProvider (deviation from original ADR)

`variant` ("v1" | "v2") is not checkout state. It's used by `PosModals` (to choose `CheckoutModal` vs `CheckoutDetailsModal`) and layout components. Putting it in `PosCheckoutProvider` mixes ownership concerns. A tiny `PosVariantProvider` at the top of the tree makes `variant` available to any consumer without coupling it to checkout.

### Hook naming convention

Existing hooks `usePosCart()` (`hooks/use-pos-cart.ts`) and `usePosCheckout()` (`hooks/use-pos-checkout.ts`) are internal logic hooks, not context hooks. To avoid name collisions and confusion, context hooks use the `Context` suffix where needed:

| Context file | Hook name |
|---|---|
| `pos-modal-context.tsx` | `usePosModal()` |
| `pos-catalog-context.tsx` | `usePosCatalog()` |
| `pos-shift-context.tsx` | `usePosShiftContext()` |
| `pos-customer-context.tsx` | `usePosCustomer()` |
| `pos-sale-mode-context.tsx` | `usePosSaleMode()` |
| `pos-cart-context.tsx` | `usePosCartContext()` |
| `pos-checkout-context.tsx` | `usePosCheckoutContext()` |
| `pos-variant-context.tsx` | `usePosVariant()` |
| `pos-page-compat-context.tsx` | `usePosPage()` (temporary) |

### What each sub-context owns

| Provider | Owns | Consumes |
|---|---|---|
| **PosVariant** | `variant` prop | nothing |
| **PosModal** | `activeModal`, `isMobileCartOpen`, `isQuickSaleMode`, pure modal openers, `closeActiveModal` | nothing |
| **PosCatalog** | settings query, categories, products, search, pagination, modifiers, favorites, `resolveBarcodeProduct`, `activeOrganizationId`, `activeOrganizationName` | nothing |
| **PosShift** | `useActiveShift`, `usePosShift` (form state + handlers), `requireActiveShift` | modal (opens shift-required dialog) + **catalog** (`paymentMethodOptions`) |
| **PosCustomer** | `selectedCustomerId`, `usePosCustomers`, `useCreditAccountsSearch`, `selectedCustomerCreditAccount`, `useCreateCustomerModal` | modal (opens create-customer modal) |
| **PosSaleMode** | `deliveryInfo`, `saleSuccessToken`, `printReceiptForSale`, `handleSaleCompleted`, `usePosSaleModeAdapters`, `activeMode`, `buildFinalizeOptions` | modal + catalog + shift + customer |
| **PosCart** | `useModifierModal`, `handleProductSelect`, barcode handlers, `enterTableMode`/`exitTableMode`, cart state/actions from `activeMode` | saleMode + shift + catalog |
| **PosCheckout** | checkout state from `activeMode.checkout`, `finalizeSale`, `handleQuickSale`, `openCheckout`, `projectedCreditBalance` | saleMode + shift + customer + modal |
| **PosPageCompat** | assembles legacy `{ state, actions, meta }` shape | ALL sub-contexts |

### Cross-context dependencies resolved

- **`requireActiveShift`** → lives in `PosShiftProvider` (checks `activeShift`, opens shift-required modal). Consumed by cart (product select, barcode) and checkout (finalize, quick sale, open checkout).
- **`printReceiptForSale`** → lives in `PosSaleModeProvider` (needs customers + selectedCustomerId + org data from customer/catalog contexts). Passed to adapters as `printReceiptForSale: handleSaleCompleted`.
- **`projectedCreditBalance`** → lives in `PosCheckoutProvider` (needs `selectedCustomerCreditAccount` from customer context + `checkout.remainingCreditAmount` from activeMode).
- **`handleProductSelect`** → lives in `PosCartProvider` (needs `requireActiveShift` from shift + `handleProductSelection` from modifier modal + `addToCart` from activeMode).
- **`buildFinalizeOptions`** → lives in `PosSaleModeProvider` (needs `selectedCustomerId`, `closeActiveModal`, `handleSaleCompleted`, `resetDeliveryInfo` — all available in sale mode context).
- **`paymentMethodOptions`** → owned by `PosCatalogProvider` (from settings query). Consumed by `PosShiftProvider` (for `usePosShift` param) and `PosSaleModeProvider` (for adapter params).
- **`saleSuccessToken`** → lives in `PosSaleModeProvider` (not `PosModalProvider`).
- **`deliveryInfo`** → lives in `PosSaleModeProvider` (not `PosCartProvider`).

### `usePosPage()` removal

The original ADR said `usePosPage()` can remain permanently as a convenience. The implementation **removes it** after all 27 consumers migrate to enforce proper separation. During migration, `usePosPage()` is a temporary compatibility layer in `PosPageCompatProvider`.

## File structure

All new context files in `features/pos/`:

```
features/pos/
  pos-variant-context.tsx        ← NEW (tiny — variant prop → context)
  pos-modal-context.tsx          ← NEW
  pos-catalog-context.tsx        ← NEW
  pos-shift-context.tsx          ← NEW
  pos-customer-context.tsx       ← NEW
  pos-sale-mode-context.tsx      ← NEW
  pos-cart-context.tsx           ← NEW
  pos-checkout-context.tsx       ← NEW
  pos-page-compat-context.tsx    ← NEW (temporary compat layer, deleted in step 9)
  pos-page-context.tsx           ← MODIFIED (thin shell only — pure JSX composition)
```

## Migration path

Each step is independently shippable. After each step: `bunx tsc --noEmit` + `bun run check` + manual POS smoke test.

### Step 0: Scaffolding

Create `PosVariantProvider` + `PosPageCompatProvider` (initially contains all god provider logic). `PosPageProvider` becomes pure JSX composition with pass-through providers. Types move to `pos-page-compat-context.tsx`.

### Steps 1–7: Extract sub-contexts

1. **PosModalProvider** — modal state, openers, `closeActiveModal`. ~60 lines.
2. **PosCatalogProvider** — settings, categories, products, search, pagination, modifiers, favorites. ~180 lines.
3. **PosShiftProvider** — active shift, shift form/handlers, `requireActiveShift`. ~130 lines.
4. **PosCustomerProvider** — customer selection, credit accounts, create-customer modal. ~90 lines.
5. **PosSaleModeProvider** — adapters, `deliveryInfo`, receipt printing, `buildFinalizeOptions`. ~160 lines.
6. **PosCartProvider** — cart state/actions, modifier modal, barcode, table mode. ~170 lines.
7. **PosCheckoutProvider** — checkout state, `finalizeSale`, `handleQuickSale`, `projectedCreditBalance`. ~130 lines.

After each extraction, `PosPageCompatProvider` calls the new sub-hook instead of managing that state directly.

### Step 8: Verify compat layer fully delegated

`PosPageCompatProvider` calls all 7 sub-hooks and assembles the legacy shape with zero direct state management. Run full verification including Playwright `@smoke` E2E.

### Step 9: Migrate consumers + delete compatibility layer

27 consumer files migrate from `usePosPage()` to specific sub-context hooks. After all migrated: delete `pos-page-compat-context.tsx`, delete legacy types, `pos-page-context.tsx` remains as thin shell (~20 lines). Run full Playwright E2E suite.

## Consequences

- **Each sub-context is independently testable.** Cart logic can be tested without mocking catalog queries.
- **Re-render scope shrinks.** A product search change doesn't re-render the checkout modal.
- **New features target the right sub-context.** A loyalty program adds to `PosCheckoutProvider`, not the god provider.
- **`usePosPage()` is removed** after migration to enforce proper separation. No convenience wrapper remains.
- **Dependency arrays become manageable.** Each sub-context has 5-10 dependencies instead of 60+.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Hook order violations** — `usePosSaleModeAdapters` calls adapter hooks in a loop (biome-ignore already present). | Keep `usePosSaleModeAdapters` call in `PosSaleModeProvider` exactly as-is. Don't reorder adapter factories. |
| **Re-render scope changes** — moving state to sub-contexts changes which components re-render. | This is the desired improvement. Verify no component relies on receiving unrelated state updates as a side effect. |
| **`usePosPage()` compatibility layer perf** — during migration, `usePosPage()` calls 7 hooks and assembles a large object. | Acceptable temporary cost. The compatibility layer is deleted in step 9. |
| **`variant` prop threading** — needed by layout components and `PosModals` without the god context. | Dedicated `PosVariantProvider` at the top of the composition tree. |
| **Circular imports** — 9 new context files importing each other's hooks. | Each context file only imports the hook from contexts above it in the composition order. No circular deps by construction. |
| **Compat layer during migration** — `usePosPage()` must be available while sub-contexts are being extracted. | `PosPageCompatProvider` is a separate inner component below all sub-providers. It calls sub-hooks legitimately. |

## Related Files

- `features/pos/pos-page-context.tsx` (733-line god provider → thin shell)
- `features/pos/pos-variant-context.tsx` (NEW)
- `features/pos/pos-modal-context.tsx` (NEW)
- `features/pos/pos-catalog-context.tsx` (NEW)
- `features/pos/pos-shift-context.tsx` (NEW)
- `features/pos/pos-customer-context.tsx` (NEW)
- `features/pos/pos-sale-mode-context.tsx` (NEW)
- `features/pos/pos-cart-context.tsx` (NEW)
- `features/pos/pos-checkout-context.tsx` (NEW)
- `features/pos/pos-page-compat-context.tsx` (NEW, temporary)
- `features/pos/hooks/use-pos-cart.ts` → `PosCartProvider`
- `features/pos/hooks/use-pos-checkout.ts` → `PosCheckoutProvider`
- `features/pos/hooks/use-pos-shift.ts` → `PosShiftProvider`
- `features/pos/hooks/use-pos-catalog.ts` → `PosCatalogProvider`
- `features/pos/hooks/use-pos-queries.ts` → `PosCustomerProvider`
- `features/pos/components/pos-modals.tsx` (consumer to update)
- `features/pos/components/pos-v1-layout.tsx` (consumer to update)
- `features/posv2/components/pos-v2-layout.tsx` (consumer to update)
- ADR-0008 (sale mode adapter — cart provider delegates to active adapter)
- ADR-0006 (feature module co-location — sub-contexts live in `features/pos/`)
