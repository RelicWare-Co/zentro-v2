import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { isOrganizationManagerRole } from "@/features/organization/access-control.shared";
import { usePosProducts } from "@/features/pos/hooks/use-pos-catalog";
import {
  useAddRestaurantOrderItemMutation,
  useCloseRestaurantOrderMutation,
  useDeleteRestaurantDraftItemMutation,
  useRestaurantBootstrap,
  useRestaurantTableDetail,
  useSendRestaurantOrderToKitchenMutation,
  useUpdateRestaurantDraftItemMutation,
  useUpdateRestaurantOrderItemStatusMutation,
  useUpdateRestaurantOrderMetaMutation,
} from "@/features/restaurants/hooks/use-restaurants";
import { buildKitchenTicketDocument } from "@/features/restaurants/printing/kitchen-ticket-documents";
import { useActiveOrganization } from "@/lib/auth-client";

interface KitchenTicketItem {
  modifiers: { name: string; quantity: number; unitPrice: number }[];
  notes: string | null;
  productName: string;
  quantity: number;
  totalAmount: number;
}

async function printKitchenTicket(
  ticket: {
    createdAt: number;
    id: string;
    items: KitchenTicketItem[];
    orderNumber: number;
    sequenceNumber: number;
    table: { name: string; areaName: string };
  },
  activeOrganizationId: string | null
) {
  const document = buildKitchenTicketDocument({
    ticketId: ticket.id,
    orderNumber: ticket.orderNumber,
    sequenceNumber: ticket.sequenceNumber,
    createdAt: ticket.createdAt,
    tableName: ticket.table.name,
    areaName: ticket.table.areaName,
    items: ticket.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
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

async function runMutation(
  operation: () => Promise<unknown>,
  onFeedback: (message: string | null) => void,
  errorMessage: string,
  options?: { successMessage?: string; onSuccess?: () => void }
) {
  onFeedback(null);
  try {
    await operation();
    if (options?.successMessage) {
      onFeedback(options.successMessage);
    }
    options?.onSuccess?.();
  } catch (error) {
    onFeedback(error instanceof Error ? error.message : errorMessage);
  }
}

function syncDraftInputs(
  signature: string,
  previousRef: React.MutableRefObject<string>,
  openOrder: { guestCount: number; notes?: string | null } | null,
  setGuestCount: (val: string) => void,
  setNotes: (val: string) => void
) {
  if (signature === previousRef.current) {
    return;
  }
  previousRef.current = signature;
  if (openOrder) {
    setGuestCount(String(openOrder.guestCount));
    setNotes(openOrder.notes ?? "");
  } else {
    setGuestCount("0");
    setNotes("");
  }
}

export function useRestaurantPageState() {
  const pageContext = usePageContext();
  const canManageLayout = isOrganizationManagerRole(
    pageContext.zeroContext?.role
  );
  const { data: activeOrganization } = useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id ?? null;
  const bootstrapQuery = useRestaurantBootstrap();
  const bootstrap = bootstrapQuery.data;
  const allTables = useMemo(
    () => bootstrap?.areas.flatMap((area) => area.tables) ?? [],
    [bootstrap?.areas]
  );
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const resolvedSelectedTableId =
    selectedTableId && allTables.some((table) => table.id === selectedTableId)
      ? selectedTableId
      : null;
  const tableDetailQuery = useRestaurantTableDetail(resolvedSelectedTableId);
  const selectedTable = tableDetailQuery.data?.table ?? null;
  const openOrder = tableDetailQuery.data?.openOrder ?? null;
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const { data: productSearchResult } = usePosProducts(
    activeCategoryId,
    deferredSearchQuery
  );
  const [guestCountInput, setGuestCountInput] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");
  const openOrderDraftSignature = openOrder
    ? `${openOrder.id}:${openOrder.guestCount}:${openOrder.notes ?? ""}`
    : "empty";
  const previousOpenOrderDraftSignatureRef = useRef(openOrderDraftSignature);
  const [paymentMethod, setPaymentMethod] = useState(
    bootstrap?.settings.paymentMethods[0]?.id ?? "cash"
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!bootstrap) {
      return;
    }
    setPaymentMethod((prev) => {
      const stillValid = bootstrap.settings.paymentMethods.some(
        (method) => method.id === prev
      );
      return stillValid
        ? prev
        : (bootstrap.settings.paymentMethods[0]?.id ?? "cash");
    });
  }, [bootstrap]);

  const addItemMutation = useAddRestaurantOrderItemMutation();
  const updateOrderMetaMutation = useUpdateRestaurantOrderMetaMutation();
  const updateDraftItemMutation = useUpdateRestaurantDraftItemMutation();
  const deleteDraftItemMutation = useDeleteRestaurantDraftItemMutation();
  const sendToKitchenMutation = useSendRestaurantOrderToKitchenMutation();
  const updateItemStatusMutation = useUpdateRestaurantOrderItemStatusMutation();
  const closeOrderMutation = useCloseRestaurantOrderMutation();

  syncDraftInputs(
    openOrderDraftSignature,
    previousOpenOrderDraftSignatureRef,
    openOrder,
    setGuestCountInput,
    setOrderNotes
  );

  const products =
    productSearchResult?.pages.flatMap((page) => page.data) ?? [];
  const requiresReference =
    bootstrap?.settings.paymentMethods.find(
      (method) => method.id === paymentMethod
    )?.requiresReference ?? false;

  const clearSelection = () => setSelectedTableId(null);

  const handleAddProduct = async (productId: string) => {
    if (!resolvedSelectedTableId) {
      return;
    }
    await runMutation(
      () =>
        addItemMutation.mutateAsync({
          tableId: resolvedSelectedTableId,
          productId,
          quantity: 1,
          notes: null,
        }),
      setFeedbackMessage,
      "No se pudo agregar el producto a la mesa."
    );
  };

  const handleSaveOrderMeta = async () => {
    if (!openOrder) {
      return;
    }
    await runMutation(
      () =>
        updateOrderMetaMutation.mutateAsync({
          orderId: openOrder.id,
          guestCount: Number(guestCountInput) || 0,
          notes: orderNotes,
        }),
      setFeedbackMessage,
      "No se pudo actualizar la cuenta.",
      { successMessage: "La cuenta fue actualizada." }
    );
  };

  const handleSendToKitchen = async () => {
    if (!(openOrder && bootstrap && selectedTable)) {
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
    const ticketId = crypto.randomUUID();
    await runMutation(
      async () => {
        const result = await sendToKitchenMutation.mutateAsync({
          orderId: openOrder.id,
          ticketId,
        });
        const kitchenSettings = bootstrap.settings.restaurant.kitchen;
        if (
          kitchenSettings.printTicketsEnabled &&
          kitchenSettings.autoPrintOnSend &&
          draftItems.length > 0
        ) {
          await printKitchenTicket(
            {
              id: result.ticketId,
              orderNumber: openOrder.orderNumber,
              sequenceNumber: 1,
              createdAt: Date.now(),
              table: {
                name: selectedTable.name,
                areaName: selectedTable.areaName,
              },
              items: draftItems,
            },
            activeOrganizationId
          );
        }
      },
      setFeedbackMessage,
      "No se pudo enviar la comanda a cocina.",
      { successMessage: "La comanda fue enviada a cocina." }
    );
  };

  const handleUpdateDraftQuantity = async (
    orderItemId: string,
    nextQuantity: number
  ) => {
    if (nextQuantity <= 0) {
      return;
    }
    await runMutation(
      () =>
        updateDraftItemMutation.mutateAsync({
          orderItemId,
          quantity: nextQuantity,
          notes: null,
        }),
      setFeedbackMessage,
      "No se pudo actualizar el ítem."
    );
  };

  const handleDeleteDraftItem = async (orderItemId: string) => {
    // biome-ignore lint/suspicious/noAlert: Required user confirmation for destructive action
    const confirmed = window.confirm(
      "¿Quitar este ítem de la cuenta? Solo aplica para ítems que aún no se han enviado."
    );
    if (!confirmed) {
      return;
    }
    await runMutation(
      () => deleteDraftItemMutation.mutateAsync({ orderItemId }),
      setFeedbackMessage,
      "No se pudo eliminar el ítem."
    );
  };

  const handleMarkItemServed = async (orderItemId: string) => {
    await runMutation(
      () =>
        updateItemStatusMutation.mutateAsync({
          orderItemId,
          status: "served",
        }),
      setFeedbackMessage,
      "No se pudo actualizar el estado."
    );
  };

  const handleCloseOrder = async () => {
    const activeShift = bootstrap?.activeShift;
    if (!(openOrder && activeShift)) {
      return;
    }
    await runMutation(
      () =>
        closeOrderMutation.mutateAsync({
          orderId: openOrder.id,
          shiftId: activeShift.id,
          customerId: null,
          payments: [
            {
              method: paymentMethod,
              amount: openOrder.totals.totalAmount,
              reference: paymentReference || null,
            },
          ],
        }),
      setFeedbackMessage,
      "No se pudo cerrar la mesa.",
      {
        successMessage: "La mesa fue cobrada y cerrada.",
        onSuccess: () => {
          setPaymentReference("");
          clearSelection();
        },
      }
    );
  };

  return {
    bootstrap,
    bootstrapError: bootstrapQuery.error,
    isBootstrapError: bootstrapQuery.isError,
    canManageLayout,
    selectedTableId: resolvedSelectedTableId,
    selectedTable,
    openOrder,
    isServiceMode: Boolean(resolvedSelectedTableId && selectedTable),
    feedbackMessage,
    products,
    searchQuery,
    activeCategoryId,
    guestCountInput,
    orderNotes,
    paymentMethod,
    paymentReference,
    requiresReference,
    mutations: {
      addItemPending: addItemMutation.isPending,
      updateOrderMetaPending: updateOrderMetaMutation.isPending,
      sendToKitchenPending: sendToKitchenMutation.isPending,
      closeOrderPending: closeOrderMutation.isPending,
      updateDraftPending: updateDraftItemMutation.isPending,
      deleteDraftPending: deleteDraftItemMutation.isPending,
      updateStatusPending: updateItemStatusMutation.isPending,
    },
    setSearchQuery,
    setActiveCategoryId,
    setGuestCountInput,
    setOrderNotes,
    setPaymentMethod,
    setPaymentReference,
    selectTable: setSelectedTableId,
    clearSelection,
    handleAddProduct,
    handleSaveOrderMeta,
    handleSendToKitchen,
    handleUpdateDraftQuantity,
    handleDeleteDraftItem,
    handleMarkItemServed,
    handleCloseOrder,
  };
}
