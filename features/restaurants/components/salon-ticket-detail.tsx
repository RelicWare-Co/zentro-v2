import { buildKitchenTicketDocument } from "@/features/restaurants/printing/kitchen-ticket-documents";
import {
  mapRestaurantKitchenTicket,
  type RestaurantKitchenTicketRow,
} from "@/features/restaurants/restaurants.shared";
import { buildKitchenTicketPrintPayload } from "@/features/restaurants/waiter-order.shared";

/**
 * Vista en pantalla de una comanda del salón (sin papel). Reusa el documento
 * térmico para que el cajero vea exactamente lo que se imprimiría.
 */
export function SalonTicketDetail({
  ticket,
}: {
  ticket: RestaurantKitchenTicketRow;
}) {
  const mappedTicket = mapRestaurantKitchenTicket(ticket);
  const orderRow = ticket.order ?? null;
  const payload = buildKitchenTicketPrintPayload({
    orderNumber: orderRow?.orderNumber ?? 0,
    table: {
      name: orderRow?.table?.name ?? "Mesa",
      areaName: orderRow?.table?.area?.name ?? "",
    },
    ticket: mappedTicket,
  });
  const document = buildKitchenTicketDocument({
    ticketId: payload.id,
    orderNumber: payload.orderNumber,
    kind: payload.kind,
    sequenceNumber: payload.sequenceNumber,
    createdAt: payload.createdAt,
    tableName: payload.table.name,
    areaName: payload.table.areaName,
    items: payload.items,
  });

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-zinc-300 bg-white p-4 text-black shadow-lg">
      {document.content}
    </div>
  );
}
