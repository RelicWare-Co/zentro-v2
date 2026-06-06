import { Plus, XIcon } from "lucide-react";
import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePosPage } from "@/features/pos/pos-page-context";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

const paymentFieldClassName =
  "h-10 touch-manipulation rounded-lg border-zinc-700 bg-[#151515] py-0 text-base text-white md:text-sm";
const paymentSelectFieldClassName =
  "data-[size=default]:h-10 data-[size=default]:rounded-lg";

interface CheckoutPaymentsSectionProps {
  autoFocusFirstAmount?: boolean;
  compactMode?: boolean;
  paymentAmountInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function CheckoutPaymentsSection({
  autoFocusFirstAmount = false,
  compactMode = false,
  paymentAmountInputRef: externalRef,
}: CheckoutPaymentsSectionProps) {
  const { state, actions, meta } = usePosPage();
  const internalRef = useRef<HTMLInputElement | null>(null);
  const paymentAmountInputRef = externalRef ?? internalRef;
  const methodId = useId();
  const amountId = useId();

  const paymentMethodById = new Map(
    meta.paymentMethodOptions.map((paymentMethod) => [
      paymentMethod.id,
      paymentMethod,
    ])
  );

  return (
    <div className="space-y-3">
      {state.payments.map((payment, index) => {
        const selectedPaymentMethod = paymentMethodById.get(payment.method);
        const isFirstPayment = index === 0;
        const isSinglePayment = state.payments.length === 1;
        const showCompact = compactMode && isSinglePayment && isFirstPayment;

        return (
          <div
            className={cn(
              "relative flex flex-col gap-2",
              !showCompact &&
                "rounded-lg border border-zinc-800 bg-[#0a0a0a] p-3"
            )}
            key={payment.id}
          >
            {state.payments.length > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-xs text-zinc-500 uppercase tracking-[0.14em]">
                  Pago {index + 1}
                </p>
                <button
                  aria-label={`Eliminar método de pago ${index + 1}`}
                  className="inline-flex h-8 touch-manipulation items-center gap-1 rounded-md px-2 text-red-400 text-sm transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                  onClick={() => actions.removePaymentMethod(index)}
                  type="button"
                >
                  <XIcon className="size-3.5" />
                  <span>Quitar</span>
                </button>
              </div>
            )}

            {showCompact ? (
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500">
                  $
                </span>
                <Input
                  autoComplete="off"
                  autoFocus={autoFocusFirstAmount && isFirstPayment}
                  className={`${paymentFieldClassName} w-full pl-7`}
                  id={`${amountId}-${index}`}
                  inputMode="numeric"
                  onChange={(e) =>
                    actions.updatePayment(
                      index,
                      "amount",
                      sanitizeMoneyInput(e.target.value)
                    )
                  }
                  placeholder="Monto"
                  ref={isFirstPayment ? paymentAmountInputRef : undefined}
                  type="text"
                  value={formatMoneyInput(payment.amount)}
                />
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  onValueChange={(value) =>
                    actions.updatePayment(index, "method", value)
                  }
                  value={payment.method}
                >
                  <SelectTrigger
                    className={`${paymentFieldClassName} ${paymentSelectFieldClassName} flex-1 px-3 [&_[data-slot=select-value]]:leading-none`}
                    id={`${methodId}-${index}`}
                  >
                    <SelectValue placeholder="Método" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-[#151515] text-white">
                    {meta.paymentMethodOptions.map((paymentMethodOption) => (
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
                    autoFocus={autoFocusFirstAmount && isFirstPayment}
                    className={`${paymentFieldClassName} pl-7`}
                    id={`${amountId}-${index}`}
                    inputMode="numeric"
                    onChange={(e) =>
                      actions.updatePayment(
                        index,
                        "amount",
                        sanitizeMoneyInput(e.target.value)
                      )
                    }
                    placeholder="Monto"
                    ref={isFirstPayment ? paymentAmountInputRef : undefined}
                    type="text"
                    value={formatMoneyInput(payment.amount)}
                  />
                </div>
              </div>
            )}

            {selectedPaymentMethod?.requiresReference ? (
              <Input
                autoComplete="off"
                className="h-10 touch-manipulation border-zinc-700 bg-[#151515] text-base focus-visible:border-[var(--color-voltage)] focus-visible:ring-0 md:h-9 md:text-sm"
                id={`${amountId}-ref-${index}`}
                onChange={(e) =>
                  actions.updatePayment(index, "reference", e.target.value)
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
        onClick={actions.addPaymentMethod}
        variant="outline"
      >
        <Plus className="mr-2 size-4" />
        Dividir Pago (Otro método)
      </Button>
    </div>
  );
}
