import { useCallback, useEffect, useMemo, useState } from "react";
import { parseMoneyInput } from "@/lib/utils";
import type { CartItem, CartTotals, PaymentMethod } from "../types";
import { useCreatePosSaleMutation } from "./use-pos-queries";

function getDefaultPaymentMethodId(
  paymentMethodOptions: Array<{ id: string }>
) {
  return paymentMethodOptions[0]?.id ?? "cash";
}

function canCompleteSaleWithCashChange(
  payments: Array<{ method: string; amount: number }>,
  totalAmount: number
) {
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (paidAmount <= totalAmount) {
    return false;
  }

  const hasCashPayment = payments.some(
    (payment) => payment.method.toLowerCase() === "cash" && payment.amount > 0
  );
  if (!hasCashPayment) {
    return false;
  }

  const nonCashPaid = payments.reduce(
    (sum, payment) =>
      payment.method.toLowerCase() === "cash" ? sum : sum + payment.amount,
    0
  );

  return nonCashPaid <= totalAmount;
}

export function usePosCheckout(
  activeShiftId: string | undefined,
  cart: CartItem[],
  cartTotals: CartTotals,
  selectedCustomerId: string,
  discountInput: string,
  clearCart: () => void,
  resetDiscount: () => void,
  paymentMethodOptions: Array<{
    id: string;
    label: string;
    requiresReference: boolean;
  }>,
  allowCreditSales: boolean,
  onSaleCreated?: (payload: {
    result: {
      saleId: string;
      status: string;
      subtotal: number;
      taxAmount: number;
      discountAmount: number;
      totalAmount: number;
      paidAmount: number;
      balanceDue: number;
    };
    snapshot: {
      cart: CartItem[];
      payments: Array<{
        method: string;
        amount: number;
        reference: string | null;
      }>;
      totals: CartTotals;
    };
  }) => void | Promise<void>
) {
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentMethod[]>(() => [
    {
      id: crypto.randomUUID(),
      method: getDefaultPaymentMethodId(paymentMethodOptions),
      amount: "",
      reference: "",
    },
  ]);
  const [isCreditSale, setIsCreditSale] = useState(false);

  const createPosSaleMutation = useCreatePosSaleMutation();

  useEffect(() => {
    const defaultMethodId = getDefaultPaymentMethodId(paymentMethodOptions);
    const enabledMethodIds = new Set(
      paymentMethodOptions.map((paymentMethod) => paymentMethod.id)
    );

    setPayments((currentValue) => {
      if (currentValue.length === 0) {
        return [
          {
            id: crypto.randomUUID(),
            method: defaultMethodId,
            amount: "",
            reference: "",
          },
        ];
      }

      return currentValue.map((payment) =>
        enabledMethodIds.has(payment.method)
          ? payment
          : {
              ...payment,
              method: defaultMethodId,
            }
      );
    });
  }, [paymentMethodOptions]);

  useEffect(() => {
    if (!allowCreditSales) {
      setIsCreditSale(false);
    }
  }, [allowCreditSales]);

  const addPaymentMethod = useCallback(() => {
    const defaultMethodId = getDefaultPaymentMethodId(paymentMethodOptions);
    setPayments((prevPayments) => [
      ...prevPayments,
      {
        id: crypto.randomUUID(),
        method: defaultMethodId,
        amount: "",
        reference: "",
      },
    ]);
  }, [paymentMethodOptions]);

  const removePaymentMethod = useCallback((index: number) => {
    setPayments((prevPayments) => prevPayments.filter((_, i) => i !== index));
  }, []);

  const updatePayment = useCallback(
    (
      index: number,
      field: "method" | "amount" | "reference",
      value: string
    ) => {
      setPayments((prevPayments) =>
        prevPayments.map((payment, paymentIndex) => {
          if (paymentIndex !== index) {
            return payment;
          }
          return { ...payment, [field]: value };
        })
      );
    },
    []
  );

  const resetPayments = useCallback(() => {
    const defaultMethodId = getDefaultPaymentMethodId(paymentMethodOptions);
    setPayments([
      {
        id: crypto.randomUUID(),
        method: defaultMethodId,
        amount: "",
        reference: "",
      },
    ]);
    setIsCreditSale(false);
  }, [paymentMethodOptions]);

  const handleFinalizeSale = useCallback(() => {
    if (!activeShiftId || cart.length === 0) {
      return;
    }

    const saleDiscountAmount = parseMoneyInput(discountInput);

    const salePayments = payments.reduce<
      Array<{ method: string; amount: number; reference: string | null }>
    >((acc, paymentMethod) => {
      const amount = parseMoneyInput(paymentMethod.amount);
      if (amount > 0) {
        acc.push({
          method: paymentMethod.method,
          amount,
          reference: paymentMethod.reference.trim() || null,
        });
      }
      return acc;
    }, []);
    const shouldRegisterAsCreditSale =
      isCreditSale &&
      cartTotals.totalAmount -
        salePayments.reduce((sum, payment) => sum + payment.amount, 0) >
        0;
    const receiptSnapshot = {
      cart: cart.map((item) => ({
        ...item,
        modifiers: item.modifiers.map((modifier) => ({ ...modifier })),
      })),
      payments: salePayments.map((payment) => ({ ...payment })),
      totals: { ...cartTotals },
    };

    createPosSaleMutation.mutate(
      {
        shiftId: activeShiftId,
        customerId: selectedCustomerId || null,
        discountAmount: saleDiscountAmount,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.price,
          taxRate: item.product.taxRate,
          discountAmount: item.discountAmount,
          modifiers: item.modifiers.map((modifier) => ({
            modifierProductId: modifier.id,
            quantity: modifier.quantity,
            unitPrice: modifier.price,
          })),
        })),
        payments: salePayments,
        isCreditSale: shouldRegisterAsCreditSale,
      },
      {
        onSuccess: (result) => {
          Promise.resolve(
            onSaleCreated?.({
              result,
              snapshot: receiptSnapshot,
            })
          ).catch((error) => {
            console.error("No se pudo imprimir el ticket de venta", error);
          });

          setIsCheckoutModalOpen(false);
          clearCart();
          resetDiscount();
          resetPayments();
        },
      }
    );
  }, [
    activeShiftId,
    cart,
    createPosSaleMutation,
    isCreditSale,
    payments,
    cartTotals,
    discountInput,
    selectedCustomerId,
    clearCart,
    resetDiscount,
    resetPayments,
    onSaleCreated,
  ]);

  // Computed values
  const totalPaid = useMemo(
    () =>
      payments.reduce(
        (sum, payment) => sum + parseMoneyInput(payment.amount),
        0
      ),
    [payments]
  );

  const totalAmount = cartTotals.totalAmount;
  const paymentDifference = totalAmount - totalPaid;
  const hasPaymentDifference = paymentDifference !== 0;
  const remainingCreditAmount = Math.max(paymentDifference, 0);
  const shouldCreateCreditBalance = isCreditSale && remainingCreditAmount > 0;
  const canReturnCashChange = useMemo(
    () =>
      canCompleteSaleWithCashChange(
        payments.map((payment) => ({
          method: payment.method,
          amount: parseMoneyInput(payment.amount),
        })),
        totalAmount
      ),
    [payments, totalAmount]
  );
  const cashChangeDue = canReturnCashChange ? Math.abs(paymentDifference) : 0;

  const canFinalizeSale = useMemo(() => {
    if (!activeShiftId || cart.length === 0) {
      return false;
    }
    if (createPosSaleMutation.isPending) {
      return false;
    }
    if (paymentDifference < 0 && !canReturnCashChange) {
      return false;
    }
    if (shouldCreateCreditBalance && !selectedCustomerId) {
      return false;
    }
    if (
      !shouldCreateCreditBalance &&
      hasPaymentDifference &&
      !(paymentDifference < 0 && canReturnCashChange)
    ) {
      return false;
    }
    return true;
  }, [
    activeShiftId,
    cart.length,
    createPosSaleMutation.isPending,
    paymentDifference,
    canReturnCashChange,
    shouldCreateCreditBalance,
    selectedCustomerId,
    hasPaymentDifference,
  ]);

  return {
    // State
    isCheckoutModalOpen,
    setIsCheckoutModalOpen,
    payments,
    isCreditSale,
    setIsCreditSale,

    // Handlers
    addPaymentMethod,
    removePaymentMethod,
    updatePayment,
    handleFinalizeSale,

    // Computed
    totalPaid,
    paymentDifference,
    hasPaymentDifference,
    remainingCreditAmount,
    shouldCreateCreditBalance,
    canReturnCashChange,
    cashChangeDue,
    canFinalizeSale,
    isProcessing: createPosSaleMutation.isPending,
    error: createPosSaleMutation.error,
  };
}
