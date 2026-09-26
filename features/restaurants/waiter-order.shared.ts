import type {
  KitchenTicketPrintItem,
  KitchenTicketPrintPayload,
} from "@/features/restaurants/printing/print-kitchen-ticket";
import type { RestaurantTableDetail } from "@/features/restaurants/restaurants.shared";

export type WaiterTableOrder = NonNullable<RestaurantTableDetail["openOrder"]>;
export type WaiterTableOrderItem = WaiterTableOrder["items"][number];
export type WaiterKitchenTicket = WaiterTableOrder["tickets"][number];

function parseSentModifiers(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((modifier) => {
      if (
        !modifier ||
        typeof modifier !== "object" ||
        !("name" in modifier) ||
        !("quantity" in modifier) ||
        !("unitPrice" in modifier) ||
        typeof modifier.name !== "string" ||
        typeof modifier.quantity !== "number" ||
        typeof modifier.unitPrice !== "number"
      ) {
        return [];
      }

      return [
        {
          name: modifier.name,
          quantity: modifier.quantity,
          unitPrice: modifier.unitPrice,
        },
      ];
    });
  } catch {
    return [];
  }
}

function serializeModifiers(item: WaiterTableOrderItem) {
  return JSON.stringify(
    item.modifiers
      .map((modifier) => ({
        id: modifier.modifierProductId,
        name: modifier.name,
        quantity: modifier.quantity,
        unitPrice: modifier.unitPrice,
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id))
  );
}

function scaleItemTotal(item: WaiterTableOrderItem, quantity: number) {
  return item.quantity > 0
    ? Math.round((item.totalAmount / item.quantity) * quantity)
    : item.totalAmount;
}

function buildCurrentKitchenPrintItem(
  item: WaiterTableOrderItem,
  quantity: number,
  notes: string | null
): KitchenTicketPrintItem {
  return {
    productName: item.productName,
    quantity,
    notes,
    modifiers: item.modifiers.map((modifier) => ({
      name: modifier.name,
      quantity: modifier.quantity,
      unitPrice: modifier.unitPrice,
    })),
    totalAmount: scaleItemTotal(item, quantity),
  };
}

function buildSentKitchenPrintItem(
  item: WaiterTableOrderItem,
  current: KitchenTicketPrintItem
): KitchenTicketPrintItem {
  const savedSentQuantity = item.sentQuantity ?? 0;
  const quantity = savedSentQuantity > 0 ? savedSentQuantity : item.quantity;
  const notes =
    savedSentQuantity > 0 ? (item.sentNotes ?? null) : (item.notes ?? null);
  const modifiers =
    savedSentQuantity > 0
      ? parseSentModifiers(item.sentModifiersSnapshot ?? "[]")
      : current.modifiers;

  return {
    productName: item.sentProductName ?? item.productName,
    quantity,
    notes,
    modifiers,
    totalAmount: scaleItemTotal(item, quantity),
    operation: "cancel",
  };
}

function buildModifiedKitchenPrintItem(
  current: KitchenTicketPrintItem,
  sent: KitchenTicketPrintItem
): KitchenTicketPrintItem {
  return {
    ...current,
    productName: sent.productName,
    operation: "modify",
    previousModifiers: sent.modifiers,
    previousNotes: sent.notes,
    previousQuantity: sent.quantity,
  };
}

function getPendingKitchenLines(
  item: WaiterTableOrderItem,
  quantity: number,
  notes: string | null
): KitchenTicketPrintItem[] {
  const current = buildCurrentKitchenPrintItem(item, quantity, notes);
  if (item.status === "draft") {
    return [current];
  }

  const sent = buildSentKitchenPrintItem(item, current);
  if (item.pendingCancellation) {
    return [sent];
  }

  const modifiersChanged =
    serializeModifiers(item) !== (item.sentModifiersSnapshot ?? "[]");
  const quantityDifference = quantity - sent.quantity;
  if (notes === sent.notes && !modifiersChanged && quantityDifference === 0) {
    return [];
  }

  return [buildModifiedKitchenPrintItem(current, sent)];
}

export function buildPendingKitchenPrintItems(
  items: WaiterTableOrderItem[],
  getQuantity: (item: WaiterTableOrderItem) => number,
  getNotes: (item: WaiterTableOrderItem) => string | null
): KitchenTicketPrintItem[] {
  return items.flatMap((item) =>
    getPendingKitchenLines(item, getQuantity(item), getNotes(item))
  );
}

export function buildKitchenTicketPrintPayload(params: {
  orderNumber: number;
  table: { name: string; areaName: string };
  ticket: WaiterKitchenTicket;
}): KitchenTicketPrintPayload {
  const { orderNumber, table, ticket } = params;

  return {
    id: ticket.id,
    orderNumber,
    kind: ticket.kind,
    sequenceNumber: ticket.sequenceNumber,
    createdAt: ticket.createdAt,
    table: {
      name: table.name,
      areaName: table.areaName,
    },
    items: ticket.lines.map((line) => ({
      productName: line.productName,
      quantity: line.quantity,
      operation: line.operation,
      notes: line.notes ?? null,
      previousNotes: line.previousNotes ?? null,
      previousQuantity: line.previousQuantity ?? null,
      modifiers: line.modifiers.map((modifier) => ({
        name: modifier.name,
        quantity: modifier.quantity,
        unitPrice: modifier.unitPrice,
      })),
      previousModifiers: line.previousModifiers.map((modifier) => ({
        name: modifier.name,
        quantity: modifier.quantity,
        unitPrice: modifier.unitPrice,
      })),
    })),
  };
}
