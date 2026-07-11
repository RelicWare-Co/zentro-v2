import { notifications } from "@mantine/notifications";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildQuickSalePayments,
  usePosCheckout,
} from "@/features/pos/hooks/use-pos-checkout";
import { usePosTableOrder } from "@/features/pos/hooks/use-pos-table-order";
import { resolveAppliedSalePaidAmount } from "@/features/pos/pos.shared";
import type {
  PosSaleModeFactory,
  PosTableSessionState,
  SaleFinalizeOptions,
  SaleModeAdapter,
  SaleModeFactoryParams,
  SalePayment,
} from "@/features/pos/sale-modes/types";

function getErrorDescription(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function noOp() {
  // Intentionally empty: table mode cannot mutate counter-only state.
}

function clonePayments(payments: SalePayment[]) {
  return payments.map((payment) => ({ ...payment }));
}

export function useTableSaleAdapter(
  params: SaleModeFactoryParams & { accessible: boolean }
): SaleModeAdapter {
  const [discountInput, setDiscountInput] = useState("0");
  const tableOrder = usePosTableOrder(
    params.activeOrganizationId,
    discountInput,
    params.accessible
  );
  const isActive = params.accessible && Boolean(tableOrder.activeTableId);

  const prevAccessibleRef = useRef(params.accessible);
  const prevActiveTableIdRef = useRef(tableOrder.activeTableId);

  const resetDiscount = useCallback(() => {
    setDiscountInput("0");
  }, []);

  const checkout = usePosCheckout(
    params.activeShiftId,
    tableOrder.cart,
    tableOrder.totals,
    params.selectedCustomerId,
    discountInput,
    noOp,
    resetDiscount,
    params.paymentMethodOptions,
    false,
    params.closeActiveModal
  );

  // Reset state inline when accessibility or table changes to avoid stale UI
  const shouldReset =
    prevAccessibleRef.current &&
    (!params.accessible ||
      (prevActiveTableIdRef.current !== tableOrder.activeTableId &&
        !tableOrder.activeTableId));

  if (shouldReset) {
    tableOrder.exitTable();
    checkout.resetPayments();
    resetDiscount();
  }

  prevAccessibleRef.current = params.accessible;
  prevActiveTableIdRef.current = tableOrder.activeTableId;

  const finalizeSale = useCallback(
    async (payments: SalePayment[], options: SaleFinalizeOptions) => {
      if (
        !options.shiftId ||
        tableOrder.isClosingOrder ||
        tableOrder.cart.length === 0 ||
        payments.length === 0
      ) {
        return;
      }

      const tableName = tableOrder.table?.name ?? "La mesa";
      const receiptSnapshot = {
        cart: tableOrder.cart.map((item) => ({
          ...item,
          modifiers: item.modifiers.map((modifier) => ({ ...modifier })),
        })),
        payments: clonePayments(payments),
        totals: { ...tableOrder.totals },
      };

      try {
        const result = await tableOrder.closeTableOrder({
          shiftId: options.shiftId,
          customerId: options.customerId,
          discountAmount: receiptSnapshot.totals.saleDiscountAmount,
          payments,
        });

        const paidAmount = resolveAppliedSalePaidAmount(
          receiptSnapshot.totals.totalAmount,
          payments
        );

        notifications.show({
          message: `${tableName} cobrada y liberada`,
          color: "green",
        });

        options.closeModal();
        checkout.resetPayments();
        resetDiscount();
        tableOrder.exitTable();

        Promise.resolve(
          options.printReceipt({
            result: {
              saleId: result.saleId,
              status: "completed",
              subtotal: receiptSnapshot.totals.subTotal,
              taxAmount: receiptSnapshot.totals.tax,
              discountAmount: receiptSnapshot.totals.discountAmount,
              totalAmount: receiptSnapshot.totals.totalAmount,
              paidAmount,
              balanceDue: Math.max(
                receiptSnapshot.totals.totalAmount - paidAmount,
                0
              ),
            },
            snapshot: receiptSnapshot,
          })
        ).catch((error) => {
          notifications.show({
            title: "La mesa se cobró, pero no se pudo imprimir el ticket",
            message: getErrorDescription(
              error,
              "Revisa la impresora e intenta reimprimir."
            ),
            color: "red",
          });
        });
      } catch (error) {
        notifications.show({
          title: "No se pudo cobrar la mesa",
          message: getErrorDescription(error, "Inténtalo de nuevo."),
          color: "red",
        });
      }
    },
    [tableOrder, checkout.resetPayments, resetDiscount]
  );

  const quickSale = useCallback(
    async (options: SaleFinalizeOptions) => {
      await finalizeSale(
        buildQuickSalePayments(tableOrder.totals.totalAmount),
        options
      );
    },
    [finalizeSale, tableOrder.totals.totalAmount]
  );

  const enter = useCallback(
    (payload?: unknown) => {
      if (!(params.accessible && typeof payload === "string" && payload)) {
        return;
      }
      checkout.resetPayments();
      resetDiscount();
      tableOrder.enterTable(payload);
    },
    [
      params.accessible,
      checkout.resetPayments,
      resetDiscount,
      tableOrder.enterTable,
    ]
  );

  const exit = useCallback(() => {
    checkout.resetPayments();
    resetDiscount();
    tableOrder.exitTable();
  }, [checkout.resetPayments, resetDiscount, tableOrder.exitTable]);

  const totalItems = useMemo(
    () => tableOrder.cart.reduce((sum, item) => sum + item.quantity, 0),
    [tableOrder.cart]
  );

  const getProductQuantity = useCallback(
    (productId: string) =>
      tableOrder.cart.reduce(
        (quantity, item) =>
          item.product.id === productId ? quantity + item.quantity : quantity,
        0
      ),
    [tableOrder.cart]
  );

  const sessionState = useMemo<PosTableSessionState | null>(() => {
    if (!(isActive && tableOrder.activeTableId)) {
      return null;
    }

    return {
      tableId: tableOrder.activeTableId,
      tableName: tableOrder.table?.name ?? "Mesa",
      areaName: tableOrder.table?.areaName ?? "",
      orderId: tableOrder.openOrder?.id ?? null,
      orderNumber: tableOrder.openOrder?.orderNumber ?? null,
      itemStatusById: tableOrder.itemStatusById,
      draftItemsCount: tableOrder.draftItemsCount,
      isLoading: tableOrder.isLoading,
      isSendingToKitchen: tableOrder.isSendingToKitchen,
      isCancellingOrder: tableOrder.isCancellingOrder,
      isClosingOrder: tableOrder.isClosingOrder,
    };
  }, [isActive, tableOrder]);

  const addToCart = useCallback<SaleModeAdapter["addToCart"]>(
    (product, modifiers) => {
      tableOrder.addProduct(product, modifiers).catch(() => undefined);
    },
    [tableOrder.addProduct]
  );

  const updateQuantity = useCallback<SaleModeAdapter["updateQuantity"]>(
    (cartItemId, delta) => {
      tableOrder.updateItemQuantity(cartItemId, delta).catch(() => undefined);
    },
    [tableOrder.updateItemQuantity]
  );

  const removeFromCart = useCallback<SaleModeAdapter["removeFromCart"]>(
    (cartItemId) => {
      tableOrder.removeItem(cartItemId).catch(() => undefined);
    },
    [tableOrder.removeItem]
  );

  const sendToKitchen = useCallback(async () => {
    await tableOrder.sendToKitchen();
  }, [tableOrder.sendToKitchen]);

  const cancelOrder = useCallback(
    async (reason: string) => {
      const tableName = tableOrder.table?.name ?? "La mesa";
      await tableOrder.cancelTableOrder(reason);
      checkout.resetPayments();
      resetDiscount();
      tableOrder.exitTable();
      notifications.show({
        message: `${tableName} cancelada y liberada`,
        color: "green",
      });
    },
    [tableOrder, checkout.resetPayments, resetDiscount]
  );

  return {
    modeId: tableSaleModeFactory.modeId,
    isActive,
    cart: tableOrder.cart,
    totals: tableOrder.totals,
    totalItems,
    discountInput,
    allowCreditSales: false,
    checkout,
    isProcessing: tableOrder.isClosingOrder,
    error: tableOrder.closeOrderError,
    sessionState,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart: noOp,
    updateItemDiscount: noOp,
    setDiscountInput,
    getProductQuantity,
    finalizeSale,
    quickSale,
    enter,
    exit,
    sendToKitchen,
    cancelOrder,
  };
}

export const tableSaleModeFactory: PosSaleModeFactory = {
  modeId: "table",
  useAdapter: useTableSaleAdapter,
};
