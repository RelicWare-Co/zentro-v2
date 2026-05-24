import { ArrowDownLeft, Pencil, Plus, XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosPage } from "@/features/pos/pos-page-context";
import { formatCurrency } from "@/features/pos/utils";
import {
  inferPaymentModeFromPayments,
  PaymentMethodGridV2,
  type PosV2PaymentMode,
  resolveAvailablePaymentModes,
  resolveMethodIdForMode,
} from "@/features/posv2/components/payment-method-grid-v2";
import {
  posV2OrderBorder,
  posV2OrderInputClassName,
  posV2OrderSurfaceClassName,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

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

function MultiplePaymentsSection() {
  const { state, actions, meta } = usePosPage();
  const paymentMethodById = new Map(
    meta.paymentMethodOptions.map((option) => [option.id, option])
  );

  return (
    <div className="space-y-2">
      {state.payments.map((payment, index) => {
        const selectedMethod = paymentMethodById.get(payment.method);

        return (
          <div
            className={cn("p-2.5", posV2OrderSurfaceClassName)}
            key={payment.id}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium text-[#6b6b6b] text-[10px] uppercase tracking-[0.12em]">
                Pago {index + 1}
              </span>
              {state.payments.length > 1 ? (
                <button
                  aria-label={`Eliminar pago ${index + 1}`}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-red-400 text-xs transition-colors hover:bg-red-400/10"
                  onClick={() => actions.removePaymentMethod(index)}
                  type="button"
                >
                  <XIcon className="size-3" />
                  Quitar
                </button>
              ) : null}
            </div>

            <div className="flex gap-2">
              <select
                className={cn(
                  "h-9 min-w-0 flex-1 rounded-lg px-2 text-white text-xs focus-visible:border-[#dfff06]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dfff06]/10",
                  posV2OrderInputClassName
                )}
                onChange={(event) =>
                  actions.updatePayment(index, "method", event.target.value)
                }
                value={payment.method}
              >
                {meta.paymentMethodOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="relative w-28 shrink-0">
                <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[#6b6b6b] text-xs">
                  $
                </span>
                <Input
                  autoComplete="off"
                  className={cn("h-9 pl-6", posV2OrderInputClassName)}
                  inputMode="numeric"
                  onChange={(event) =>
                    actions.updatePayment(
                      index,
                      "amount",
                      sanitizeMoneyInput(event.target.value)
                    )
                  }
                  type="text"
                  value={formatMoneyInput(payment.amount)}
                />
              </div>
            </div>

            {selectedMethod?.requiresReference ? (
              <Input
                autoComplete="off"
                className={cn("mt-2 h-9", posV2OrderInputClassName)}
                onChange={(event) =>
                  actions.updatePayment(index, "reference", event.target.value)
                }
                placeholder="Referencia"
                value={payment.reference}
              />
            ) : null}
          </div>
        );
      })}

      <Button
        className={cn(
          "h-8 w-full rounded-lg border-dashed bg-transparent text-[#6b6b6b] hover:border-[rgba(255,255,255,0.2)] hover:bg-[#151515] hover:text-white",
          posV2OrderBorder
        )}
        onClick={actions.addPaymentMethod}
        type="button"
        variant="outline"
      >
        <Plus className="mr-1.5 size-3.5" />
        Agregar método
      </Button>
    </div>
  );
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

function AccountCreditSummary() {
  const { state, actions } = usePosPage();
  const selectedCustomer = state.customers.find(
    (customer) => customer.id === state.selectedCustomerId
  );

  return (
    <div className={cn("space-y-2 p-2.5", posV2OrderSurfaceClassName)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-[#6b6b6b] text-[10px] uppercase tracking-[0.12em]">
            Venta a crédito
          </p>
          <p className="truncate text-sm text-white">
            {selectedCustomer?.name ?? "Sin cliente asignado"}
          </p>
          {state.shouldCreateCreditBalance ? (
            <p className="text-amber-300 text-xs">
              Pendiente: {formatCurrency(state.remainingCreditAmount)}
            </p>
          ) : (
            <p className="text-emerald-400 text-xs">Cubierta con el abono</p>
          )}
        </div>
        <Button
          className="h-7 shrink-0 px-2 text-[#dfff06] text-xs hover:bg-[rgba(223,255,6,0.08)]"
          onClick={actions.openCheckoutDetails}
          type="button"
          variant="ghost"
        >
          <Pencil className="mr-1 size-3" />
          Editar
        </Button>
      </div>
    </div>
  );
}

export function CheckoutSectionV2() {
  const { state, actions, meta } = usePosPage();
  const amountReceivedId = useId();
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

  const paymentMethodById = new Map(
    meta.paymentMethodOptions.map((option) => [option.id, option])
  );
  const selectedMethod = paymentMethodById.get(state.payments[0]?.method ?? "");

  return (
    <div className="space-y-2.5">
      <PaymentMethodGridV2
        availableModes={availableModes}
        onSelect={handleModeSelect}
        selectedMode={paymentMode}
      />

      {paymentMode === "accountCredit" ? <AccountCreditSummary /> : null}

      {paymentMode === "multiple" ? <MultiplePaymentsSection /> : null}

      {showCashReceived ? (
        <div>
          <label
            className="mb-1.5 block font-medium text-[#6b6b6b] text-xs"
            htmlFor={amountReceivedId}
          >
            Monto recibido
          </label>
          <Input
            autoComplete="off"
            className={cn("h-9", posV2OrderInputClassName)}
            id={amountReceivedId}
            inputMode="numeric"
            onChange={(event) =>
              actions.updatePayment(
                0,
                "amount",
                sanitizeMoneyInput(event.target.value)
              )
            }
            placeholder="0"
            type="text"
            value={formatMoneyInput(state.payments[0]?.amount ?? "")}
          />
        </div>
      ) : null}

      {paymentMode === "transfer" || paymentMode === "card" ? (
        <div className="space-y-2">
          <div>
            <label
              className="mb-1.5 block font-medium text-[#6b6b6b] text-xs"
              htmlFor={`${amountReceivedId}-amount`}
            >
              Monto
            </label>
            <Input
              autoComplete="off"
              className={cn("h-9", posV2OrderInputClassName)}
              id={`${amountReceivedId}-amount`}
              inputMode="numeric"
              onChange={(event) =>
                actions.updatePayment(
                  0,
                  "amount",
                  sanitizeMoneyInput(event.target.value)
                )
              }
              type="text"
              value={formatMoneyInput(state.payments[0]?.amount ?? "")}
            />
          </div>

          {selectedMethod?.requiresReference ? (
            <Input
              autoComplete="off"
              className={cn("h-9", posV2OrderInputClassName)}
              onChange={(event) =>
                actions.updatePayment(0, "reference", event.target.value)
              }
              placeholder="Referencia (voucher, últimos dígitos...)"
              value={state.payments[0]?.reference ?? ""}
            />
          ) : null}
        </div>
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
