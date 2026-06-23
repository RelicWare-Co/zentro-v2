import { ArrowDownLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { formatCurrency } from "@/features/pos/utils";
import { AccountCreditSummary } from "@/features/posv2/components/checkout-account-credit-section";
import { CardTransferCheckoutSection } from "@/features/posv2/components/checkout-card-transfer-section";
import { CashCheckoutSection } from "@/features/posv2/components/checkout-cash-section";
import { MultiplePaymentsSection } from "@/features/posv2/components/checkout-multiple-payments-section";
import { PaymentMethodGridV2 } from "@/features/posv2/components/payment-method-grid-v2";
import {
  inferPaymentModeFromPayments,
  type PosV2PaymentMode,
  resolveAvailablePaymentModes,
  resolveMethodIdForMode,
} from "@/features/posv2/components/payment-method-grid-v2.shared";
import {
  posV2AccentBg,
  posV2AccentSoftBg,
  posV2AccentText,
  posV2MutedText,
  posV2OrderBorder,
  posV2OrderSurfaceClassName,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn } from "@/lib/utils";

function getPaymentValidationState(
  paymentMode: PosV2PaymentMode,
  totalAmount: number,
  totalPaid: number,
  canReturnCashChange: boolean,
  selectedCustomerId: string,
  shouldCreateCreditBalance: boolean
) {
  if (totalAmount <= 0) {
    return { isValid: false, message: "Sin monto" };
  }

  if (paymentMode === "accountCredit") {
    if (shouldCreateCreditBalance && !selectedCustomerId) {
      return { isValid: false, message: "Configura cliente en crédito" };
    }
    if (!selectedCustomerId) {
      return { isValid: false, message: "Abre detalles de crédito" };
    }
    return { isValid: true, message: "Venta a crédito lista" };
  }

  if (paymentMode === "cash") {
    if (totalPaid >= totalAmount) {
      return { isValid: true, message: "Monto suficiente" };
    }
    return { isValid: false, message: "Monto insuficiente" };
  }

  if (paymentMode === "multiple") {
    if (totalPaid === totalAmount) {
      return { isValid: true, message: "Pago completo" };
    }
    if (totalPaid > totalAmount) {
      return canReturnCashChange
        ? { isValid: true, message: "Monto suficiente" }
        : { isValid: false, message: "Monto excedido" };
    }
    return { isValid: false, message: "Falta por pagar" };
  }

  if (totalPaid >= totalAmount) {
    return { isValid: true, message: "Monto suficiente" };
  }

  return { isValid: false, message: "Monto insuficiente" };
}

function PaymentSummaryBox({ paymentMode }: { paymentMode: PosV2PaymentMode }) {
  const { state } = usePosPage();
  const changeAmount =
    paymentMode === "cash" && state.canReturnCashChange
      ? state.cashChangeDue
      : Math.max(state.totalPaid - state.totals.totalAmount, 0);

  return (
    <div className={cn("p-3", posV2OrderSurfaceClassName)}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className={posV2MutedText}>Total</span>
          <span className="text-white tabular-nums">
            {formatCurrency(state.totals.totalAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className={posV2MutedText}>Recibido</span>
          <span className={cn("font-medium tabular-nums", posV2AccentText)}>
            {formatCurrency(state.totalPaid)}
          </span>
        </div>
      </div>

      {changeAmount > 0 || state.canReturnCashChange ? (
        <div
          className={cn(
            "mt-2 flex items-center justify-between border-t pt-2",
            posV2OrderBorder
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1.5 font-semibold text-sm",
              posV2AccentText
            )}
          >
            <ArrowDownLeft className="size-4" />
            <span>Cambio</span>
          </div>
          <span
            className={cn("font-bold text-base tabular-nums", posV2AccentText)}
          >
            {formatCurrency(changeAmount)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function CheckoutSectionV2() {
  const { state, actions, meta } = usePosPage();
  const availableModes = resolveAvailablePaymentModes(
    meta.paymentMethodOptions,
    meta.allowCreditSales
  );
  const [paymentMode, setPaymentMode] = useState<PosV2PaymentMode>(() =>
    inferPaymentModeFromPayments(
      state.payments,
      meta.paymentMethodOptions,
      state.isCreditSale,
      meta.allowCreditSales
    )
  );

  const effectivePaymentMode = useMemo(
    () =>
      availableModes.includes(paymentMode)
        ? paymentMode
        : (availableModes[0] ?? "cash"),
    [availableModes, paymentMode]
  );

  const handleModeSelect = (mode: PosV2PaymentMode) => {
    if (mode === "accountCredit") {
      actions.setIsCreditSale(true);
      setPaymentMode("accountCredit");
      const cashMethodId = resolveMethodIdForMode(
        "cash",
        meta.paymentMethodOptions
      );
      actions.updatePayment(0, "method", cashMethodId);
      actions.updatePayment(0, "amount", "");
      actions.openCheckoutDetails();
      return;
    }

    if (effectivePaymentMode === "accountCredit") {
      actions.setIsCreditSale(false);
    }

    setPaymentMode(mode);

    if (mode === "multiple") {
      if (state.payments.length === 1) {
        actions.addPaymentMethod();
      }
      return;
    }

    for (let index = state.payments.length - 1; index > 0; index--) {
      actions.removePaymentMethod(index);
    }

    const methodId = resolveMethodIdForMode(mode, meta.paymentMethodOptions);
    actions.updatePayment(0, "method", methodId);
    actions.updatePayment(
      0,
      "amount",
      mode === "cash" ? "" : String(state.totals.totalAmount)
    );
  };

  const validation = getPaymentValidationState(
    effectivePaymentMode,
    state.totals.totalAmount,
    state.totalPaid,
    state.canReturnCashChange,
    state.selectedCustomerId,
    state.shouldCreateCreditBalance
  );
  const showCashReceived = effectivePaymentMode === "cash";
  const showChangeSummary =
    effectivePaymentMode === "cash" ||
    (effectivePaymentMode === "multiple" && state.totalPaid > 0);

  return (
    <div className="space-y-2.5">
      <PaymentMethodGridV2
        availableModes={availableModes}
        onSelect={handleModeSelect}
        selectedMode={effectivePaymentMode}
      />

      {effectivePaymentMode === "accountCredit" ? (
        <AccountCreditSummary />
      ) : null}

      {effectivePaymentMode === "multiple" ? <MultiplePaymentsSection /> : null}

      {showCashReceived ? <CashCheckoutSection /> : null}

      {effectivePaymentMode === "transfer" ||
      effectivePaymentMode === "card" ? (
        <CardTransferCheckoutSection />
      ) : null}

      {showChangeSummary ? (
        <PaymentSummaryBox paymentMode={effectivePaymentMode} />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 rounded-full",
              validation.isValid ? posV2AccentBg : "bg-red-400"
            )}
          />
          <span className={cn("text-xs", posV2MutedText)}>
            {validation.message}
          </span>
        </div>
        {validation.isValid ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium text-[10px]",
              posV2AccentSoftBg,
              posV2AccentText
            )}
          >
            Válido
          </span>
        ) : null}
      </div>

      {effectivePaymentMode === "multiple" && state.paymentDifference > 0 ? (
        <p className={cn("text-xs", posV2MutedText)}>
          Falta por pagar: {formatCurrency(state.paymentDifference)}
        </p>
      ) : null}

      {state.checkoutError instanceof Error ? (
        <p className="text-red-400 text-xs">{state.checkoutError.message}</p>
      ) : null}
    </div>
  );
}
