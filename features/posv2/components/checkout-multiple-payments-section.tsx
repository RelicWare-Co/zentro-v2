import { Plus, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosPage } from "@/features/pos/pos-page-context";
import {
  posV2OrderBorder,
  posV2OrderInputClassName,
  posV2OrderSurfaceClassName,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

export function MultiplePaymentsSection() {
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
                  placeholder="0"
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
