import { buildKitchenTicketDocument } from "@/features/restaurants/printing/kitchen-ticket-documents";

export interface KitchenTicketPrintItem {
  modifiers: { name: string; quantity: number; unitPrice: number }[];
  notes: string | null;
  operation?: "cancel" | "prepare";
  productName: string;
  quantity: number;
  totalAmount?: number;
}

export interface KitchenTicketPrintPayload {
  createdAt: number;
  id: string;
  items: KitchenTicketPrintItem[];
  kind?: "correction" | "initial";
  orderNumber: number;
  sequenceNumber: number;
  table: { name: string; areaName: string };
}

export async function printKitchenTicket(
  ticket: KitchenTicketPrintPayload,
  activeOrganizationId: string | null
) {
  const document = buildKitchenTicketDocument({
    ticketId: ticket.id,
    orderNumber: ticket.orderNumber,
    kind: ticket.kind,
    sequenceNumber: ticket.sequenceNumber,
    createdAt: ticket.createdAt,
    tableName: ticket.table.name,
    areaName: ticket.table.areaName,
    items: ticket.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      operation: item.operation,
      notes: item.notes,
      modifiers: item.modifiers.map((m) => ({
        name: m.name,
        quantity: m.quantity,
        unitPrice: m.unitPrice,
      })),
      totalAmount: item.totalAmount,
    })),
  });
  const { printThermalReceipt } = await import(
    "@/features/pos/printing/print-thermal-receipt.client"
  );
  await printThermalReceipt(document, activeOrganizationId);
}
