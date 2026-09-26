import { buildKitchenTicketDocument } from "@/features/restaurants/printing/kitchen-ticket-documents";

export interface KitchenTicketPrintItem {
  modifiers: { name: string; quantity: number; unitPrice: number }[];
  notes: string | null;
  operation?: "cancel" | "modify" | "prepare";
  previousModifiers?: { name: string; quantity: number; unitPrice: number }[];
  previousNotes?: string | null;
  previousQuantity?: number | null;
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

const CAJA_PRINT_TIMEOUT_MS = 30_000;

function buildKitchenTicketDocumentFromPayload(
  ticket: KitchenTicketPrintPayload
) {
  return buildKitchenTicketDocument({
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
      previousNotes: item.previousNotes,
      previousQuantity: item.previousQuantity,
      modifiers: item.modifiers.map((m) => ({
        name: m.name,
        quantity: m.quantity,
        unitPrice: m.unitPrice,
      })),
      previousModifiers: item.previousModifiers?.map((modifier) => ({
        name: modifier.name,
        quantity: modifier.quantity,
        unitPrice: modifier.unitPrice,
      })),
      totalAmount: item.totalAmount,
    })),
  });
}

function withTimeout<Value>(
  promise: Promise<Value>,
  timeoutMs: number,
  message: string
) {
  return new Promise<Value>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function printKitchenTicket(
  ticket: KitchenTicketPrintPayload,
  activeOrganizationId: string | null
) {
  const document = buildKitchenTicketDocumentFromPayload(ticket);
  const { printThermalReceipt } = await import(
    "@/features/pos/printing/print-thermal-receipt.client"
  );
  await printThermalReceipt(document, activeOrganizationId);
}

/**
 * Impresión de comanda en la caja activa: sin fallback a PDF (la caja debe
 * imprimir en su impresora térmica configurada) y con timeout para que un QZ
 * colgado no deje el ticket en `printing`.
 *
 * No abre el cajón de dinero: una comanda de cocina no es un cobro, y el
 * watcher de la caja puede imprimir de forma desatendida.
 */
export async function printKitchenTicketAtCaja(
  ticket: KitchenTicketPrintPayload,
  activeOrganizationId: string | null
) {
  const document = buildKitchenTicketDocumentFromPayload(ticket);
  const { getPosPrinterManager } = await import(
    "@/features/pos/printing/printer-manager.client"
  );
  await withTimeout(
    Promise.resolve(
      getPosPrinterManager().printReceipt(document, activeOrganizationId, {
        openCashDrawer: false,
      })
    ),
    CAJA_PRINT_TIMEOUT_MS,
    "La impresora de la caja no respondió a tiempo."
  );
}
