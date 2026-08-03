import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { UtensilsCrossed, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { isOrganizationManagerRole } from "@/features/organization/access-control.shared";
import type {
  PosTableSessionState,
  SaleModeExitOptions,
} from "@/features/pos/sale-modes/types";
import { RestaurantFloorView } from "@/features/restaurants/components/restaurant-floor-view";
import { useRestaurantBootstrap } from "@/features/restaurants/hooks/use-restaurants";
import { cn } from "@/lib/utils";

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
  tableSession,
}: {
  activeTableId: string | null;
  onClose: () => void;
  onSelectTable: (
    tableId: string,
    options?: SaleModeExitOptions
  ) => Promise<boolean>;
  tableSession: PosTableSessionState | null;
}) {
  const pageContext = usePageContext();
  const canManageLayout = isOrganizationManagerRole(
    pageContext.zeroContext?.role
  );
  const bootstrapQuery = useRestaurantBootstrap();
  const bootstrap = bootstrapQuery.data;
  const panelRef = useRef<HTMLDivElement>(null);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [isSwitchingTable, setIsSwitchingTable] = useState(false);
  const [pendingTableId, setPendingTableId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

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

  const closeDiscardConfirmModal = () => {
    if (isSwitchingTable) {
      return;
    }
    setPendingTableId(null);
    setSelectionError(null);
    setIsDiscardConfirmOpen(false);
  };

  const selectTable = async (
    tableId: string,
    options?: SaleModeExitOptions
  ) => {
    setSelectionError(null);
    setIsSwitchingTable(true);
    try {
      const didSelect = await onSelectTable(tableId, options);
      if (!didSelect && options?.discardPendingKitchenChanges) {
        setSelectionError(
          "No se pudieron descartar los cambios. Inténtalo de nuevo."
        );
      }
      return didSelect;
    } catch (error) {
      setSelectionError(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar de mesa. Inténtalo de nuevo."
      );
      return false;
    } finally {
      setIsSwitchingTable(false);
    }
  };

  const handleSelectTable = async (tableId: string) => {
    if (isSwitchingTable || tableSession?.isDiscardingChanges) {
      return;
    }
    if (tableId === activeTableId) {
      onClose();
      return;
    }
    if (tableSession?.hasPendingKitchenChanges) {
      setPendingTableId(tableId);
      setSelectionError(null);
      setIsDiscardConfirmOpen(true);
      return;
    }

    if (await selectTable(tableId)) {
      onClose();
    }
  };

  const confirmDiscardAndSelectTable = async () => {
    if (!pendingTableId || isSwitchingTable) {
      return;
    }

    if (
      await selectTable(pendingTableId, {
        discardPendingKitchenChanges: true,
      })
    ) {
      closeDiscardConfirmModal();
      onClose();
    }
  };

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
      className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-[var(--color-void)] text-[var(--color-photon)] outline-none transition-transform duration-300 ease-out motion-reduce:transition-none"
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

      <Modal
        centered
        onClose={closeDiscardConfirmModal}
        opened={isDiscardConfirmOpen}
        title="Descartar cambios sin enviar"
      >
        <Stack gap="md">
          <Text c="dimmed" size="sm">
            Hay cambios sin enviar en {tableSession?.tableName ?? "la mesa"}.
            ¿Deseas descartarlos antes de cambiar de mesa?
          </Text>
          <div className="rounded-md bg-gray-0 p-3 dark:bg-dark-6">
            <Text fw={600} size="sm">
              Cambios pendientes
            </Text>
            <Text c="dimmed" size="sm">
              Altas en borrador:{" "}
              {tableSession?.pendingKitchenPreparationCount ?? 0}
            </Text>
            <Text c="dimmed" size="sm">
              Cambios de cantidad o nota:{" "}
              {tableSession?.pendingKitchenModificationCount ?? 0}
            </Text>
            <Text c="dimmed" size="sm">
              Cancelaciones:{" "}
              {tableSession?.pendingKitchenCancellationCount ?? 0}
            </Text>
          </div>
          {selectionError ? (
            <Text c="red" size="sm">
              {selectionError}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button
              disabled={isSwitchingTable}
              onClick={closeDiscardConfirmModal}
              type="button"
              variant="default"
            >
              Cancelar
            </Button>
            <Button
              color="red"
              loading={isSwitchingTable}
              onClick={confirmDiscardAndSelectTable}
              type="button"
            >
              Descartar y cambiar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

/**
 * Floating "Mesas" launcher + floor-plan overlay for the POS product zone.
 * Selecting a table hands it off to the POS table session (the table's open
 * order becomes the POS cart) and closes the overlay. Accessibility is
 * enforced by the module registry — this component is only mounted when the
 * restaurants module is accessible.
 * Mount inside a `relative` container that wraps the product catalog so the
 * overlay covers only that zone.
 */
export function RestaurantPosTables({
  activeTableId,
  isOpen,
  onOpenChange,
  onSelectTable,
  tableSession,
}: {
  activeTableId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTable: (
    tableId: string,
    options?: SaleModeExitOptions
  ) => Promise<boolean>;
  tableSession: PosTableSessionState | null;
}) {
  return (
    <>
      {/* Sliding panel: mounted always so the slide-down exit transition can
          run. When closed it's pushed below the catalog zone, hidden via
          pointer-events-none and opacity, ready to slide up on open. */}
      <div
        className={cn(
          "absolute inset-0 z-30 transition-all duration-300 ease-out motion-reduce:transition-none",
          isOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        )}
      >
        <RestaurantPosTablesPanel
          activeTableId={activeTableId}
          onClose={() => onOpenChange(false)}
          onSelectTable={onSelectTable}
          tableSession={tableSession}
        />
      </div>

      {/*Floating launcher — hidden while the overlay is open. */}
      {isOpen ? null : (
        <div className="absolute bottom-4 left-4 z-20">
          <Button
            className="h-12 rounded-full bg-[var(--color-voltage)]! px-5 font-semibold text-black! shadow-lg hover:bg-[#d9f15c]"
            leftSection={
              <UtensilsCrossed aria-hidden="true" className="size-5" />
            }
            onClick={() => onOpenChange(true)}
            type="button"
          >
            Mesas
          </Button>
        </div>
      )}
    </>
  );
}
