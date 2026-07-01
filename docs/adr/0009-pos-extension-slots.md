# ADR 0009: POS Extension Slots

## Status

Implemented

## Date

2026-06-29

## Context

Both POS layouts (`pos-v1-layout.tsx`, `pos-v2-layout.tsx`) directly import and render `RestaurantPosTables` from the restaurants module. `pos-modals.tsx` hardcodes every modal component. Adding a new module that needs POS presence (e.g., a delivery module with an order overlay, a hotel module with a room selector) requires editing these core POS files:

- `pos-v1-layout.tsx` — add import, add `<NewModuleOverlay />` in the catalog zone
- `pos-v2-layout.tsx` — same changes duplicated
- `pos-modals.tsx` — add `<NewModuleModal />` in the modal list
- `pos-page-modals.shared.ts` — add `"new-module-modal"` to the `PosActiveModal` union

This means every new module creates merge conflicts in the same 4 files and couples the POS core to module internals.

## Decision

Define **extension slots** in the POS layout that modules fill through a registry, instead of hardcoded imports.

### Slot types

```typescript
type PosExtensionSlot = "catalog-overlay" | "header-action" | "modal";

interface PosExtension {
  slot: PosExtensionSlot;
  id: string;
  Component: ComponentType<PosExtensionRenderProps>;
}

interface PosExtensionRenderProps {
  activeModal: string | null;
  onOpenModal: (id: string) => void;
  onCloseModal: () => void;
  // Sale mode context (which mode is active, table session, etc.)
  saleMode: SaleModeInfo | null;
}
```

### Module registration

Modules declare their POS extensions in their module definition:

```typescript
// features/restaurants/restaurants.module.ts
export const restaurantModuleDefinition = defineModule({
  // ...existing fields...
  getPosExtensions: ({ accessible }) =>
    accessible
      ? [
          {
            slot: "catalog-overlay",
            id: RESTAURANT_POS_EXTENSION_IDS.TABLES,
            Component: RestaurantTablesPosExtension,
          },
        ]
      : [],
});
```

The extension component is a `ComponentType<PosExtensionRenderProps>`, not a raw render callback. This lets extension components use hooks safely and keeps the registry as metadata plus component references.

### POS layout rendering

The POS layouts iterate registered extensions instead of importing module components:

```typescript
// features/pos/components/pos-v1-layout.tsx
const extensions = usePosExtensions(moduleCapabilities.data?.modules);

return (
  <div className="relative flex ...">
    <ProductGrid ... />
    {catalogOverlayExtensions.map(({ Component, id }) => (
      <Component key={id} {...extensionRenderProps} />
    ))}
  </div>
);
```

### Modal system

`PosActiveModal` becomes `string` (open union) instead of a closed discriminated union. Each extension manages its own modal content via its `Component`. The `pos-modals.tsx` component iterates `extensions.filter(ext => ext.slot === "modal")` instead of listing hardcoded modals.

Any open `activeModal` blocks catalog focus and barcode scanning by default. `isPosOverlayBlockingCatalog` now simply checks `isAnyPosModalOpen(activeModal)`. If a later module needs a non-blocking surface, explicit metadata can be added in a separate change.

Built-in POS modals (checkout, shift, customer) remain in the POS feature — they are not module extensions. They use the same `activeModal: string` system.

## Consequences

- **Zero edits to layout files per module.** A new module registers its overlay/modal and it appears automatically.
- **No duplicate work between v1 and v2 layouts.** Both iterate the same extension registry.
- **`PosActiveModal` is an open string.** Modules add their own modal IDs without editing a shared type.
- **Extensions are lazy.** If a module is disabled, its extensions don't register. No null checks needed.
- **Built-in POS features stay in the POS feature.** Checkout, shift, and customer modals are core POS, not module extensions.

## Implementation Notes

- Create `usePosExtensions()` hook that reads from the module registry and collects `getPosExtensions()` from all enabled modules.
- Migrate `RestaurantPosTables` from a direct import to a registered extension.
- Migrate `pos-modals.tsx` to iterate extensions for module modals, while keeping built-in modals as direct renders.
- `isPosOverlayBlockingCatalog` in `pos-page-modals.shared.ts` should check if any extension modal is open, not hardcode each modal type.

## Related Files

- `features/pos/components/pos-v1-layout.tsx` (hardcoded RestaurantPosTables import)
- `features/posv2/components/pos-v2-layout.tsx` (same hardcoded import)
- `features/pos/components/pos-modals.tsx` (hardcoded modal list)
- `features/pos/pos-page-modals.shared.ts` (closed PosActiveModal union)
- `features/restaurants/components/restaurant-pos-overlay.tsx` (component to register as extension)
- `features/modules/module-definition.ts` (interface to extend with `getPosExtensions`)
- `features/modules/module-registry.ts` (registry to collect extensions)
- ADR-0004 (module interface beyond navigation)
