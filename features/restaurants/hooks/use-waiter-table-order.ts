import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildOrderItemUpdateInput,
  createItemMutationQueue,
  getEffectiveItemQuantity,
  type ItemQuantityOverrides,
} from "@/features/pos/table-order-item-edits.shared";
import type { CartItemModifier, Product } from "@/features/pos/types";
import {
  useAddRestaurantOrderItemMutation,
  useDeleteRestaurantOrderItemMutation,
  useRestaurantTableDetail,
  useSendRestaurantOrderToKitchenMutation,
  useUpdateRestaurantOrderItemMutation,
} from "@/features/restaurants/hooks/use-restaurants";
import type { RestaurantTableDetail } from "@/features/restaurants/restaurants.shared";
import { buildPendingKitchenPrintItems } from "@/features/restaurants/waiter-order.shared";

type TableOpenOrder = NonNullable<RestaurantTableDetail["openOrder"]>;
type TableOrderItem = TableOpenOrder["items"][number];
type ItemNotesOverrides = Record<string, string | null>;

const WAITER_MUTATION_QUEUE_KEY = "waiter-table-order";

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

/**
 * Orden de mesa para la superficie móvil del mesero. Reusa las mutaciones
 * server-authoritative de restaurantes y la cola de mutaciones por ítem del
 * POS, sin depender de los contextos del POS.
 */
export function useWaiterTableOrder(tableId: string | null) {
  const [itemNotesOverrides, setItemNotesOverrides] =
    useState<ItemNotesOverrides>({});
  const [itemQuantityOverrides, setItemQuantityOverrides] =
    useState<ItemQuantityOverrides>({});
  const itemNotesOverridesRef = useRef<ItemNotesOverrides>({});
  const itemQuantityOverridesRef = useRef<ItemQuantityOverrides>({});
  const itemMutationQueueRef = useRef(createItemMutationQueue());
  const tableDetailQuery = useRestaurantTableDetail(tableId);
  const table = tableDetailQuery.data?.table ?? null;
  const openOrder = tableDetailQuery.data?.openOrder ?? null;

  const addItemMutation = useAddRestaurantOrderItemMutation();
  const updateOrderItemMutation = useUpdateRestaurantOrderItemMutation();
  const deleteOrderItemMutation = useDeleteRestaurantOrderItemMutation();
  const sendToKitchenMutation = useSendRestaurantOrderToKitchenMutation();

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

  const itemStatusById = useMemo(() => {
    const statuses: Record<string, string> = {};
    for (const item of activeItems) {
      statuses[item.id] = item.status ?? "draft";
    }
    return statuses;
  }, [activeItems]);

  const enqueueItemMutation = useCallback(
    (itemId: string, mutation: () => Promise<void>) =>
      itemMutationQueueRef.current.enqueue(itemId, mutation),
    []
  );

  const addProduct = useCallback(
    async (product: Product, modifiers: CartItemModifier[], notes: string) => {
      if (!tableId) {
        return false;
      }
      try {
        await enqueueItemMutation(WAITER_MUTATION_QUEUE_KEY, async () => {
          await addItemMutation.mutateAsync({
            tableId,
            productId: product.id,
            quantity: 1,
            notes: notes.trim() || null,
            modifiers: modifiers.map((modifier) => ({
              modifierProductId: modifier.id,
              quantity: modifier.quantity,
            })),
          });
        });
        return true;
      } catch (error) {
        notifications.show({
          color: "red",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          title: "No se pudo agregar el producto",
        });
        return false;
      }
    },
    [addItemMutation, enqueueItemMutation, tableId]
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
          color: "red",
          message: "Solo puedes editar ítems que siguen en preparación.",
          title: "Este ítem ya está finalizado",
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
          color: "red",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          title: "No se pudo actualizar el ítem",
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
          color: "red",
          message: "Solo puedes quitar ítems que siguen en preparación.",
          title: "Este ítem ya está finalizado",
        });
        return;
      }
      try {
        await enqueueItemMutation(orderItemId, async () => {
          await deleteOrderItemMutation.mutateAsync({ orderItemId });
        });
      } catch (error) {
        notifications.show({
          color: "red",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          title: "No se pudo eliminar el ítem",
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
        return;
      }
      if (!(item.status === "draft" || item.status === "sent")) {
        notifications.show({
          color: "red",
          message: "Solo puedes editar ítems que siguen en preparación.",
          title: "Este ítem ya está finalizado",
        });
        return;
      }

      const normalizedNotes = notes?.trim() || null;
      try {
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
      } catch (error) {
        notifications.show({
          color: "red",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          title: "No se pudo guardar la nota",
        });
      }
    },
    [activeItems, enqueueItemMutation, updateOrderItemMutation]
  );

  const sendToKitchen = useCallback(async () => {
    if (!openOrder) {
      return false;
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
      return false;
    }

    try {
      await sendToKitchenMutation.mutateAsync({
        orderId: openOrder.id,
        printTarget: "caja",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message: getErrorDescription(error, "Inténtalo de nuevo."),
        title: "No se pudo enviar la comanda a cocina",
      });
      return false;
    }

    notifications.show({
      color: "green",
      message: `${table?.name ?? "Mesa"} enviada a cocina`,
    });
    return true;
  }, [openOrder, sendToKitchenMutation, table?.name]);

  return {
    table,
    openOrder,
    activeItems,
    itemStatusById,
    pendingKitchenItemsCount: pendingKitchenItems.length,
    isLoading: tableDetailQuery.isLoading,
    error: tableDetailQuery.error,
    addProduct,
    updateItemQuantity,
    removeItem,
    updateItemNotes,
    sendToKitchen,
    isSendingToKitchen: sendToKitchenMutation.isPending,
  };
}
