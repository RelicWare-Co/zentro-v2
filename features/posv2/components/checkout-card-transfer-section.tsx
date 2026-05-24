import { useId } from "react";
import { Input } from "@/components/ui/input";
import { usePosPage } from "@/features/pos/pos-page-context";
import { posV2OrderInputClassName } from "@/features/posv2/components/pos-v2-order-styles";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

export function CardTransferCheckoutSection() {
  const { state, actions, meta } = usePosPage();
  const amountReceivedId = useId();
  const paymentMethodById = new Map(
    meta.paymentMethodOptions.map((option) => [option.id, option])
  );
  const selectedMethod = paymentMethodById.get(state.payments[0]?.method ?? "");

  return (
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
  );
}
