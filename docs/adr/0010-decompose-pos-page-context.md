# ADR 0010: Decompose POS Page Context

## Status

Proposed

## Date

2026-06-29

## Context

`PosPageProvider` in `pos-page-context.tsx` is a 927-line god component. It manages:

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

Decompose the god context into **focused sub-contexts** that compose inside a thin shell provider.

### Sub-contexts

```
PosPageProvider (thin shell — owns modal state + variant)
├── PosCatalogProvider    — categories, products, search, pagination, favorites, modifiers
├── PosCartProvider       — cart items, discount, totals (delegates to active SaleModeAdapter)
├── PosCheckoutProvider   — payments, credit sale, cash change, finalization
├── PosShiftProvider      — active shift, open/close/movement handlers
└── PosCustomerProvider   — customer selection, credit accounts, create modal
```

Each sub-context exposes its own `useXxxContext()` hook. Components consume only what they need:

```typescript
// A product grid only needs catalog
const { products, categories, searchQuery } = usePosCatalog();

// The cart panel needs cart + checkout
const { cart, totals, updateQuantity } = usePosCart();
const { canFinalizeSale, finalizeSale } = usePosCheckout();

// The header needs shift + customer
const { activeShift } = usePosShift();
const { selectedCustomerId, setSelectedCustomerId } = usePosCustomer();
```

### Composition

```typescript
export function PosPageProvider({ children, variant }) {
  return (
    <PosModalProvider>
      <PosCatalogProvider>
        <PosShiftProvider>
          <PosCustomerProvider>
            <PosCartProvider>
              <PosCheckoutProvider>
                {children}
              </PosCheckoutProvider>
            </PosCartProvider>
          </PosCustomerProvider>
        </PosShiftProvider>
      </PosCatalogProvider>
    </PosModalProvider>
  );
}
```

### What stays shared

- **Modal state** (`PosModalProvider`) — owned by the shell because modals are opened from multiple contexts (checkout from cart, shift from header, customer from checkout).
- **Sale mode adapter** — owned by `PosCartProvider` since it determines cart behavior. `PosCheckoutProvider` reads the active mode from cart context to know which finalize path to use.
- **Receipt printing** — stays in `PosCheckoutProvider` as a shared concern.

### Migration path

1. Extract `PosCatalogProvider` (catalog queries + search + favorites). ~150 lines.
2. Extract `PosShiftProvider` (shift state + handlers). ~120 lines.
3. Extract `PosCustomerProvider` (customer selection + credit accounts). ~80 lines.
4. Extract `PosCartProvider` (cart + mode adapter from ADR-0008). ~100 lines.
5. Extract `PosCheckoutProvider` (payments + finalization). ~150 lines.
6. `PosPageProvider` becomes ~50 lines: composition + modal state.
7. Update all `usePosPage()` consumers to use the specific sub-context hook.

## Consequences

- **Each sub-context is independently testable.** Cart logic can be tested without mocking catalog queries.
- **Re-render scope shrinks.** A product search change doesn't re-render the checkout modal.
- **New features target the right sub-context.** A loyalty program adds to `PosCheckoutProvider`, not the god provider.
- **The `usePosPage()` hook can remain as a convenience** that composes all sub-contexts, for components that truly need everything (e.g., `PosModals`).
- **Dependency arrays become manageable.** Each sub-context has 5-10 dependencies instead of 60+.

## Implementation Notes

- Extract in order: catalog → shift → customer → cart → checkout. Each extraction is independently shippable.
- Keep `usePosPage()` as a compatibility layer during migration: it calls all sub-hooks and returns the same `{ state, actions, meta }` shape. Components migrate one at a time.
- The `meta` object (organization ID, terminal name, payment method options) moves to the sub-context that owns each field.
- `PosPageVariant` stays in the shell provider — it determines which layout to render, not sub-context behavior.

## Related Files

- `features/pos/pos-page-context.tsx` (927-line god provider to decompose)
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
