import { ThermalReceipt } from "@/features/pos/components/thermal-receipt";
import type { ThermalReceiptDocument } from "@/features/pos/printing/thermal-receipt-document";
import { formatCurrency } from "@/lib/format-currency.shared";

const ticketDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "short",
  timeStyle: "short",
});

export function buildKitchenTicketDocument(input: {
  ticketId: string;
  kind?: "correction" | "initial";
  orderNumber: number;
  sequenceNumber: number;
  createdAt: number | Date;
  tableName: string;
  areaName: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    operation?: "cancel" | "prepare";
    notes?: string | null;
    modifiers?: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
    totalAmount?: number;
  }>;
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
      label:
        item.operation === "cancel"
          ? `CANCELAR / NO PREPARAR: ${item.productName}`
          : item.productName,
      quantity: item.quantity,
      totalLabel:
        typeof item.totalAmount === "number"
          ? formatCurrency(item.totalAmount)
          : "",
      secondaryLines: [
        ...(item.notes ? [`Nota: ${item.notes}`] : []),
        ...(item.modifiers ?? []).map(
          (modifier) => `+ ${modifier.quantity} x ${modifier.name}`
        ),
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
