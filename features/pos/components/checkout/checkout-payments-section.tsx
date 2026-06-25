import { Button, Select, TextInput } from "@mantine/core";
import { Plus, XIcon } from "lucide-react";
import { useId, useRef } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

const paymentFieldClassName =
  "h-10 touch-manipulation rounded-lg border-zinc-700 bg-[#151515] py-0 text-base text-white md:text-sm";

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
              <TextInput
                autoComplete="off"
                autoFocus={autoFocusFirstAmount && isFirstPayment}
                classNames={{ input: `${paymentFieldClassName} w-full` }}
                id={`${amountId}-${index}`}
                inputMode="numeric"
                leftSection={<span className="text-zinc-500">$</span>}
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
            ) : (
              <div className="flex gap-2">
                <Select
                  className="flex-1"
                  data={meta.paymentMethodOptions.map(
                    (paymentMethodOption) => ({
                      value: paymentMethodOption.id,
                      label: paymentMethodOption.label,
                    })
                  )}
                  id={`${methodId}-${index}`}
                  onChange={(value) =>
                    actions.updatePayment(index, "method", value ?? "")
                  }
                  placeholder="Método"
                  value={payment.method}
                />

                <TextInput
                  autoComplete="off"
                  autoFocus={autoFocusFirstAmount && isFirstPayment}
                  className="flex-1"
                  classNames={{ input: paymentFieldClassName }}
                  id={`${amountId}-${index}`}
                  inputMode="numeric"
                  leftSection={<span className="text-zinc-500">$</span>}
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
            )}

            {selectedPaymentMethod?.requiresReference ? (
              <TextInput
                autoComplete="off"
                classNames={{
                  input:
                    "h-10 touch-manipulation border-zinc-700 bg-[#151515] text-base focus-visible:border-[var(--color-voltage)] md:h-9 md:text-sm",
                }}
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
        className="w-full border-zinc-700 border-dashed bg-transparent text-zinc-400 hover:border-zinc-500 hover:text-white"
        leftSection={<Plus className="size-4" />}
        onClick={actions.addPaymentMethod}
        variant="outline"
      >
        Dividir Pago (Otro método)
      </Button>
    </div>
  );
}
