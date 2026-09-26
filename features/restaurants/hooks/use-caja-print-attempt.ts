import { useCallback, useEffect, useRef } from "react";
import {
  useClaimKitchenTicketPrintMutation,
  useFailKitchenTicketPrintMutation,
  useMarkKitchenTicketPrintedMutation,
} from "@/features/restaurants/hooks/use-restaurants";
import {
  type KitchenPrintRow,
  waitForClaimConfirmation,
} from "@/features/restaurants/kitchen-print-queue.shared";
import { printKitchenTicketAtCaja } from "@/features/restaurants/printing/print-kitchen-ticket";
import {
  mapRestaurantKitchenTicket,
  type RestaurantKitchenTicketRow,
} from "@/features/restaurants/restaurants.shared";
import { buildKitchenTicketPrintPayload } from "@/features/restaurants/waiter-order.shared";

export type CajaPrintAttemptOutcome =
  | { status: "failed"; message: string }
  | { status: "printed" }
  | { status: "skipped" };

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function buildTicketPayload(ticketRow: RestaurantKitchenTicketRow) {
  const mappedTicket = mapRestaurantKitchenTicket(ticketRow);
  const orderRow = ticketRow.order ?? null;

  return buildKitchenTicketPrintPayload({
    orderNumber: orderRow?.orderNumber ?? 0,
    table: {
      name: orderRow?.table?.name ?? "",
      areaName: orderRow?.table?.area?.name ?? "",
    },
    ticket: mappedTicket,
  });
}

type AttemptPrint = (
  ticketRow: RestaurantKitchenTicketRow,
  getCurrentRows: () => readonly KitchenPrintRow[]
) => Promise<CajaPrintAttemptOutcome>;

/**
 * Intento de impresión de una comanda encolada para la caja: claim con token,
 * confirmación por fila replicada (Zero no devuelve resultados de mutadores),
 * impresión sin fallback a PDF y ack (`printed`) o `failed`.
 *
 * Compartido por el watcher de la caja y la bandeja "Pedidos → Salón".
 */
export function useCajaPrintAttempt(params: {
  activeOrganizationId: string | null;
}) {
  const { activeOrganizationId } = params;
  const claimMutation = useClaimKitchenTicketPrintMutation();
  const markPrintedMutation = useMarkKitchenTicketPrintedMutation();
  const failMutation = useFailKitchenTicketPrintMutation();

  // `useMutation` de TanStack devuelve un objeto nuevo en cada render. Sin
  // guardar la implementación en un ref, `attemptPrint` cambiaría de
  // identidad en cada render y el watcher de la cola se reiniciaría a mitad
  // del procesamiento, dejando comandas sin intentar.
  const attemptPrintRef = useRef<AttemptPrint | null>(null);

  useEffect(() => {
    const attemptPrint: AttemptPrint = async (
      ticketRow,
      getCurrentRows
    ): Promise<CajaPrintAttemptOutcome> => {
      const claimToken = crypto.randomUUID();

      // `accepted` solo significa "el servidor no rechazó el mutador"; el
      // claim real se confirma leyendo la fila replicada con este token.
      let serverAccepted = false;
      try {
        const claimResult = await claimMutation.mutateAsync({
          ticketId: ticketRow.id,
          claimToken,
        });
        serverAccepted = claimResult.serverAccepted;
      } catch {
        serverAccepted = false;
      }
      if (!serverAccepted) {
        return { status: "skipped" };
      }

      const claimConfirmed = await waitForClaimConfirmation({
        claimToken,
        getCurrentRows,
        ticketId: ticketRow.id,
      });
      if (!claimConfirmed) {
        return { status: "skipped" };
      }

      try {
        await printKitchenTicketAtCaja(
          buildTicketPayload(ticketRow),
          activeOrganizationId
        );
      } catch (error) {
        await failMutation
          .mutateAsync({ ticketId: ticketRow.id, claimToken })
          .catch(() => undefined);
        return {
          status: "failed",
          message: getErrorMessage(
            error,
            "No se pudo imprimir en la impresora de la caja."
          ),
        };
      }

      try {
        await markPrintedMutation.mutateAsync({
          ticketId: ticketRow.id,
          claimToken,
        });
      } catch {
        // La impresión salió; el TTL del claim recupera la fila si el ack no
        // llegó al servidor (se acepta una posible reimpresión antes que
        // perder la comanda).
      }

      return { status: "printed" };
    };

    attemptPrintRef.current = attemptPrint;
  }, [activeOrganizationId, claimMutation, failMutation, markPrintedMutation]);

  const attemptPrint = useCallback<AttemptPrint>(
    (ticketRow, getCurrentRows) => {
      const run = attemptPrintRef.current;
      if (!run) {
        return Promise.resolve<CajaPrintAttemptOutcome>({
          status: "skipped",
        });
      }
      return run(ticketRow, getCurrentRows);
    },
    []
  );

  return { attemptPrint };
}
