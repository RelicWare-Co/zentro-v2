import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
} from "react";
import { buildSalePaymentsFromInputs } from "@/features/pos/hooks/use-pos-checkout";
import { usePosCustomer } from "@/features/pos/pos-customer-context";
import { usePosModal } from "@/features/pos/pos-modal-context";
import { POS_MODAL_IDS } from "@/features/pos/pos-page-modals.shared";
import { usePosSaleMode } from "@/features/pos/pos-sale-mode-context";
import { usePosShiftContext } from "@/features/pos/pos-shift-context";
import type { PaymentMethod } from "@/features/pos/types";

export interface PosCheckoutContextValue {
  addPaymentMethod: () => void;
  canFinalizeSale: boolean;
  canReturnCashChange: boolean;
  cashChangeDue: number;
  checkoutError: Error | null;
  finalizeSale: () => void;
  handleQuickSale: () => void;
  hasDiscountError: boolean;
  hasPaymentDifference: boolean;
  isCreditSale: boolean;
  isProcessingCheckout: boolean;
  openCheckout: () => void;
  paymentDifference: number;
  payments: PaymentMethod[];
  projectedCreditBalance: number;
  remainingCreditAmount: number;
  removePaymentMethod: (index: number) => void;
  setIsCreditSale: (value: boolean) => void;
  shouldCreateCreditBalance: boolean;
  totalPaid: number;
  updatePayment: (
    index: number,
    field: "method" | "amount" | "reference",
    value: string
  ) => void;
}

const PosCheckoutContext = createContext<PosCheckoutContextValue | null>(null);

export function usePosCheckoutContext() {
  const context = use(PosCheckoutContext);
  if (!context) {
    throw new Error(
      "usePosCheckoutContext must be used within PosCheckoutProvider."
    );
  }
  return context;
}

export function PosCheckoutProvider({ children }: { children: ReactNode }) {
  const { activeMode, buildFinalizeOptions } = usePosSaleMode();
  const { activeShift, requireActiveShift } = usePosShiftContext();
  const { selectedCustomerCreditAccount } = usePosCustomer();
  const { openActiveModal } = usePosModal();

  const checkout = activeMode.checkout;

  const projectedCreditBalance = useMemo(() => {
    if (!selectedCustomerCreditAccount) {
      return checkout.remainingCreditAmount;
    }
    return (
      selectedCustomerCreditAccount.balance + checkout.remainingCreditAmount
    );
  }, [selectedCustomerCreditAccount, checkout.remainingCreditAmount]);

  const openCheckout = useCallback(() => {
    if (!requireActiveShift()) {
      return;
    }
    openActiveModal(POS_MODAL_IDS.CHECKOUT);
  }, [requireActiveShift, openActiveModal]);

  const finalizeSale = useCallback(() => {
    if (!requireActiveShift()) {
      return;
    }
    const shiftId = activeShift?.id;
    if (!(shiftId && checkout.canFinalizeSale)) {
      return;
    }
    activeMode
      .finalizeSale(
        buildSalePaymentsFromInputs(checkout.payments),
        buildFinalizeOptions(shiftId)
      )
      .catch(() => undefined);
  }, [
    requireActiveShift,
    activeShift?.id,
    checkout,
    activeMode,
    buildFinalizeOptions,
  ]);

  const handleQuickSale = useCallback(() => {
    if (!requireActiveShift()) {
      return;
    }
    const shiftId = activeShift?.id;
    if (!shiftId || checkout.hasDiscountError) {
      return;
    }
    activeMode.quickSale(buildFinalizeOptions(shiftId)).catch(() => undefined);
  }, [
    requireActiveShift,
    activeShift?.id,
    activeMode,
    buildFinalizeOptions,
    checkout.hasDiscountError,
  ]);

  const value: PosCheckoutContextValue = {
    addPaymentMethod: checkout.addPaymentMethod,
    canFinalizeSale: checkout.canFinalizeSale && !activeMode.isProcessing,
    canReturnCashChange: checkout.canReturnCashChange,
    cashChangeDue: checkout.cashChangeDue,
    checkoutError: checkout.error ?? activeMode.error,
    finalizeSale,
    handleQuickSale,
    hasDiscountError: checkout.hasDiscountError,
    hasPaymentDifference: checkout.hasPaymentDifference,
    isCreditSale: checkout.isCreditSale,
    isProcessingCheckout: activeMode.isProcessing,
    openCheckout,
    paymentDifference: checkout.paymentDifference,
    payments: checkout.payments,
    projectedCreditBalance,
    remainingCreditAmount: checkout.remainingCreditAmount,
    removePaymentMethod: checkout.removePaymentMethod,
    setIsCreditSale: checkout.setIsCreditSale,
    shouldCreateCreditBalance: checkout.shouldCreateCreditBalance,
    totalPaid: checkout.totalPaid,
    updatePayment: checkout.updatePayment,
  };

  return <PosCheckoutContext value={value}>{children}</PosCheckoutContext>;
}
