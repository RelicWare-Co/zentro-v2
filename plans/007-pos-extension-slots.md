# 007 - Implement POS extension slots

## Status

DONE

## Goal

Implement ADR 0009 so POS modules register catalog overlays, header actions, and modals through the module registry instead of editing core POS layouts.

The first migration target is the restaurants table overlay. After this plan, POS v1 and POS v2 must no longer import `RestaurantPosTables` directly.

## Confirmed decisions

- Use all three slots from day one: `catalog-overlay`, `header-action`, and `modal`.
- Replace the closed `PosActiveModal` discriminated union with an open string modal ID.
- Use constants for core POS modal IDs and restaurant extension modal IDs. Do not leave repeated modal string literals in POS code.
- Model extensions with a React component API, not a raw render callback:

  ```ts
  Component: ComponentType<PosExtensionRenderProps>;
  ```

  This lets extension components use hooks safely and keeps the registry as metadata plus component references.
- Any open `activeModal` blocks catalog focus and barcode scanning by default. If a later module needs a non-blocking surface, add explicit metadata in a separate change.
- Keep `PosPageContext` lean. Layouts and `PosModals` collect extensions with `usePosExtensions(moduleAccess)` and build render props from `usePosPage()`.

## Stop conditions

- Stop if `getPosExtensions` would require importing server-only code or Drizzle/auth modules into browser-safe module definitions.
- Stop if an extension component needs the full `SaleModeAdapter`; update the lightweight sale-mode info type instead of passing the adapter through.
- Stop if the registry approach introduces conditional hook ordering. Extension components may use hooks internally, but hooks must not be called while collecting registry entries.

## Step 1 - Add POS extension types

Create `features/pos/pos-extension.shared.ts`.

Define:

```ts
import type { ComponentType } from "react";
import type { PosTableSessionState } from "@/features/pos/sale-modes/types";

export type PosExtensionSlot = "catalog-overlay" | "header-action" | "modal";

export interface PosExtensionSaleModeInfo {
  enterMode: ((payload: unknown) => void) | null;
  modeId: string;
  sessionState: PosTableSessionState | null;
  tableId: string | null;
}

export interface PosExtensionRenderProps {
  activeModal: string | null;
  onCloseModal: () => void;
  onOpenModal: (id: string) => void;
  saleMode: PosExtensionSaleModeInfo | null;
}

export interface PosExtension {
  Component: ComponentType<PosExtensionRenderProps>;
  id: string;
  slot: PosExtensionSlot;
}
```

Notes:

- `enterMode` intentionally accepts `unknown` to avoid coupling extensions to one sale mode payload shape.
- Do not pass `SaleModeAdapter` into extension props.

## Step 2 - Extend module definitions

Update `features/modules/module-definition.ts`.

Add:

```ts
import type { PosExtension } from "@/features/pos/pos-extension.shared";
```

Add this optional field to `ModuleDefinition`:

```ts
getPosExtensions?(input: {
  accessible: boolean;
  flags: Flags;
}): PosExtension[];
```

The `flags` type should remain the module-specific generic `Flags`, not only `Record<string, boolean>`, so module implementations get typed flags.

## Step 3 - Add `usePosExtensions`

Create `features/modules/hooks/use-pos-extensions.ts`.

Pattern:

- Iterate `MODULE_KEYS` in stable order.
- Read each `ModuleAccessState` from `moduleAccess`.
- Call `getModuleDefinition(moduleKey).getPosExtensions?.({ accessible, flags })`.
- Return a flat `PosExtension[]`.

Important details:

- `ModuleAccessState` already contains `flags`, so use `access?.flags`.
- Use `accessible: access?.accessible ?? false`.
- Do not call extension components or hooks inside this hook. It only collects metadata.
- If TypeScript cannot preserve module-specific flag typing through the registry iteration, narrow pragmatically at the call boundary; do not weaken `ModuleDefinition` itself unless necessary.

## Step 4 - Open modal IDs and constants

Update `features/pos/pos-page-modals.shared.ts`.

Replace `PosActiveModal` with:

```ts
export type PosActiveModal = string;
```

Add core modal constants:

```ts
export const POS_MODAL_IDS = {
  CASH_MOVEMENT: "cash-movement",
  CHECKOUT: "checkout",
  CHECKOUT_DETAILS: "checkout-details",
  CLOSE_SHIFT: "close-shift",
  CREATE_CUSTOMER: "create-customer",
  MODIFIER: "modifier",
  OPEN_SHIFT: "open-shift",
  SHIFT_REQUIRED: "shift-required",
} as const;
```

Add restaurant extension modal constants in a browser-safe restaurant shared file, for example `features/restaurants/restaurants-pos-extension.shared.ts`:

```ts
export const RESTAURANT_POS_EXTENSION_IDS = {
  TABLES: "restaurant-tables",
} as const;
```

Update helpers:

```ts
export function isPosModalOpen(activeModal: string | null, type: string) {
  return activeModal === type;
}

export function isAnyPosModalOpen(activeModal: string | null) {
  return activeModal !== null;
}

export function isPosOverlayBlockingCatalog(
  activeModal: string | null,
  isMobileCartOpen: boolean
) {
  return isMobileCartOpen || isAnyPosModalOpen(activeModal);
}
```

This is an intentional behavior change: every open modal or extension overlay blocks catalog focus and barcode scanning.

## Step 5 - Update POS page context modal usage

Update `features/pos/pos-page-context.tsx`.

Required changes:

- `activeModal` state becomes `useState<string | null>(null)`.
- `openActiveModal` accepts `string`.
- Replace every `setActiveModal({ type: "..." })` with `setActiveModal(POS_MODAL_IDS.X)`.
- Replace every core `isPosModalOpen(activeModal, "...")` call with `POS_MODAL_IDS.X`.
- Keep the existing specific action names (`openCheckout`, `openShiftModal`, etc.) for POS consumers.

Do not add extensions to `PosPageState`.

## Step 6 - Register the restaurant table overlay as an extension

Update `features/restaurants/restaurants.module.ts`.

Add a small extension component near the module definition or in a dedicated browser-safe component file:

```tsx
function RestaurantTablesPosExtension({
  activeModal,
  onCloseModal,
  onOpenModal,
  saleMode,
}: PosExtensionRenderProps) {
  const modalId = RESTAURANT_POS_EXTENSION_IDS.TABLES;

  return (
    <RestaurantPosTables
      activeTableId={saleMode?.tableId ?? null}
      isOpen={activeModal === modalId}
      onOpenChange={(open) => {
        if (open) {
          onOpenModal(modalId);
          return;
        }
        onCloseModal();
      }}
      onSelectTable={(tableId) => saleMode?.enterMode?.(tableId)}
    />
  );
}
```

Then add:

```ts
getPosExtensions: ({ accessible }) =>
  accessible
    ? [
        {
          Component: RestaurantTablesPosExtension,
          id: RESTAURANT_POS_EXTENSION_IDS.TABLES,
          slot: "catalog-overlay",
        },
      ]
    : [],
```

Update `features/restaurants/components/restaurant-pos-overlay.tsx`:

- Remove `useModuleCapabilities()` from `RestaurantPosTables`.
- Remove the accessibility guard.
- Update the component comment so it no longer claims it hides itself when the module is inaccessible. Accessibility is now enforced by registration.

## Step 7 - Add extension render helpers in POS layouts

In `features/pos/components/pos-v1-layout.tsx` and `features/posv2/components/pos-v2-layout.tsx`:

- Remove direct `RestaurantPosTables` imports.
- Remove local `isTablesOverlayOpen` state.
- Use `useModuleCapabilities()` to get `moduleCapabilities.data?.modules`.
- Use `usePosExtensions(moduleCapabilities.data?.modules)`.
- Build a shared `PosExtensionRenderProps` object from `usePosPage()`:

  ```ts
  const extensionRenderProps: PosExtensionRenderProps = {
    activeModal: state.activeModal,
    onCloseModal: actions.closeActiveModal,
    onOpenModal: actions.openActiveModal,
    saleMode: {
      enterMode: actions.enterTableMode,
      modeId: state.tableSession ? "table" : "counter",
      sessionState: state.tableSession,
      tableId: state.tableSession?.tableId ?? null,
    },
  };
  ```

  If `modeId` is already available through context during implementation, use the actual active mode ID instead of inferring it from `tableSession`.
- Render `catalog-overlay` extensions inside the same relative catalog container where `RestaurantPosTables` currently mounts:

  ```tsx
  {catalogOverlayExtensions.map(({ Component, id }) => (
    <Component key={id} {...extensionRenderProps} />
  ))}
  ```

- Update POS v1 search autofocus to use:

  ```ts
  !(
    isMobile ||
    isPosModalOpen(state.activeModal, RESTAURANT_POS_EXTENSION_IDS.TABLES)
  )
  ```

  Or simply rely on the new blocking helper if that fits the existing component contract.
- Update POS v2 barcode enablement to remove `isTablesOverlayOpen`; the simplified `isPosOverlayBlockingCatalog(state.activeModal, state.isMobileCartOpen)` now covers the restaurant overlay.

## Step 8 - Add header action extension rendering

Update `features/pos/components/pos-header.tsx`:

- Add `headerActions?: ReactNode`.
- Render it in the existing action button area after quick-sale and before cash movement. This gives module actions a stable position without pushing shift controls to a surprising place.

Update `features/posv2/components/pos-v2-header.tsx`:

- Add `headerActions?: ReactNode`.
- Render it before the core action icons.

In both POS layouts:

- Filter `header-action` extensions.
- Render them into `headerActions` with the same `extensionRenderProps`.

No module needs to register a header action in this first implementation. The slot should still be wired and verified as empty-safe.

## Step 9 - Render modal extensions

Update `features/pos/components/pos-modals.tsx`.

- Keep built-in POS modals as direct renders.
- Use `useModuleCapabilities()` and `usePosExtensions()` to collect extensions.
- Build `PosExtensionRenderProps` from `usePosPage()`.
- Render `modal` extensions after built-in modals:

  ```tsx
  {modalExtensions.map(({ Component, id }) => (
    <Component key={id} {...extensionRenderProps} />
  ))}
  ```

Currently no module registers a `modal` extension; this verifies the infrastructure is ready without changing user-visible behavior.

## Step 10 - Mechanical modal type cleanup

Update modal consumers as needed after `PosActiveModal` becomes `string`.

Expected files:

- `features/pos/components/modals/cash-movement-modal.tsx`
- `features/pos/components/modals/checkout-modal.tsx`
- `features/pos/components/modals/close-shift-modal.tsx`
- `features/pos/components/modals/create-customer-modal.tsx`
- `features/pos/components/modals/modifier-modal.tsx`
- `features/pos/components/modals/open-shift-modal.tsx`
- `features/pos/components/modals/shift-required-dialog.tsx`
- `features/posv2/components/checkout-details-modal.tsx`

Prefer replacing string literals with `POS_MODAL_IDS` while touching these files.

## Step 11 - Update ADR status after implementation

After code is implemented and verified, update `docs/adr/0009-pos-extension-slots.md`:

- Reflect the component-based API instead of `render(props)`.
- Mention default catalog/barcode blocking for any open modal ID.
- Change status from `Proposed` to `Implemented`.

Do not mark the ADR implemented before both POS variants are migrated and verified.

## Verification

Run:

```sh
bunx tsc --noEmit
bun run check
bun test
```

Manual verification:

- POS v1: "Mesas" appears only when restaurants module is accessible.
- POS v1: opening "Mesas" uses `activeModal === "restaurant-tables"`.
- POS v1: selecting a table enters table mode and closes the overlay.
- POS v1: closing the overlay clears `activeModal`.
- POS v2: same restaurant table overlay behavior.
- POS v2: barcode scanner is disabled while the restaurant table overlay is open.
- Header action and modal slots render nothing safely when no modules register those slots.

## Expected file changes

| File | Action |
| --- | --- |
| `features/pos/pos-extension.shared.ts` | New extension types |
| `features/modules/module-definition.ts` | Add `getPosExtensions?` |
| `features/modules/hooks/use-pos-extensions.ts` | New hook |
| `features/pos/pos-page-modals.shared.ts` | Open modal IDs, constants, simplified blocking |
| `features/pos/pos-page-context.tsx` | Use string modal IDs and constants |
| `features/restaurants/restaurants-pos-extension.shared.ts` | New restaurant extension IDs |
| `features/restaurants/restaurants.module.ts` | Register restaurant table overlay extension |
| `features/restaurants/components/restaurant-pos-overlay.tsx` | Remove internal accessibility check |
| `features/pos/components/pos-v1-layout.tsx` | Render catalog/header extensions |
| `features/posv2/components/pos-v2-layout.tsx` | Render catalog/header extensions |
| `features/pos/components/pos-header.tsx` | Add `headerActions` prop |
| `features/posv2/components/pos-v2-header.tsx` | Add `headerActions` prop |
| `features/pos/components/pos-modals.tsx` | Render modal extensions |
| `docs/adr/0009-pos-extension-slots.md` | Update after implementation |
