import { notifications } from "@mantine/notifications";
import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PosTableOrderItemStatus } from "@/features/pos/sale-modes/types";
import {
  buildOrderItemUpdateInput,
  createItemMutationQueue,
  getEffectiveItemQuantity,
  type ItemQuantityOverrides,
} from "@/features/pos/table-order-item-edits.shared";
import type { CartItem, CartItemModifier, Product } from "@/features/pos/types";
import { calculateCartTotals } from "@/features/pos/utils";
import {
  useAddRestaurantOrderItemMutation,
  useCancelRestaurantOrderMutation,
  useCloseRestaurantOrderMutation,
  useDeleteRestaurantOrderItemMutation,
  useRestaurantTableDetail,
  useSendRestaurantOrderToKitchenMutation,
  useUpdateRestaurantOrderItemMutation,
} from "@/features/restaurants/hooks/use-restaurants";
import {
  type KitchenTicketPrintItem,
  printKitchenTicket,
} from "@/features/restaurants/printing/print-kitchen-ticket";
import type { RestaurantTableDetail } from "@/features/restaurants/restaurants.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { queries } from "@/zero/queries";

type TableOpenOrder = NonNullable<RestaurantTableDetail["openOrder"]>;
type TableOrderItem = TableOpenOrder["items"][number];
type ItemNotesOverrides = Record<string, string | null>;

interface PendingKitchenAutoPrint {
  areaName: string;
  tableName: string;
  ticketId: string;
}

function getErrorDescription(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getEffectiveItemNotes(
  item: TableOrderItem,
  itemNotesOverrides: ItemNotesOverrides
) {
  if (Object.hasOwn(itemNotesOverrides, item.id)) {
    return itemNotesOverrides[item.id] ?? null;
  }
  return item.notes ?? null;
}

function buildTableCartItem(
  item: TableOrderItem,
  quantity: number,
  notes: string | null
): CartItem {
  const product: Product = {
    id: item.productId,
    name: item.productName,
    categoryId: null,
    categoryName: "",
    sku: null,
    barcode: null,
    price: item.unitPrice,
    taxRate: item.taxRate,
    trackInventory: false,
    stock: 0,
    isModifier: false,
    isFavorite: false,
    accountingTreatment: "revenue",
  };

  return {
    id: item.id,
    product,
    quantity,
    modifiers: item.modifiers.map((modifier) => ({
      id: modifier.modifierProductId,
      name: modifier.name,
      price: modifier.unitPrice,
      quantity: modifier.quantity,
    })),
    discountAmount: item.discountAmount,
    notes,
  };
}

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

function serializeModifiers(item: TableOrderItem) {
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

function scaleItemTotal(item: TableOrderItem, quantity: number) {
  return item.quantity > 0
    ? Math.round((item.totalAmount / item.quantity) * quantity)
    : item.totalAmount;
}

function buildCurrentKitchenPrintItem(
  item: TableOrderItem,
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
  item: TableOrderItem,
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

function getPendingKitchenLines(
  item: TableOrderItem,
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
  if (notes !== sent.notes || modifiersChanged) {
    return [sent, current];
  }

  const quantityDifference = quantity - sent.quantity;
  if (quantityDifference === 0) {
    return [];
  }

  const correctionQuantity = Math.abs(quantityDifference);
  const operation = quantityDifference > 0 ? "prepare" : "cancel";
  const correctionItem = operation === "prepare" ? current : sent;
  return [
    {
      ...correctionItem,
      quantity: correctionQuantity,
      totalAmount: scaleItemTotal(item, correctionQuantity),
      operation,
    },
  ];
}

function buildPendingKitchenPrintItems(
  items: TableOrderItem[],
  getQuantity: (item: TableOrderItem) => number,
  getNotes: (item: TableOrderItem) => string | null
): KitchenTicketPrintItem[] {
  return items.flatMap((item) =>
    getPendingKitchenLines(item, getQuantity(item), getNotes(item))
  );
}

/**
 * Sesión de mesa dentro del POS: expone la cuenta abierta de una mesa como un
 * carrito POS (ítems + totales con impuestos, igual que `createCoreSale`) y
 * enruta las acciones del POS a las mutaciones del módulo de restaurantes.
 */
export function usePosTableOrder(
  activeOrganizationId: string | null,
  discountInput = "0",
  enabled = true
) {
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [itemNotesOverrides, setItemNotesOverrides] =
    useState<ItemNotesOverrides>({});
  const [itemQuantityOverrides, setItemQuantityOverrides] =
    useState<ItemQuantityOverrides>({});
  const [pendingKitchenAutoPrint, setPendingKitchenAutoPrint] =
    useState<PendingKitchenAutoPrint | null>(null);
  const itemNotesOverridesRef = useRef<ItemNotesOverrides>({});
  const itemQuantityOverridesRef = useRef<ItemQuantityOverrides>({});
  const itemMutationQueueRef = useRef(createItemMutationQueue());
  const tableDetailQuery = useRestaurantTableDetail(
    enabled ? activeTableId : null
  );
  const table = tableDetailQuery.data?.table ?? null;
  const openOrder = tableDetailQuery.data?.openOrder ?? null;
  const [organizationRows] = useZeroQuery(queries.organization.current());
  const organizationMetadata = organizationRows[0]?.metadata ?? null;

  const addItemMutation = useAddRestaurantOrderItemMutation();
  const updateOrderItemMutation = useUpdateRestaurantOrderItemMutation();
  const deleteOrderItemMutation = useDeleteRestaurantOrderItemMutation();
  const sendToKitchenMutation = useSendRestaurantOrderToKitchenMutation();
  const cancelOrderMutation = useCancelRestaurantOrderMutation();
  const closeOrderMutation = useCloseRestaurantOrderMutation();

  const activeItems = useMemo(
    () =>
      openOrder?.items.filter(
        (item) => item.status !== "cancelled" && !item.pendingCancellation
      ) ?? [],
    [openOrder?.items]
  );

  useEffect(() => {
    setItemNotesOverrides((previousOverrides) => {
      let changed = false;
      const remainingOverrides: ItemNotesOverrides = {};

      for (const [itemId, notes] of Object.entries(previousOverrides)) {
        const item = activeItems.find((activeItem) => activeItem.id === itemId);
        if (item && (item.notes ?? null) !== notes) {
          remainingOverrides[itemId] = notes;
        } else {
          changed = true;
        }
      }

      if (changed) {
        itemNotesOverridesRef.current = remainingOverrides;
        return remainingOverrides;
      }

      return previousOverrides;
    });
  }, [activeItems]);

  useEffect(() => {
    setItemQuantityOverrides((previousOverrides) => {
      let changed = false;
      const remainingOverrides: ItemQuantityOverrides = {};

      for (const [itemId, quantity] of Object.entries(previousOverrides)) {
        const item = activeItems.find((activeItem) => activeItem.id === itemId);
        if (item && item.quantity !== quantity) {
          remainingOverrides[itemId] = quantity;
        } else {
          changed = true;
        }
      }

      if (changed) {
        itemQuantityOverridesRef.current = remainingOverrides;
        return remainingOverrides;
      }

      return previousOverrides;
    });
  }, [activeItems]);

  const cart = useMemo(
    () =>
      activeItems.map((item) =>
        buildTableCartItem(
          item,
          getEffectiveItemQuantity(
            item.id,
            item.quantity,
            itemQuantityOverrides
          ),
          getEffectiveItemNotes(item, itemNotesOverrides)
        )
      ),
    [activeItems, itemNotesOverrides, itemQuantityOverrides]
  );

  const totals = useMemo(
    () => calculateCartTotals(cart, discountInput),
    [cart, discountInput]
  );
  const pendingKitchenItems = useMemo(
    () =>
      openOrder
        ? buildPendingKitchenPrintItems(
            openOrder.items,
            (item) =>
              getEffectiveItemQuantity(
                item.id,
                item.quantity,
                itemQuantityOverrides
              ),
            (item) => getEffectiveItemNotes(item, itemNotesOverrides)
          )
        : [],
    [itemNotesOverrides, itemQuantityOverrides, openOrder]
  );
  const pendingKitchenSummary = useMemo(
    () => ({
      cancellations: pendingKitchenItems.filter(
        (item) => item.operation === "cancel"
      ).length,
      preparations: pendingKitchenItems.filter(
        (item) => item.operation !== "cancel"
      ).length,
    }),
    [pendingKitchenItems]
  );

  useEffect(() => {
    if (!(pendingKitchenAutoPrint && openOrder)) {
      return;
    }
    const ticket = openOrder.tickets.find(
      (candidate) => candidate.id === pendingKitchenAutoPrint.ticketId
    );
    if (!ticket || ticket.lines.length === 0) {
      return;
    }

    setPendingKitchenAutoPrint(null);
    printKitchenTicket(
      {
        id: ticket.id,
        orderNumber: openOrder.orderNumber,
        kind: ticket.kind,
        sequenceNumber: ticket.sequenceNumber,
        createdAt: ticket.createdAt,
        table: {
          name: pendingKitchenAutoPrint.tableName,
          areaName: pendingKitchenAutoPrint.areaName,
        },
        items: ticket.lines.map((line) => ({
          productName: line.productName,
          quantity: line.quantity,
          operation: line.operation,
          notes: line.notes ?? null,
          modifiers: line.modifiers.map((modifier) => ({
            name: modifier.name,
            quantity: modifier.quantity,
            unitPrice: modifier.unitPrice,
          })),
        })),
      },
      activeOrganizationId
    ).catch((error) => {
      notifications.show({
        title: "La comanda se envió, pero no se pudo imprimir",
        message: getErrorDescription(error, "Revisa la impresora de cocina."),
        color: "red",
      });
    });
  }, [activeOrganizationId, openOrder, pendingKitchenAutoPrint]);

  const itemStatusById = useMemo(() => {
    const statuses: Record<string, PosTableOrderItemStatus> = {};
    for (const item of activeItems) {
      statuses[item.id] =
        item.status === "sent" ||
        item.status === "ready" ||
        item.status === "served"
          ? item.status
          : "draft";
    }
    return statuses;
  }, [activeItems]);

  const enterTable = useCallback(
    (tableId: string) => {
      if (!enabled) {
        return;
      }
      itemNotesOverridesRef.current = {};
      itemQuantityOverridesRef.current = {};
      itemMutationQueueRef.current.clear();
      setItemNotesOverrides({});
      setItemQuantityOverrides({});
      setActiveTableId(tableId);
    },
    [enabled]
  );

  const exitTable = useCallback(() => {
    itemNotesOverridesRef.current = {};
    itemQuantityOverridesRef.current = {};
    itemMutationQueueRef.current.clear();
    setItemNotesOverrides({});
    setItemQuantityOverrides({});
    setActiveTableId(null);
  }, []);

  const addProduct = useCallback(
    async (product: Product, modifiers: CartItemModifier[]) => {
      if (!(enabled && activeTableId)) {
        return;
      }
      try {
        await addItemMutation.mutateAsync({
          tableId: activeTableId,
          productId: product.id,
          quantity: 1,
          notes: null,
          modifiers: modifiers.map((modifier) => ({
            modifierProductId: modifier.id,
            quantity: modifier.quantity,
          })),
        });
      } catch (error) {
        notifications.show({
          title: "No se pudo agregar el producto a la mesa",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          color: "red",
        });
      }
    },
    [enabled, activeTableId, addItemMutation]
  );

  const enqueueItemMutation = useCallback(
    (itemId: string, mutation: () => Promise<void>) =>
      itemMutationQueueRef.current.enqueue(itemId, mutation),
    []
  );

  const updateItemQuantity = useCallback(
    async (orderItemId: string, delta: number) => {
      const item = activeItems.find(
        (orderItem) => orderItem.id === orderItemId
      );
      if (!item) {
        return;
      }
      if (!(item.status === "draft" || item.status === "sent")) {
        notifications.show({
          title: "Este ítem ya está finalizado",
          message: "Solo puedes editar ítems que siguen en preparación.",
          color: "red",
        });
        return;
      }
      const nextQuantity =
        getEffectiveItemQuantity(
          item.id,
          item.quantity,
          itemQuantityOverridesRef.current
        ) + delta;
      try {
        if (nextQuantity <= 0) {
          await enqueueItemMutation(orderItemId, async () => {
            await deleteOrderItemMutation.mutateAsync({ orderItemId });
          });
          return;
        }

        const nextOverrides = {
          ...itemQuantityOverridesRef.current,
          [orderItemId]: nextQuantity,
        };
        itemQuantityOverridesRef.current = nextOverrides;
        setItemQuantityOverrides(nextOverrides);

        await enqueueItemMutation(orderItemId, async () => {
          await updateOrderItemMutation.mutateAsync(
            buildOrderItemUpdateInput({
              itemId: orderItemId,
              replicatedQuantity: item.quantity,
              quantityOverrides: itemQuantityOverridesRef.current,
              notes: undefined,
            })
          );
        });
      } catch (error) {
        if (itemQuantityOverridesRef.current[orderItemId] === nextQuantity) {
          const { [orderItemId]: _discarded, ...remainingOverrides } =
            itemQuantityOverridesRef.current;
          itemQuantityOverridesRef.current = remainingOverrides;
          setItemQuantityOverrides(remainingOverrides);
        }
        notifications.show({
          title: "No se pudo actualizar el ítem",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          color: "red",
        });
      }
    },
    [
      activeItems,
      deleteOrderItemMutation,
      enqueueItemMutation,
      updateOrderItemMutation,
    ]
  );

  const removeItem = useCallback(
    async (orderItemId: string) => {
      const item = activeItems.find(
        (orderItem) => orderItem.id === orderItemId
      );
      if (!item) {
        return;
      }
      if (!(item.status === "draft" || item.status === "sent")) {
        notifications.show({
          title: "Este ítem ya está finalizado",
          message: "Solo puedes quitar ítems que siguen en preparación.",
          color: "red",
        });
        return;
      }
      try {
        await enqueueItemMutation(orderItemId, async () => {
          await deleteOrderItemMutation.mutateAsync({ orderItemId });
        });
      } catch (error) {
        notifications.show({
          title: "No se pudo eliminar el ítem",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          color: "red",
        });
      }
    },
    [activeItems, deleteOrderItemMutation, enqueueItemMutation]
  );

  const updateItemNotes = useCallback(
    async (orderItemId: string, notes: string | null) => {
      const item = activeItems.find(
        (orderItem) => orderItem.id === orderItemId
      );
      if (!item) {
        throw new Error("El ítem ya no está disponible en la orden.");
      }
      if (!(item.status === "draft" || item.status === "sent")) {
        throw new Error("Solo puedes editar ítems que siguen en preparación.");
      }

      const normalizedNotes = notes?.trim() || null;
      await enqueueItemMutation(orderItemId, async () => {
        await updateOrderItemMutation.mutateAsync(
          buildOrderItemUpdateInput({
            itemId: orderItemId,
            replicatedQuantity: item.quantity,
            quantityOverrides: itemQuantityOverridesRef.current,
            notes: normalizedNotes,
          })
        );
      });
      const nextOverrides = {
        ...itemNotesOverridesRef.current,
        [orderItemId]: normalizedNotes,
      };
      itemNotesOverridesRef.current = nextOverrides;
      setItemNotesOverrides(nextOverrides);
    },
    [activeItems, enqueueItemMutation, updateOrderItemMutation]
  );

  const sendToKitchen = useCallback(async () => {
    if (!(openOrder && table)) {
      return;
    }
    await itemMutationQueueRef.current.waitForAll();
    const pendingItems = buildPendingKitchenPrintItems(
      openOrder.items,
      (item) =>
        getEffectiveItemQuantity(
          item.id,
          item.quantity,
          itemQuantityOverridesRef.current
        ),
      (item) => getEffectiveItemNotes(item, itemNotesOverridesRef.current)
    );
    if (pendingItems.length === 0) {
      return;
    }

    const ticketId = crypto.randomUUID();
    try {
      await sendToKitchenMutation.mutateAsync({
        orderId: openOrder.id,
        ticketId,
      });
    } catch (error) {
      notifications.show({
        title: "No se pudo enviar la comanda a cocina",
        message: getErrorDescription(error, "Inténtalo de nuevo."),
        color: "red",
      });
      return;
    }

    notifications.show({
      message: `${table.name} enviada a cocina`,
      color: "green",
    });

    const kitchenSettings =
      parseOrganizationSettingsMetadata(organizationMetadata).restaurants
        .kitchen;
    if (
      kitchenSettings.printTicketsEnabled &&
      kitchenSettings.autoPrintOnSend
    ) {
      setPendingKitchenAutoPrint({
        ticketId,
        tableName: table.name,
        areaName: table.areaName,
      });
    }
  }, [openOrder, table, sendToKitchenMutation, organizationMetadata]);

  const closeTableOrder = useCallback(
    async (params: {
      shiftId: string;
      customerId: string | null;
      discountAmount?: number;
      payments: Array<{
        method: string;
        amount: number;
        reference: string | null;
      }>;
    }) => {
      if (!openOrder) {
        throw new Error("La mesa no tiene una cuenta abierta.");
      }
      return await closeOrderMutation.mutateAsync({
        orderId: openOrder.id,
        shiftId: params.shiftId,
        customerId: params.customerId,
        discountAmount: params.discountAmount,
        payments: params.payments,
      });
    },
    [openOrder, closeOrderMutation]
  );

  const cancelTableOrder = useCallback(
    async (reason: string) => {
      if (!openOrder) {
        throw new Error("La mesa no tiene una cuenta abierta.");
      }
      await cancelOrderMutation.mutateAsync({
        orderId: openOrder.id,
        reason,
      });
    },
    [openOrder, cancelOrderMutation]
  );

  return {
    activeTableId,
    table,
    openOrder,
    cart,
    totals,
    itemStatusById,
    draftItemsCount: openOrder?.totals.draftItemsCount ?? 0,
    hasSentKitchenTicket: (openOrder?.tickets.length ?? 0) > 0,
    hasPendingKitchenChanges: openOrder?.hasPendingKitchenChanges ?? false,
    pendingKitchenCancellationCount: pendingKitchenSummary.cancellations,
    pendingKitchenPreparationCount: pendingKitchenSummary.preparations,
    isLoading: tableDetailQuery.isLoading,
    detailError: tableDetailQuery.error,
    enterTable,
    exitTable,
    addProduct,
    updateItemQuantity,
    removeItem,
    updateItemNotes,
    sendToKitchen,
    closeTableOrder,
    cancelTableOrder,
    isAddingItem: addItemMutation.isPending,
    isSendingToKitchen: sendToKitchenMutation.isPending,
    isCancellingOrder: cancelOrderMutation.isPending,
    isClosingOrder: closeOrderMutation.isPending,
    closeOrderError: closeOrderMutation.error,
  };
}

export type PosTableOrder = ReturnType<typeof usePosTableOrder>;
