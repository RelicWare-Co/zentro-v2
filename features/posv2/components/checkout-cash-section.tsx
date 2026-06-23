import { TextInput } from "@mantine/core";
import { useId } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import {
  posV2MutedText,
  posV2OrderInputClassName,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn, formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

export function CashCheckoutSection() {
  const { state, actions } = usePosPage();
  const amountReceivedId = useId();

  return (
    <div>
      <label
        className={cn("mb-1.5 block font-medium text-xs", posV2MutedText)}
        htmlFor={amountReceivedId}
      >
        Monto recibido
      </label>
      <TextInput
        autoComplete="off"
        classNames={{ input: cn("h-9", posV2OrderInputClassName) }}
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
  );
}
