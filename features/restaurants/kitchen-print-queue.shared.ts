/**
 * Lógica pura del relay de impresión de comandas en la caja activa.
 *
 * Sin dependencias de React ni de Zero: el watcher de la caja
 * (`use-caja-print-queue.client.ts`) y la bandeja "Pedidos → Salón"
 * (`salon-orders-inbox.tsx`) comparten estas reglas, y así queda cubierta por
 * tests sin necesidad de navegador ni de base de datos.
 */

/**
 * TTL del claim. Debe coincidir con `PRINT_CLAIM_TTL_MS` de
 * `features/restaurants/restaurant-print-operations.server.ts`.
 */
export const PRINT_CLAIM_TTL_MS = 2 * 60 * 1000;

export const CLAIM_CONFIRMATION_TIMEOUT_MS = 5000;
export const CLAIM_CONFIRMATION_POLL_MS = 200;

/** Enfriamiento antes de volver a intentar la misma comanda. */
export const PRINT_RETRY_COOLDOWN_MS = 30 * 1000;

export interface KitchenPrintRow {
  id: string;
  printClaimedAt?: number | null;
  printClaimedBy?: string | null;
  printStatus?: string | null;
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Una comanda es intentable si está `pending`, o si quedó `printing` con un
 * claim más viejo que el TTL (caja que se colgó, pestaña cerrada, crash).
 *
 * `printClaimedAt` nulo se trata como claim huérfano inmediatamente
 * reclamable: el servidor no puede distinguir ese caso, así que el cliente
 * tampoco debe dejar la comanda bloqueada para siempre.
 */
export function isKitchenPrintAttemptable(
  ticket: KitchenPrintRow,
  lastAttemptAt: number | undefined,
  now: number
) {
  if (
    lastAttemptAt !== undefined &&
    now - lastAttemptAt < PRINT_RETRY_COOLDOWN_MS
  ) {
    return false;
  }

  if (ticket.printStatus === "pending") {
    return true;
  }

  if (ticket.printStatus !== "printing") {
    return false;
  }

  if (typeof ticket.printClaimedAt !== "number") {
    return true;
  }

  return now - ticket.printClaimedAt > PRINT_CLAIM_TTL_MS;
}

/**
 * Confirma un claim leyendo la fila replicada: Zero no devuelve el resultado de
 * los mutadores, así que la única prueba de propiedad es ver
 * `printStatus='printing'` con **nuestro** token.
 *
 * `getCurrentRows` debe leer el estado **vivo** (un ref actualizado por un
 * efecto, nunca el array capturado en el closure del render): si se pasa un
 * snapshot congelado, la confirmación nunca llega y la comanda no se imprime.
 *
 * Devuelve `false` en cuanto la fila muestra que otro actor ganó
 * (`printClaimedBy` ajeno, `printed`, `skipped`, `failed`) o desaparece del
 * resultado, y también al agotar el timeout.
 */
export async function waitForClaimConfirmation(params: {
  claimToken: string;
  getCurrentRows: () => readonly KitchenPrintRow[];
  ticketId: string;
  now?: () => number;
  pollMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
}) {
  const {
    claimToken,
    getCurrentRows,
    ticketId,
    now = Date.now,
    pollMs = CLAIM_CONFIRMATION_POLL_MS,
    sleep: wait = sleep,
    timeoutMs = CLAIM_CONFIRMATION_TIMEOUT_MS,
  } = params;
  const deadline = now() + timeoutMs;

  while (now() < deadline) {
    const currentRow = getCurrentRows().find((row) => row.id === ticketId);
    if (!currentRow) {
      return false;
    }
    if (
      currentRow.printStatus === "printing" &&
      currentRow.printClaimedBy === claimToken
    ) {
      return true;
    }
    if (
      currentRow.printStatus === "printed" ||
      currentRow.printStatus === "skipped" ||
      currentRow.printStatus === "failed" ||
      (currentRow.printClaimedBy != null &&
        currentRow.printClaimedBy !== claimToken)
    ) {
      return false;
    }
    await wait(pollMs);
  }

  return false;
}
