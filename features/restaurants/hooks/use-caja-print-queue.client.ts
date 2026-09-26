import { notifications } from "@mantine/notifications";
import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import {
  isPosLocalPrinterConfigured,
  usePosLocalPrinterSettings,
} from "@/features/pos/printing/printer-settings.local.client";
import { useCajaPrintAttempt } from "@/features/restaurants/hooks/use-caja-print-attempt";
import { usePendingKitchenPrints } from "@/features/restaurants/hooks/use-restaurants";
import { isKitchenPrintAttemptable } from "@/features/restaurants/kitchen-print-queue.shared";
import type { RestaurantKitchenTicketRow } from "@/features/restaurants/restaurants.shared";
import { getRestaurantModuleSettings } from "@/features/restaurants/restaurants-settings.shared";
import { useSalonAlert } from "@/features/restaurants/salon-alert.client";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { useActiveShift } from "@/features/shifts/hooks/use-shifts";
import { queries } from "@/zero/queries";

const QUEUE_TICK_MS = 15 * 1000;

/**
 * Descarta los marcadores de últimas comedidas que ya no están en la cola
 * (impresas, fallidas o atendidas) para que el `Map` no crezca sin límite
 * durante un turno largo de caja.
 */
function pruneStaleAttemptMarkers(
  lastAttemptAt: Map<string, number>,
  queuedRows: readonly RestaurantKitchenTicketRow[]
) {
  const queuedIds = new Set(queuedRows.map((row) => row.id));
  for (const trackedId of lastAttemptAt.keys()) {
    if (!queuedIds.has(trackedId)) {
      lastAttemptAt.delete(trackedId);
    }
  }
}

/**
 * Watcher de la caja: reclama e imprime las comandas encoladas desde el móvil.
 *
 * Gates separados:
 * - suscripción + alerta sonora: turno abierto del usuario;
 * - claim + impresión: además impresora local `device` configurada;
 * - auto-impresión: además `printTicketsEnabled` y `autoPrintOnSend`.
 */
export function useCajaPrintQueue() {
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const activeOrganizationId = zeroContext?.orgID ?? null;

  const activeShift = useActiveShift();
  const shift = activeShift.data.shift;
  const { settings: printerSettings } =
    usePosLocalPrinterSettings(activeOrganizationId);
  const [organizationRows] = useZeroQuery(queries.organization.current());
  const kitchenSettings = useMemo(() => {
    const settings = parseOrganizationSettingsMetadata(
      organizationRows[0]?.metadata
    );
    return getRestaurantModuleSettings(settings).kitchen;
  }, [organizationRows]);

  const pendingPrints = usePendingKitchenPrints();
  const rowsRef = useRef<RestaurantKitchenTicketRow[]>([]);
  const lastAttemptAtRef = useRef(new Map<string, number>());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    rowsRef.current = pendingPrints.data;
  }, [pendingPrints.data]);

  const { attemptPrint } = useCajaPrintAttempt({ activeOrganizationId });

  const hasOpenShift = Boolean(shift);
  const hasPrinter = useMemo(
    () => isPosLocalPrinterConfigured(printerSettings),
    [printerSettings]
  );
  const canAutoPrint =
    Boolean(activeOrganizationId) &&
    hasOpenShift &&
    hasPrinter &&
    kitchenSettings.printTicketsEnabled &&
    kitchenSettings.autoPrintOnSend;

  useSalonAlert({
    activeOrganizationId,
    enabled: hasOpenShift,
    tickets: pendingPrints.data,
  });

  useEffect(() => {
    if (!canAutoPrint) {
      return;
    }

    const timer = setInterval(() => {
      setTick((currentTick) => currentTick + 1);
    }, QUEUE_TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [canAutoPrint]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` re-runs the queue to retry orphaned claims (TTL) and slow claim confirmations; `pendingPrints.data` is the candidate source.
  useEffect(() => {
    if (!canAutoPrint) {
      return;
    }

    let cancelled = false;
    pruneStaleAttemptMarkers(lastAttemptAtRef.current, pendingPrints.data);

    const candidates = pendingPrints.data.filter((ticketRow) =>
      isKitchenPrintAttemptable(
        ticketRow,
        lastAttemptAtRef.current.get(ticketRow.id),
        Date.now()
      )
    );

    const run = async () => {
      for (const ticketRow of candidates) {
        if (cancelled) {
          return;
        }
        if (
          !isKitchenPrintAttemptable(
            ticketRow,
            lastAttemptAtRef.current.get(ticketRow.id),
            Date.now()
          )
        ) {
          continue;
        }
        lastAttemptAtRef.current.set(ticketRow.id, Date.now());
        const outcome = await attemptPrint(ticketRow, () => rowsRef.current);
        if (cancelled) {
          return;
        }
        if (outcome.status === "failed") {
          notifications.show({
            color: "red",
            message: outcome.message,
            title: "No se pudo imprimir la comanda",
          });
        }
      }
    };

    run().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [attemptPrint, canAutoPrint, pendingPrints.data, tick]);
}
