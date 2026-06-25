import { ActionIcon, Alert, Badge, Button } from "@mantine/core";
import { UtensilsCrossed, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useModuleCapabilities } from "@/features/modules/hooks/use-module-capabilities";
import { isOrganizationManagerRole } from "@/features/organization/access-control.shared";
import { RestaurantFloorView } from "@/features/restaurants/components/restaurant-floor-view";
import { useRestaurantBootstrap } from "@/features/restaurants/hooks/use-restaurants";

function isEditableEventTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

function RestaurantPosTablesPanel({
  activeTableId,
  onClose,
  onSelectTable,
}: {
  activeTableId: string | null;
  onClose: () => void;
  onSelectTable: (tableId: string) => void;
}) {
  const pageContext = usePageContext();
  const canManageLayout = isOrganizationManagerRole(
    pageContext.zeroContext?.role
  );
  const bootstrapQuery = useRestaurantBootstrap();
  const bootstrap = bootstrapQuery.data;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Steal focus from the (now covered) catalog search input so barcode and
    // keyboard input stop landing underneath the overlay.
    const frameId = window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      if (isEditableEventTarget(event.target)) {
        return;
      }
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSelectTable = useCallback(
    (tableId: string) => {
      onSelectTable(tableId);
      onClose();
    },
    [onSelectTable, onClose]
  );

  let content: ReactNode = null;
  if (bootstrap) {
    content = (
      <RestaurantFloorView
        bootstrap={bootstrap}
        canManageLayout={canManageLayout}
        kitchenEnabled={bootstrap.settings.restaurant.kitchen.displayEnabled}
        onSelectTable={handleSelectTable}
        selectedTableId={activeTableId}
      />
    );
  } else if (!bootstrapQuery.isError) {
    content = (
      <div className="flex flex-1 flex-col items-center justify-center text-zinc-500">
        <UtensilsCrossed aria-hidden="true" className="mb-3 size-8" />
        <p className="text-sm">Cargando mesas…</p>
      </div>
    );
  }

  return (
    <div
      aria-label="Mesas del restaurante"
      aria-modal="true"
      className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-[var(--color-void)] text-[var(--color-photon)] outline-none"
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-zinc-800 border-b px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <UtensilsCrossed
            aria-hidden="true"
            className="size-5 shrink-0 text-[var(--color-voltage)]"
          />
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-lg tracking-tight">
              Mesas
            </h2>
            <p className="truncate text-xs text-zinc-400">
              Selecciona una mesa para atenderla desde el POS.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {bootstrap?.activeShift ? (
            <Badge
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              tt="none"
              variant="outline"
            >
              Caja abierta
            </Badge>
          ) : (
            <Badge
              className="border-amber-400/30 bg-amber-400/10 text-amber-100"
              tt="none"
              variant="outline"
            >
              Sin caja activa
            </Badge>
          )}
          <ActionIcon
            aria-label="Cerrar mesas"
            color="gray"
            onClick={onClose}
            size="lg"
            type="button"
            variant="outline"
          >
            <X aria-hidden="true" className="size-4" />
          </ActionIcon>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        {bootstrapQuery.isError ? (
          <Alert
            className="mb-4"
            color="red"
            title="Acceso denegado"
            variant="light"
          >
            {bootstrapQuery.error instanceof Error
              ? bootstrapQuery.error.message
              : "No tienes acceso al módulo de restaurantes."}
          </Alert>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">{content}</div>
      </div>
    </div>
  );
}

/**
 * Floating "Mesas" launcher + floor-plan overlay for the POS product zone.
 * Selecting a table hands it off to the POS table session (the table's open
 * order becomes the POS cart) and closes the overlay. Renders nothing when
 * the restaurants module is not accessible for the active organization.
 * Mount inside a `relative` container that wraps the product catalog so the
 * overlay covers only that zone.
 */
export function RestaurantPosTables({
  activeTableId,
  isOpen,
  onOpenChange,
  onSelectTable,
}: {
  activeTableId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTable: (tableId: string) => void;
}) {
  const { data: capabilities } = useModuleCapabilities();
  const isAccessible = capabilities?.modules.restaurants.accessible ?? false;

  if (!isAccessible) {
    return null;
  }

  if (isOpen) {
    return (
      <RestaurantPosTablesPanel
        activeTableId={activeTableId}
        onClose={() => onOpenChange(false)}
        onSelectTable={onSelectTable}
      />
    );
  }

  // Positioned relative to the POS catalog (its `relative` wrapper), so it
  // floats over the product zone instead of the app chrome. The absolute
  // positioning lives on this div, not on the Mantine Button, because the
  // Button's own root styles override `position`.
  return (
    <div className="absolute bottom-4 left-4 z-20">
      <Button
        className="h-12 rounded-full bg-[var(--color-voltage)] px-5 font-semibold text-black shadow-lg hover:bg-[#d9f15c]"
        leftSection={<UtensilsCrossed aria-hidden="true" className="size-5" />}
        onClick={() => onOpenChange(true)}
        type="button"
      >
        Mesas
      </Button>
    </div>
  );
}
