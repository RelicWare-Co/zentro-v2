import { useCallback } from "react";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { usePosCheckout } from "@/features/pos/hooks/use-pos-checkout";
import type {
  SaleFinalizeOptions,
  SaleModeAdapter,
  SaleModeFactoryParams,
  SalePayment,
} from "@/features/pos/sale-modes/types";

async function noOpAsync() {
  // Los comentarios de cocina aplican únicamente a órdenes de mesa.
}

export function useCounterSaleAdapter(
  params: SaleModeFactoryParams
): SaleModeAdapter {
  const cart = usePosCart();

  const checkout = usePosCheckout(
    params.activeShiftId,
    cart.cart,
    cart.totals,
    params.selectedCustomerId,
    cart.discountInput,
    cart.clearCart,
    cart.resetDiscount,
    params.paymentMethodOptions,
    params.allowCreditSales,
    params.closeActiveModal,
    params.printReceiptForSale
  );

  const finalizeSale = useCallback(
    (_payments: SalePayment[], _options: SaleFinalizeOptions) => {
      checkout.handleFinalizeSale();
      return Promise.resolve();
    },
    [checkout.handleFinalizeSale]
  );

  const quickSale = useCallback(
    (_options: SaleFinalizeOptions) => {
      checkout.handleQuickSale();
      return Promise.resolve();
    },
    [checkout.handleQuickSale]
  );

  const resetModePayments = useCallback(() => {
    checkout.resetPayments();
  }, [checkout.resetPayments]);

  return {
    modeId: "counter",
    isActive: true,
    cart: cart.cart,
    totals: cart.totals,
    totalItems: cart.totalItems,
    discountInput: cart.discountInput,
    allowCreditSales: params.allowCreditSales,
    checkout,
    isProcessing: checkout.isProcessing,
    error: checkout.error,
    sessionState: null,
    addToCart: cart.addToCart,
    updateQuantity: cart.updateQuantity,
    removeFromCart: cart.removeFromCart,
    clearCart: cart.clearCart,
    updateItemDiscount: cart.updateItemDiscount,
    updateItemNotes: noOpAsync,
    setDiscountInput: cart.setDiscountInput,
    getProductQuantity: cart.getProductQuantity,
    finalizeSale,
    quickSale,
    enter: resetModePayments,
    exit: resetModePayments,
  };
}
