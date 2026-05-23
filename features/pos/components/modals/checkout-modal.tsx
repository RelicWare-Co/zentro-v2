import { Plus, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerPicker } from "@/features/pos/components/customer-picker";
import type { PaymentMethod, PosCustomer } from "@/features/pos/types";
import { formatCurrency } from "@/features/pos/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

interface CheckoutModalProps {
  allowCreditSales: boolean;
  canFinalize: boolean;
  canReturnCashChange: boolean;
  cashChangeDue: number;
  customers: PosCustomer[];
  discountInput: string;
  error: Error | null;
  hasPaymentDifference: boolean;
  isCreditSale: boolean;
  isOpen: boolean;
  isProcessing: boolean;
  onAddPaymentMethod: () => void;
  onClose: () => void;
  onConfirm: () => void;
  onCustomerChange: (customerId: string) => void;
  onRemovePaymentMethod: (index: number) => void;
  onUpdatePayment: (
    index: number,
    field: "method" | "amount" | "reference",
    value: string
  ) => void;
  paymentDifference: number;
  paymentMethodOptions: Array<{
    id: string;
    label: string;
    requiresReference: boolean;
  }>;
  payments: PaymentMethod[];
  projectedCreditBalance: number;
  remainingCreditAmount: number;
  selectedCustomerCreditAccount: { balance: number } | null;
  selectedCustomerId: string;
  setDiscountInput: (value: string) => void;
  setIsCreditSale: (value: boolean) => void;
  shouldCreateCreditBalance: boolean;
  totalAmount: number;
}

const paymentFieldClassName =
  "h-10 touch-manipulation rounded-lg border-zinc-700 bg-[#151515] py-0 text-base text-white md:text-sm";
const paymentSelectFieldClassName =
  "data-[size=default]:h-10 data-[size=default]:rounded-lg";

function getFooterLabel(
  isCreditSale: boolean,
  canReturnCashChange: boolean
): string {
  if (isCreditSale) {
    return "Saldo que quedará a crédito:";
  }
  if (canReturnCashChange) {
    return "Cambio a devolver:";
  }
  return "Diferencia de pago:";
}

function getFooterValue(
  isCreditSale: boolean,
  canReturnCashChange: boolean,
  paymentDifference: number,
  cashChangeDue: number
): number {
  if (isCreditSale) {
    return Math.abs(paymentDifference);
  }
  if (canReturnCashChange) {
    return cashChangeDue;
  }
  return Math.abs(paymentDifference);
}

function getFooterValueClassName(
  isCreditSale: boolean,
  shouldCreateCreditBalance: boolean,
  canReturnCashChange: boolean,
  paymentDifference: number
): string {
  if (isCreditSale) {
    if (shouldCreateCreditBalance) {
      return "text-[var(--color-voltage)]";
    }
    return "text-green-400";
  }
  if (canReturnCashChange) {
    return "text-[var(--color-voltage)]";
  }
  if (paymentDifference === 0) {
    return "text-green-400";
  }
  if (paymentDifference > 0) {
    return "text-red-400";
  }
  return "text-amber-400";
}

function getConfirmButtonText(
  isProcessing: boolean,
  shouldCreateCreditBalance: boolean
): string {
  if (isProcessing) {
    return "Procesando...";
  }
  if (shouldCreateCreditBalance) {
    return "Registrar Venta con Saldo";
  }
  return "Finalizar Venta";
}

interface DiscountSectionProps {
  discountEnabledId: string;
  discountInput: string;
  discountInputId: string;
  discountInputRef: React.RefObject<HTMLInputElement | null>;
  isDiscountEnabled: boolean;
  isMobile: boolean;
  setDiscountInput: (value: string) => void;
  setIsDiscountEnabled: (value: boolean) => void;
}

function DiscountSection({
  discountEnabledId,
  discountInput,
  discountInputId,
  discountInputRef,
  isDiscountEnabled,
  isMobile,
  setDiscountInput,
  setIsDiscountEnabled,
}: DiscountSectionProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#0a0a0a] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm text-zinc-200">Aplicar descuento</p>
          <p className="text-xs text-zinc-500">
            Actívalo solo cuando la orden lo necesite.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isDiscountEnabled}
            className="border-zinc-600 data-[state=checked]:border-[var(--color-voltage)] data-[state=checked]:bg-[var(--color-voltage)] data-[state=checked]:text-black"
            id={discountEnabledId}
            onCheckedChange={(checked) => {
              const nextValue = checked === true;
              setIsDiscountEnabled(nextValue);
              if (!nextValue) {
                setDiscountInput("0");
                return;
              }
              if (isMobile) {
                return;
              }

              window.setTimeout(() => {
                discountInputRef.current?.focus();
                discountInputRef.current?.select();
              }, 0);
            }}
          />
          <label
            className="cursor-pointer text-sm text-zinc-300"
            htmlFor={discountEnabledId}
          >
            Agregar
          </label>
        </div>
      </div>

      {isDiscountEnabled ? (
        <div className="relative mt-3">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500">
            $
          </span>
          <Input
            autoComplete="off"
            className="h-10 touch-manipulation border-zinc-700 bg-[#151515] pl-7 text-base focus-visible:border-[var(--color-voltage)] focus-visible:ring-0 md:text-sm"
            id={discountInputId}
            inputMode="numeric"
            onChange={(event) =>
              setDiscountInput(sanitizeMoneyInput(event.target.value))
            }
            ref={discountInputRef}
            type="text"
            value={formatMoneyInput(discountInput)}
          />
        </div>
      ) : null}
    </div>
  );
}

interface CreditSaleWarningsProps {
  isCreditSale: boolean;
  projectedCreditBalance: number;
  remainingCreditAmount: number;
  selectedCustomerCreditAccount: { balance: number } | null;
  selectedCustomerId: string;
  shouldCreateCreditBalance: boolean;
}

function CreditSaleWarnings({
  isCreditSale,
  projectedCreditBalance,
  remainingCreditAmount,
  selectedCustomerCreditAccount,
  selectedCustomerId,
  shouldCreateCreditBalance,
}: CreditSaleWarningsProps) {
  return (
    <>
      {shouldCreateCreditBalance && !selectedCustomerId && (
        <p className="text-amber-400 text-sm">
          Selecciona un cliente para registrar venta a crédito.
        </p>
      )}

      {shouldCreateCreditBalance &&
        selectedCustomerId &&
        !selectedCustomerCreditAccount && (
          <p className="text-amber-300 text-sm">
            Se creará la cuenta de crédito del cliente con el saldo pendiente de
            esta venta.
          </p>
        )}

      {isCreditSale && (
        <p className="text-sm text-zinc-400">
          {shouldCreateCreditBalance
            ? "Puedes registrar un abono inicial ahora y el restante quedará pendiente en la cuenta del cliente."
            : "Con los descuentos y pagos actuales no quedará saldo pendiente, así que la venta se registrará como pagada."}
        </p>
      )}

      {selectedCustomerCreditAccount && (
        <div className="space-y-1 rounded-lg border border-amber-900/40 bg-amber-900/20 p-3 text-sm">
          <p className="font-medium text-amber-300">
            Saldo pendiente actual:{" "}
            {formatCurrency(selectedCustomerCreditAccount.balance)}
          </p>
          {isCreditSale && (
            <>
              <p className="text-amber-200">
                {shouldCreateCreditBalance
                  ? "Saldo que quedará pendiente por esta venta: "
                  : "Saldo pendiente por esta venta: "}
                {formatCurrency(remainingCreditAmount)}
              </p>
              {shouldCreateCreditBalance ? (
                <p className="text-amber-200">
                  Saldo proyectado total tras esta venta:{" "}
                  {formatCurrency(projectedCreditBalance)}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </>
  );
}

interface PaymentMethodsSectionProps {
  onAddPaymentMethod: () => void;
  onRemovePaymentMethod: (index: number) => void;
  onUpdatePayment: (
    index: number,
    field: "method" | "amount" | "reference",
    value: string
  ) => void;
  paymentAmountInputRef: React.RefObject<HTMLInputElement | null>;
  paymentMethodOptions: Array<{
    id: string;
    label: string;
    requiresReference: boolean;
  }>;
  payments: PaymentMethod[];
}

function PaymentMethodsSection({
  onAddPaymentMethod,
  onRemovePaymentMethod,
  onUpdatePayment,
  paymentAmountInputRef,
  paymentMethodOptions,
  payments,
}: PaymentMethodsSectionProps) {
  const paymentMethodById = new Map(
    paymentMethodOptions.map((paymentMethod) => [
      paymentMethod.id,
      paymentMethod,
    ])
  );

  return (
    <div className="space-y-3">
      {payments.map((payment, index) => {
        const selectedPaymentMethod = paymentMethodById.get(payment.method);

        return (
          <div
            className="relative flex flex-col gap-2 rounded-lg border border-zinc-800 bg-[#0a0a0a] p-3"
            key={payment.id}
          >
            {payments.length > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-xs text-zinc-500 uppercase tracking-[0.14em]">
                  Pago {index + 1}
                </p>
                <button
                  aria-label={`Eliminar método de pago ${index + 1}`}
                  className="inline-flex h-8 touch-manipulation items-center gap-1 rounded-md px-2 text-red-400 text-sm transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                  onClick={() => onRemovePaymentMethod(index)}
                  type="button"
                >
                  <XIcon className="size-3.5" />
                  <span>Quitar</span>
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <Select
                onValueChange={(value) =>
                  onUpdatePayment(index, "method", value)
                }
                value={payment.method}
              >
                <SelectTrigger
                  className={`${paymentFieldClassName} ${paymentSelectFieldClassName} flex-1 px-3 [&_[data-slot=select-value]]:leading-none`}
                >
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-[#151515] text-white">
                  {paymentMethodOptions.map((paymentMethodOption) => (
                    <SelectItem
                      key={paymentMethodOption.id}
                      value={paymentMethodOption.id}
                    >
                      {paymentMethodOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500">
                  $
                </span>
                <Input
                  autoComplete="off"
                  className={`${paymentFieldClassName} pl-7`}
                  inputMode="numeric"
                  onChange={(e) =>
                    onUpdatePayment(
                      index,
                      "amount",
                      sanitizeMoneyInput(e.target.value)
                    )
                  }
                  placeholder="Monto"
                  ref={index === 0 ? paymentAmountInputRef : undefined}
                  type="text"
                  value={formatMoneyInput(payment.amount)}
                />
              </div>
            </div>

            {selectedPaymentMethod?.requiresReference ? (
              <Input
                autoComplete="off"
                className="h-10 touch-manipulation border-zinc-700 bg-[#151515] text-base focus-visible:border-[var(--color-voltage)] focus-visible:ring-0 md:h-9 md:text-sm"
                onChange={(e) =>
                  onUpdatePayment(index, "reference", e.target.value)
                }
                placeholder="Referencia (Ej. últimos 4 dígitos o voucher)"
                value={payment.reference}
              />
            ) : null}
          </div>
        );
      })}

      <Button
        className="h-9 w-full border-zinc-700 border-dashed bg-transparent text-zinc-400 hover:border-zinc-500 hover:text-white"
        onClick={onAddPaymentMethod}
        variant="outline"
      >
        <Plus className="mr-2 size-4" />
        Dividir Pago (Otro método)
      </Button>
    </div>
  );
}

export function CheckoutModal({
  isOpen,
  onClose,
  totalAmount,
  discountInput,
  setDiscountInput,
  payments,
  paymentMethodOptions,
  allowCreditSales,
  isCreditSale,
  setIsCreditSale,
  customers,
  selectedCustomerId,
  onCustomerChange,
  selectedCustomerCreditAccount,
  projectedCreditBalance,
  remainingCreditAmount,
  shouldCreateCreditBalance,
  canFinalize,
  isProcessing,
  paymentDifference,
  hasPaymentDifference,
  canReturnCashChange,
  cashChangeDue,
  error,
  onAddPaymentMethod,
  onRemovePaymentMethod,
  onUpdatePayment,
  onConfirm,
}: CheckoutModalProps) {
  const paymentAmountInputRef = useRef<HTMLInputElement | null>(null);
  const discountInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();
  const discountInputId = useId();
  const discountEnabledId = useId();
  const creditSaleId = useId();
  const [isDiscountEnabled, setIsDiscountEnabled] = useState(
    Number(discountInput) > 0
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsDiscountEnabled(Number(discountInput) > 0);
    if (isMobile) {
      return;
    }

    const focusTimeout = window.setTimeout(() => {
      paymentAmountInputRef.current?.focus();
      paymentAmountInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimeout);
  }, [discountInput, isMobile, isOpen]);

  const footerLabel = getFooterLabel(isCreditSale, canReturnCashChange);
  const footerValue = getFooterValue(
    isCreditSale,
    canReturnCashChange,
    paymentDifference,
    cashChangeDue
  );
  const footerValueClassName = getFooterValueClassName(
    isCreditSale,
    shouldCreateCreditBalance,
    canReturnCashChange,
    paymentDifference
  );

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Cobrar Orden</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#0a0a0a] p-4">
            <span className="font-medium text-zinc-400">Total a Pagar</span>
            <span className="font-bold text-3xl text-[var(--color-voltage)]">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-800 bg-[#0a0a0a] p-3">
              <div className="space-y-1">
                <p className="font-medium text-sm text-zinc-200">
                  Cliente de la venta
                </p>
                <p className="text-xs text-zinc-500">
                  Puedes asignarlo aquí mismo antes de finalizar el cobro.
                </p>
              </div>
              <CustomerPicker
                buttonClassName="mt-3 h-auto w-full justify-between border-zinc-700 bg-[#151515] hover:bg-[#151515]"
                contentClassName="w-[min(420px,calc(100vw-2rem))]"
                customers={customers}
                onCustomerChange={onCustomerChange}
                selectedCustomerId={selectedCustomerId}
              />
            </div>

            <DiscountSection
              discountEnabledId={discountEnabledId}
              discountInput={discountInput}
              discountInputId={discountInputId}
              discountInputRef={discountInputRef}
              isDiscountEnabled={isDiscountEnabled}
              isMobile={isMobile}
              setDiscountInput={setDiscountInput}
              setIsDiscountEnabled={setIsDiscountEnabled}
            />

            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-zinc-300">
                Métodos de Pago
              </h4>
              {allowCreditSales ? (
                <div className="flex items-center gap-2">
                  <input
                    checked={isCreditSale}
                    className="size-4 rounded border-zinc-700 bg-[#0a0a0a] text-[var(--color-voltage)] focus:ring-[var(--color-voltage)]"
                    id={creditSaleId}
                    onChange={(e) => setIsCreditSale(e.target.checked)}
                    type="checkbox"
                  />
                  <label
                    className="cursor-pointer text-sm text-zinc-400"
                    htmlFor={creditSaleId}
                  >
                    Dejar saldo a crédito
                  </label>
                </div>
              ) : (
                <span className="text-sm text-zinc-500">
                  Crédito deshabilitado en ajustes
                </span>
              )}
            </div>

            <CreditSaleWarnings
              isCreditSale={isCreditSale}
              projectedCreditBalance={projectedCreditBalance}
              remainingCreditAmount={remainingCreditAmount}
              selectedCustomerCreditAccount={selectedCustomerCreditAccount}
              selectedCustomerId={selectedCustomerId}
              shouldCreateCreditBalance={shouldCreateCreditBalance}
            />

            <PaymentMethodsSection
              onAddPaymentMethod={onAddPaymentMethod}
              onRemovePaymentMethod={onRemovePaymentMethod}
              onUpdatePayment={onUpdatePayment}
              paymentAmountInputRef={paymentAmountInputRef}
              paymentMethodOptions={paymentMethodOptions}
              payments={payments}
            />
          </div>

          <div className="flex items-center justify-between border-zinc-800 border-t pt-2 text-sm">
            <span className="text-zinc-400">{footerLabel}</span>
            <span className={`font-semibold ${footerValueClassName}`}>
              {formatCurrency(footerValue)}
            </span>
          </div>

          {!isCreditSale && canReturnCashChange && hasPaymentDifference ? (
            <p className="text-sm text-zinc-400">
              El sistema registrará el valor recibido y mostrará este monto como
              vuelto para el cajero.
            </p>
          ) : null}

          {error instanceof Error && (
            <p className="text-red-400 text-sm">{error.message}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            className="text-zinc-400 hover:text-white"
            onClick={onClose}
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
            disabled={!canFinalize || isProcessing}
            onClick={onConfirm}
          >
            {getConfirmButtonText(isProcessing, shouldCreateCreditBalance)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
