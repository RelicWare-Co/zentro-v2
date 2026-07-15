import { ThermalReceipt } from "@/features/pos/components/thermal-receipt";
import type { ThermalReceiptDocument } from "@/features/pos/printing/thermal-receipt-document";
import { getKitchenModificationDetails } from "@/features/restaurants/kitchen-corrections.shared";
import { formatCurrency } from "@/lib/format-currency.shared";

const ticketDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "short",
  timeStyle: "short",
});

interface KitchenTicketDocumentItem {
  modifiers?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string | null;
  operation?: "cancel" | "modify" | "prepare";
  previousModifiers?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  previousNotes?: string | null;
  previousQuantity?: number | null;
  productName: string;
  quantity: number;
  totalAmount?: number;
}

function getKitchenTicketItemLabel(item: KitchenTicketDocumentItem) {
  if (item.operation === "cancel") {
    return `CANCELAR / NO PREPARAR: ${item.productName}`;
  }
  if (item.operation === "modify") {
    return `MODIFICACIÓN: ${item.productName}`;
  }
  return item.productName;
}

export function buildKitchenTicketDocument(input: {
  ticketId: string;
  kind?: "correction" | "initial";
  orderNumber: number;
  sequenceNumber: number;
  createdAt: number | Date;
  tableName: string;
  areaName: string | null;
  items: KitchenTicketDocumentItem[];
}): ThermalReceiptDocument {
  const isCorrection = input.kind === "correction";
  const receipt = {
    title: isCorrection ? "CORRECCIÓN DE COMANDA" : "Comanda de cocina",
    documentLabel: isCorrection
      ? `Comanda #${input.orderNumber} • CORRECCIÓN #${input.sequenceNumber}`
      : `Comanda #${input.orderNumber} • Ticket ${input.sequenceNumber}`,
    issuedAtLabel: ticketDateTimeFormatter.format(new Date(input.createdAt)),
    statusLabel: isCorrection ? "REVISAR ANTES DE PREPARAR" : undefined,
    infoLines: [
      {
        label: "Mesa",
        value: input.tableName,
      },
      {
        label: "Zona",
        value: input.areaName,
      },
    ],
    items: input.items.map((item) => ({
      label: getKitchenTicketItemLabel(item),
      quantity: item.quantity,
      totalLabel:
        typeof item.totalAmount === "number"
          ? formatCurrency(item.totalAmount)
          : "",
      secondaryLines: [
        ...(item.operation === "modify"
          ? getKitchenModificationDetails({
              modifiers: item.modifiers ?? [],
              notes: item.notes,
              previousModifiers: item.previousModifiers ?? [],
              previousNotes: item.previousNotes,
              previousQuantity: item.previousQuantity,
              quantity: item.quantity,
            })
          : [
              ...(item.notes ? [`Nota: ${item.notes}`] : []),
              ...(item.modifiers ?? []).map(
                (modifier) => `+ ${modifier.quantity} × ${modifier.name}`
              ),
            ]),
      ],
    })),
    totals: [
      {
        label: "Items",
        value: `${input.items.reduce((sum, item) => sum + item.quantity, 0)}`,
        emphasis: true,
      },
    ],
    footerLines: [
      isCorrection
        ? "Aplicar esta corrección a la comanda indicada"
        : "Preparar y pasar a servicio",
    ],
  };

  return {
    title: `Cocina ${input.ticketId.slice(0, 8)}`,
    content: <ThermalReceipt {...receipt} />,
    receipt,
  };
}
