import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { CartItem, CartItemModifier, Product } from "@/features/pos/types";
import { calculateCartTotals } from "@/features/pos/utils";
import {
  useAddRestaurantOrderItemMutation,
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

export type PosTableOrderItemStatus = "draft" | "sent" | "ready" | "served";

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
  discountInput = "0"
) {
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const tableDetailQuery = useRestaurantTableDetail(activeTableId);
  const table = tableDetailQuery.data?.table ?? null;
  const openOrder = tableDetailQuery.data?.openOrder ?? null;
  const [organizationRows] = useZeroQuery(queries.organization.current());
  const organizationMetadata = organizationRows[0]?.metadata ?? null;

  const addItemMutation = useAddRestaurantOrderItemMutation();
  const updateDraftItemMutation = useUpdateRestaurantDraftItemMutation();
  const deleteDraftItemMutation = useDeleteRestaurantDraftItemMutation();
  const sendToKitchenMutation = useSendRestaurantOrderToKitchenMutation();
  const closeOrderMutation = useCloseRestaurantOrderMutation();

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

  const enterTable = useCallback((tableId: string) => {
    setActiveTableId(tableId);
  }, []);

  const exitTable = useCallback(() => {
    setActiveTableId(null);
  }, []);

  const addProduct = useCallback(
    async (product: Product, modifiers: CartItemModifier[]) => {
      if (!activeTableId) {
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
        toast.error("No se pudo agregar el producto a la mesa", {
          description: getErrorDescription(error, "Inténtalo de nuevo."),
        });
      }
    },
    [activeTableId, addItemMutation]
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
        toast.error("Este ítem ya fue enviado a cocina", {
          description: "Solo puedes editar ítems pendientes de envío.",
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
        toast.error("No se pudo actualizar el ítem", {
          description: getErrorDescription(error, "Inténtalo de nuevo."),
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
        toast.error("Este ítem ya fue enviado a cocina", {
          description: "Solo puedes quitar ítems pendientes de envío.",
        });
        return;
      }
      try {
        await deleteDraftItemMutation.mutateAsync({ orderItemId });
      } catch (error) {
        toast.error("No se pudo eliminar el ítem", {
          description: getErrorDescription(error, "Inténtalo de nuevo."),
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
      toast.error("No se pudo enviar la comanda a cocina", {
        description: getErrorDescription(error, "Inténtalo de nuevo."),
      });
      return;
    }

    toast.success(`Comanda de ${table.name} enviada a cocina`);

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
      toast.error("La comanda se envió, pero no se pudo imprimir", {
        description: getErrorDescription(
          error,
          "Revisa la impresora de cocina."
        ),
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
    isAddingItem: addItemMutation.isPending,
    isSendingToKitchen: sendToKitchenMutation.isPending,
    isClosingOrder: closeOrderMutation.isPending,
    closeOrderError: closeOrderMutation.error,
  };
}

export type PosTableOrder = ReturnType<typeof usePosTableOrder>;
