import { notifications } from "@mantine/notifications";
import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PosTableOrderItemStatus } from "@/features/pos/sale-modes/types";
import {
  buildDraftItemUpdateInput,
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
  useDeleteRestaurantDraftItemMutation,
  useRestaurantTableDetail,
  useSendRestaurantOrderToKitchenMutation,
  useUpdateRestaurantDraftItemMutation,
} from "@/features/restaurants/hooks/use-restaurants";
import { printKitchenTicket } from "@/features/restaurants/printing/print-kitchen-ticket";
import type { RestaurantTableDetail } from "@/features/restaurants/restaurants.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { queries } from "@/zero/queries";

type TableOpenOrder = NonNullable<RestaurantTableDetail["openOrder"]>;
type TableOrderItem = TableOpenOrder["items"][number];
type ItemNotesOverrides = Record<string, string | null>;

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
  const updateDraftItemMutation = useUpdateRestaurantDraftItemMutation();
  const deleteDraftItemMutation = useDeleteRestaurantDraftItemMutation();
  const sendToKitchenMutation = useSendRestaurantOrderToKitchenMutation();
  const cancelOrderMutation = useCancelRestaurantOrderMutation();
  const closeOrderMutation = useCloseRestaurantOrderMutation();

  const activeItems = useMemo(
    () => openOrder?.items.filter((item) => item.status !== "cancelled") ?? [],
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
      if (item.status !== "draft") {
        notifications.show({
          title: "Este ítem ya fue enviado a cocina",
          message: "Solo puedes editar ítems pendientes de envío.",
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
            await deleteDraftItemMutation.mutateAsync({ orderItemId });
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
          await updateDraftItemMutation.mutateAsync(
            buildDraftItemUpdateInput({
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
      deleteDraftItemMutation,
      enqueueItemMutation,
      updateDraftItemMutation,
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
      if (item.status !== "draft") {
        notifications.show({
          title: "Este ítem ya fue enviado a cocina",
          message: "Solo puedes quitar ítems pendientes de envío.",
          color: "red",
        });
        return;
      }
      try {
        await enqueueItemMutation(orderItemId, async () => {
          await deleteDraftItemMutation.mutateAsync({ orderItemId });
        });
      } catch (error) {
        notifications.show({
          title: "No se pudo eliminar el ítem",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          color: "red",
        });
      }
    },
    [activeItems, deleteDraftItemMutation, enqueueItemMutation]
  );

  const updateItemNotes = useCallback(
    async (orderItemId: string, notes: string | null) => {
      const item = activeItems.find(
        (orderItem) => orderItem.id === orderItemId
      );
      if (!item) {
        throw new Error("El ítem ya no está disponible en la orden.");
      }
      if (item.status !== "draft") {
        throw new Error("Solo puedes editar ítems pendientes de envío.");
      }

      const normalizedNotes = notes?.trim() || null;
      await enqueueItemMutation(orderItemId, async () => {
        await updateDraftItemMutation.mutateAsync(
          buildDraftItemUpdateInput({
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
    [activeItems, enqueueItemMutation, updateDraftItemMutation]
  );

  const sendToKitchen = useCallback(async () => {
    if (!(openOrder && table)) {
      return;
    }
    await itemMutationQueueRef.current.waitForAll();
    const draftItems = openOrder.items
      .filter((item) => item.status === "draft")
      .map((item) => ({
        productName: item.productName,
        quantity: getEffectiveItemQuantity(
          item.id,
          item.quantity,
          itemQuantityOverridesRef.current
        ),
        notes: getEffectiveItemNotes(item, itemNotesOverridesRef.current),
        modifiers: item.modifiers.map((modifier) => ({
          name: modifier.name,
          quantity: modifier.quantity,
          unitPrice: modifier.unitPrice,
        })),
        totalAmount: item.totalAmount,
      }));
    if (draftItems.length === 0) {
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
      message: `Comanda de ${table.name} enviada a cocina`,
      color: "green",
    });

    const kitchenSettings =
      parseOrganizationSettingsMetadata(organizationMetadata).restaurants
        .kitchen;
    if (
      !(kitchenSettings.printTicketsEnabled && kitchenSettings.autoPrintOnSend)
    ) {
      return;
    }
    try {
      await printKitchenTicket(
        {
          id: ticketId,
          orderNumber: openOrder.orderNumber,
          sequenceNumber: openOrder.tickets.length + 1,
          createdAt: Date.now(),
          table: { name: table.name, areaName: table.areaName },
          items: draftItems,
        },
        activeOrganizationId
      );
    } catch (error) {
      notifications.show({
        title: "La comanda se envió, pero no se pudo imprimir",
        message: getErrorDescription(error, "Revisa la impresora de cocina."),
        color: "red",
      });
    }
  }, [
    openOrder,
    table,
    sendToKitchenMutation,
    organizationMetadata,
    activeOrganizationId,
  ]);

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
