import { notifications } from "@mantine/notifications";
import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useCallback, useMemo, useState } from "react";
import type { PosTableOrderItemStatus } from "@/features/pos/sale-modes/types";
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

function getErrorDescription(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function buildTableCartItem(item: TableOrderItem): CartItem {
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
  };

  return {
    id: item.id,
    product,
    quantity: item.quantity,
    modifiers: item.modifiers.map((modifier) => ({
      id: modifier.modifierProductId,
      name: modifier.name,
      price: modifier.unitPrice,
      quantity: modifier.quantity,
    })),
    discountAmount: item.discountAmount,
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
  const closeOrderMutation = useCloseRestaurantOrderMutation();
  const cancelOrderMutation = useCancelRestaurantOrderMutation();

  const activeItems = useMemo(
    () => openOrder?.items.filter((item) => item.status !== "cancelled") ?? [],
    [openOrder?.items]
  );

  const cart = useMemo(
    () => activeItems.map((item) => buildTableCartItem(item)),
    [activeItems]
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
      setActiveTableId(tableId);
    },
    [enabled]
  );

  const exitTable = useCallback(() => {
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
      const nextQuantity = item.quantity + delta;
      try {
        if (nextQuantity <= 0) {
          await deleteDraftItemMutation.mutateAsync({ orderItemId });
          return;
        }
        await updateDraftItemMutation.mutateAsync({
          orderItemId,
          quantity: nextQuantity,
          notes: undefined,
        });
      } catch (error) {
        notifications.show({
          title: "No se pudo actualizar el ítem",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          color: "red",
        });
      }
    },
    [activeItems, deleteDraftItemMutation, updateDraftItemMutation]
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
        await deleteDraftItemMutation.mutateAsync({ orderItemId });
      } catch (error) {
        notifications.show({
          title: "No se pudo eliminar el ítem",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          color: "red",
        });
      }
    },
    [activeItems, deleteDraftItemMutation]
  );

  const sendToKitchen = useCallback(async () => {
    if (!(openOrder && table)) {
      return;
    }
    const draftItems = openOrder.items
      .filter((item) => item.status === "draft")
      .map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes ?? null,
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

  const cancelTableOrder = useCallback(async () => {
    if (!openOrder) {
      throw new Error("La mesa no tiene una cuenta abierta.");
    }
    try {
      await cancelOrderMutation.mutateAsync({ orderId: openOrder.id });
      exitTable();
    } catch (error) {
      notifications.show({
        title: "No se pudo cancelar la orden",
        message: getErrorDescription(error, "Inténtalo de nuevo."),
        color: "red",
      });
      throw error;
    }
  }, [openOrder, cancelOrderMutation, exitTable]);

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
    sendToKitchen,
    closeTableOrder,
    cancelTableOrder,
    isAddingItem: addItemMutation.isPending,
    isSendingToKitchen: sendToKitchenMutation.isPending,
    isClosingOrder: closeOrderMutation.isPending,
    isCancellingOrder: cancelOrderMutation.isPending,
    closeOrderError: closeOrderMutation.error,
    cancelOrderError: cancelOrderMutation.error,
  };
}

export type PosTableOrder = ReturnType<typeof usePosTableOrder>;
