import { ArrowDownLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { formatCurrency } from "@/features/pos/utils";
import { AccountCreditSummary } from "@/features/posv2/components/checkout-account-credit-section";
import { CardTransferCheckoutSection } from "@/features/posv2/components/checkout-card-transfer-section";
import { CashCheckoutSection } from "@/features/posv2/components/checkout-cash-section";
import { MultiplePaymentsSection } from "@/features/posv2/components/checkout-multiple-payments-section";
import {
  inferPaymentModeFromPayments,
  PaymentMethodGridV2,
  type PosV2PaymentMode,
  resolveAvailablePaymentModes,
  resolveMethodIdForMode,
} from "@/features/posv2/components/payment-method-grid-v2";
import {
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
          <span className="text-[#6b6b6b]">Total</span>
          <span className="text-white tabular-nums">
            {formatCurrency(state.totals.totalAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6b6b6b]">Recibido</span>
          <span className="font-medium text-[#dfff06] tabular-nums">
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
          <div className="flex items-center gap-1.5 font-semibold text-[#dfff06] text-sm">
            <ArrowDownLeft className="size-4" />
            <span>Cambio</span>
          </div>
          <span className="font-bold text-[#dfff06] text-base tabular-nums">
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

  useEffect(() => {
    if (availableModes.length === 0) {
      return;
    }

    if (!availableModes.includes(paymentMode)) {
      setPaymentMode(availableModes[0] ?? "cash");
    }
  }, [availableModes, paymentMode]);

  useEffect(() => {
    if (paymentMode !== "multiple" && state.payments.length > 1) {
      actions.removePaymentMethod(state.payments.length - 1);
    }
  }, [paymentMode, state.payments.length, actions]);

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

    if (paymentMode === "accountCredit") {
      actions.setIsCreditSale(false);
    }

    setPaymentMode(mode);

    if (mode === "multiple") {
      if (state.payments.length === 1) {
        actions.addPaymentMethod();
      }
      return;
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
    paymentMode,
    state.totals.totalAmount,
    state.totalPaid,
    state.canReturnCashChange,
    state.selectedCustomerId,
    state.shouldCreateCreditBalance
  );
  const showCashReceived = paymentMode === "cash";
  const showChangeSummary =
    paymentMode === "cash" ||
    (paymentMode === "multiple" && state.totalPaid > 0);

  return (
    <div className="space-y-2.5">
      <PaymentMethodGridV2
        availableModes={availableModes}
        onSelect={handleModeSelect}
        selectedMode={paymentMode}
      />

      {paymentMode === "accountCredit" ? <AccountCreditSummary /> : null}

      {paymentMode === "multiple" ? <MultiplePaymentsSection /> : null}

      {showCashReceived ? <CashCheckoutSection /> : null}

      {paymentMode === "transfer" || paymentMode === "card" ? (
        <CardTransferCheckoutSection />
      ) : null}

      {showChangeSummary ? (
        <PaymentSummaryBox paymentMode={paymentMode} />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 rounded-full",
              validation.isValid ? "bg-[#dfff06]" : "bg-red-400"
            )}
          />
          <span className="text-[#6b6b6b] text-xs">{validation.message}</span>
        </div>
        {validation.isValid ? (
          <span className="rounded-full bg-[rgba(223,255,6,0.12)] px-2 py-0.5 font-medium text-[#dfff06] text-[10px]">
            Válido
          </span>
        ) : null}
      </div>

      {paymentMode === "multiple" && state.paymentDifference > 0 ? (
        <p className="text-[#6b6b6b] text-xs">
          Falta por pagar: {formatCurrency(state.paymentDifference)}
        </p>
      ) : null}

      {state.checkoutError instanceof Error ? (
        <p className="text-red-400 text-xs">{state.checkoutError.message}</p>
      ) : null}
    </div>
  );
}
