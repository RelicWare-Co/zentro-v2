import { and, eq, isNull, lt, or } from "drizzle-orm";
import type { z } from "zod";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
import {
  restaurantKitchenTicket,
  restaurantOrder,
} from "@/database/drizzle/schema/restaurant.schema";
import {
  normalizeOptionalString,
  type RestaurantAuth,
  type RestaurantDbExecutor,
  requireRestaurantModuleAccess,
} from "@/features/restaurants/restaurant-operations.server";
import type {
  AcknowledgeKitchenTicketPrintInputSchema,
  ClaimKitchenTicketPrintInputSchema,
  FailKitchenTicketPrintInputSchema,
  MarkKitchenTicketPrintedInputSchema,
  RequeueKitchenTicketPrintInputSchema,
} from "@/features/restaurants/restaurants.schema";
import { getRestaurantModuleSettings } from "@/features/restaurants/restaurants-settings.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";

const PRINT_CLAIM_TTL_MS = 2 * 60 * 1000;

function getClaimCutoff(now: Date) {
  return new Date(now.getTime() - PRINT_CLAIM_TTL_MS);
}

async function loadTicketForPrintClaim(
  db: RestaurantDbExecutor,
  organizationId: string,
  ticketId: string
) {
  const [row] = await db
    .select({
      id: restaurantKitchenTicket.id,
      orderStatus: restaurantOrder.status,
      printClaimedAt: restaurantKitchenTicket.printClaimedAt,
      printStatus: restaurantKitchenTicket.printStatus,
      ticketStatus: restaurantKitchenTicket.status,
    })
    .from(restaurantKitchenTicket)
    .innerJoin(
      restaurantOrder,
      eq(restaurantKitchenTicket.orderId, restaurantOrder.id)
    )
    .where(
      and(
        eq(restaurantKitchenTicket.organizationId, organizationId),
        eq(restaurantKitchenTicket.id, ticketId)
      )
    )
    .for("update")
    .limit(1);

  return row ?? null;
}

/**
 * Un claim es reclamable si está `pending`, o si quedó `printing` con un claim
 * más viejo que el TTL (caja que se colgó, pestaña cerrada, crash).
 *
 * `printClaimedAt` nulo también es reclamable: en SQL `print_claimed_at < x`
 * evalúa a `NULL` (no `true`) cuando la columna es nula, así que sin esta
 * comprobación explícita esa comanda quedaría en `printing` para siempre, sin
 * que el watcher pueda reclamarla ni la bandeja cerrarla.
 */
function isClaimablePrintStatus(
  printStatus: string | null,
  printClaimedAt: Date | null,
  now: Date
) {
  if (printStatus === "pending") {
    return true;
  }

  if (printStatus !== "printing") {
    return false;
  }

  if (!printClaimedAt) {
    return true;
  }

  return printClaimedAt.getTime() < getClaimCutoff(now).getTime();
}

/**
 * Reclama una comanda encolada para la caja. El token identifica a la caja
 * ganadora: Zero no devuelve resultados de mutadores, así que el cliente
 * confirma el claim leyendo la fila replicada (`printStatus='printing'` +
 * `printClaimedBy === claimToken`).
 *
 * No lanza por contención: si otra caja ganó o la orden ya no está abierta,
 * la fila queda en su estado actual (o `skipped`) y el cliente no imprime.
 */
export async function runClaimKitchenTicketPrint(
  db: RestaurantDbExecutor,
  args: z.infer<typeof ClaimKitchenTicketPrintInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });
  const organizationId = auth.organizationId;

  const [orgRow] = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  const settings = getRestaurantModuleSettings(
    parseOrganizationSettingsMetadata(orgRow?.metadata)
  );
  if (!settings.kitchen.printTicketsEnabled) {
    throw new Error("La impresión de comandas está deshabilitada.");
  }

  const [openShift] = await db
    .select({ id: shift.id, terminalName: shift.terminalName })
    .from(shift)
    .where(
      and(
        eq(shift.organizationId, organizationId),
        eq(shift.userId, auth.userId),
        eq(shift.status, "open")
      )
    )
    .limit(1);
  if (!openShift) {
    throw new Error("Necesitas un turno abierto para imprimir comandas.");
  }

  const ticket = await loadTicketForPrintClaim(
    db,
    organizationId,
    args.ticketId
  );
  if (!ticket) {
    throw new Error("La comanda no existe en la organización activa.");
  }

  const now = new Date();
  const isOrderActive = ticket.orderStatus === "open";
  const isTicketActive = !(
    ticket.ticketStatus === "served" || ticket.ticketStatus === "cancelled"
  );
  if (!(isOrderActive && isTicketActive)) {
    await db
      .update(restaurantKitchenTicket)
      .set({
        printStatus: "skipped",
        printClaimedBy: null,
        printClaimedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(restaurantKitchenTicket.organizationId, organizationId),
          eq(restaurantKitchenTicket.id, ticket.id),
          or(
            eq(restaurantKitchenTicket.printStatus, "pending"),
            eq(restaurantKitchenTicket.printStatus, "printing")
          )
        )
      );
    return;
  }

  if (!isClaimablePrintStatus(ticket.printStatus, ticket.printClaimedAt, now)) {
    return;
  }

  // El `where` debe reflejar exactamente la misma regla que
  // `isClaimablePrintStatus`, incluido el claim huérfano con
  // `print_claimed_at IS NULL` (`lt` con NULL no es `true` en SQL).
  await db
    .update(restaurantKitchenTicket)
    .set({
      printStatus: "printing",
      printClaimedBy: args.claimToken,
      printClaimedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(restaurantKitchenTicket.organizationId, organizationId),
        eq(restaurantKitchenTicket.id, ticket.id),
        or(
          eq(restaurantKitchenTicket.printStatus, "pending"),
          and(
            eq(restaurantKitchenTicket.printStatus, "printing"),
            or(
              isNull(restaurantKitchenTicket.printClaimedAt),
              lt(restaurantKitchenTicket.printClaimedAt, getClaimCutoff(now))
            )
          )
        )
      )
    );
}

/**
 * `printedByTerminal` es un campo de auditoría: se deriva del turno abierto
 * del usuario en el servidor, nunca del `args` del cliente (que podría
 * escribir cualquier texto). Devuelve `null` si ya no hay turno abierto, en
 * lugar de fallar: la comanda ya se imprimió físicamente y perder ese dato es
 * preferible a reportar un fallo de impresión.
 */
async function resolvePrintingTerminalName(
  db: RestaurantDbExecutor,
  auth: RestaurantAuth
) {
  const [openShift] = await db
    .select({ terminalName: shift.terminalName })
    .from(shift)
    .where(
      and(
        eq(shift.organizationId, auth.organizationId),
        eq(shift.userId, auth.userId),
        eq(shift.status, "open")
      )
    )
    .limit(1);

  return normalizeOptionalString(openShift?.terminalName);
}

export async function runMarkKitchenTicketPrinted(
  db: RestaurantDbExecutor,
  args: z.infer<typeof MarkKitchenTicketPrintedInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });

  const now = new Date();
  const printedByTerminal = await resolvePrintingTerminalName(db, auth);
  const updatedRows = await db
    .update(restaurantKitchenTicket)
    .set({
      printStatus: "printed",
      printedAt: now,
      printedByTerminal,
      updatedAt: now,
    })
    .where(
      and(
        eq(restaurantKitchenTicket.organizationId, auth.organizationId),
        eq(restaurantKitchenTicket.id, args.ticketId),
        eq(restaurantKitchenTicket.printStatus, "printing"),
        eq(restaurantKitchenTicket.printClaimedBy, args.claimToken)
      )
    )
    .returning({ id: restaurantKitchenTicket.id });

  if (updatedRows.length === 0) {
    throw new Error(
      "El claim de impresión ya no es válido; la comanda no se marcó como impresa."
    );
  }
}

export async function runFailKitchenTicketPrint(
  db: RestaurantDbExecutor,
  args: z.infer<typeof FailKitchenTicketPrintInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });

  const now = new Date();
  const updatedRows = await db
    .update(restaurantKitchenTicket)
    .set({
      printStatus: "failed",
      updatedAt: now,
    })
    .where(
      and(
        eq(restaurantKitchenTicket.organizationId, auth.organizationId),
        eq(restaurantKitchenTicket.id, args.ticketId),
        eq(restaurantKitchenTicket.printStatus, "printing"),
        eq(restaurantKitchenTicket.printClaimedBy, args.claimToken)
      )
    )
    .returning({ id: restaurantKitchenTicket.id });

  if (updatedRows.length === 0) {
    throw new Error("El claim de impresión ya no es válido.");
  }
}

export async function runRequeueKitchenTicketPrint(
  db: RestaurantDbExecutor,
  args: z.infer<typeof RequeueKitchenTicketPrintInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });

  const now = new Date();
  const updatedRows = await db
    .update(restaurantKitchenTicket)
    .set({
      printStatus: "pending",
      printClaimedBy: null,
      printClaimedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(restaurantKitchenTicket.organizationId, auth.organizationId),
        eq(restaurantKitchenTicket.id, args.ticketId),
        eq(restaurantKitchenTicket.printStatus, "failed")
      )
    )
    .returning({ id: restaurantKitchenTicket.id });

  if (updatedRows.length === 0) {
    throw new Error("Solo puedes reimprimir una comanda que falló.");
  }
}

export async function runAcknowledgeKitchenTicketPrint(
  db: RestaurantDbExecutor,
  args: z.infer<typeof AcknowledgeKitchenTicketPrintInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });

  const now = new Date();
  const updatedRows = await db
    .update(restaurantKitchenTicket)
    .set({
      printStatus: "skipped",
      printClaimedBy: null,
      printClaimedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(restaurantKitchenTicket.organizationId, auth.organizationId),
        eq(restaurantKitchenTicket.id, args.ticketId),
        or(
          eq(restaurantKitchenTicket.printStatus, "pending"),
          eq(restaurantKitchenTicket.printStatus, "failed")
        )
      )
    )
    .returning({ id: restaurantKitchenTicket.id });

  if (updatedRows.length === 0) {
    throw new Error(
      "Solo puedes atender sin imprimir una comanda pendiente o fallida."
    );
  }
}
