import { Banknote, Building2, CreditCard, Layers } from "lucide-react";
import {
  posV2OrderBorder,
  posV2OrderSurfaceBg,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn } from "@/lib/utils";

export type PosV2PaymentMode = "cash" | "transfer" | "card" | "multiple";

interface PaymentMethodGridV2Props {
  availableModes: PosV2PaymentMode[];
  className?: string;
  onSelect: (mode: PosV2PaymentMode) => void;
  selectedMode: PosV2PaymentMode;
}

const PAYMENT_MODE_CONFIG: Record<
  PosV2PaymentMode,
  { icon: typeof Banknote; label: string }
> = {
  cash: { icon: Banknote, label: "Efectivo" },
  transfer: { icon: Building2, label: "Transferencia" },
  card: { icon: CreditCard, label: "Crédito" },
  multiple: { icon: Layers, label: "Múltiple" },
};

export function PaymentMethodGridV2({
  availableModes,
  selectedMode,
  onSelect,
  className,
}: PaymentMethodGridV2Props) {
  return (
    <div className={className}>
      <p className="mb-2 font-semibold text-[#6b6b6b] text-[10px] uppercase tracking-[0.14em]">
        Método de pago
      </p>
      <div className="grid grid-cols-2 gap-2">
        {availableModes.map((mode) => {
          const config = PAYMENT_MODE_CONFIG[mode];
          const Icon = config.icon;
          const isActive = selectedMode === mode;

          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 transition-all",
                isActive
                  ? "border-[#dfff06] bg-[rgba(223,255,6,0.06)] text-[#dfff06]"
                  : cn(
                      posV2OrderBorder,
                      posV2OrderSurfaceBg,
                      "text-[#6b6b6b] hover:border-[rgba(255,255,255,0.15)] hover:text-[#a0a0a0]"
                    )
              )}
              key={mode}
              onClick={() => onSelect(mode)}
              type="button"
            >
              <Icon className="size-4" strokeWidth={1.75} />
              <span className="font-medium text-[11px]">{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function resolveAvailablePaymentModes(
  paymentMethodOptions: Array<{ id: string }>
): PosV2PaymentMode[] {
  const enabledIds = new Set(
    paymentMethodOptions.map((option) => option.id.toLowerCase())
  );
  const modes: PosV2PaymentMode[] = [];

  if (enabledIds.has("cash")) {
    modes.push("cash");
  }

  if (
    [...enabledIds].some(
      (id) => id.startsWith("transfer") || id.includes("transfer")
    )
  ) {
    modes.push("transfer");
  }

  if (enabledIds.has("card")) {
    modes.push("card");
  }

  const paymentMethodCount = paymentMethodOptions.length;
  if (paymentMethodCount >= 2) {
    modes.push("multiple");
  }

  return modes;
}

export function resolveMethodIdForMode(
  mode: PosV2PaymentMode,
  paymentMethodOptions: Array<{ id: string }>
): string {
  if (mode === "cash") {
    return (
      paymentMethodOptions.find((option) => option.id.toLowerCase() === "cash")
        ?.id ?? "cash"
    );
  }

  if (mode === "card") {
    return (
      paymentMethodOptions.find((option) => option.id.toLowerCase() === "card")
        ?.id ?? "card"
    );
  }

  if (mode === "transfer") {
    return (
      paymentMethodOptions.find((option) =>
        option.id.toLowerCase().startsWith("transfer")
      )?.id ??
      paymentMethodOptions[0]?.id ??
      "cash"
    );
  }

  return paymentMethodOptions[0]?.id ?? "cash";
}

export function inferPaymentModeFromPayments(
  payments: Array<{ method: string }>,
  paymentMethodOptions: Array<{ id: string }>
): PosV2PaymentMode {
  if (payments.length > 1) {
    return "multiple";
  }

  const methodId = payments[0]?.method.toLowerCase() ?? "cash";

  if (methodId === "cash") {
    return "cash";
  }
  if (methodId === "card") {
    return "card";
  }
  if (methodId.startsWith("transfer")) {
    return "transfer";
  }

  const matchedOption = paymentMethodOptions.find(
    (option) => option.id.toLowerCase() === methodId
  );
  if (matchedOption?.id.toLowerCase().startsWith("transfer")) {
    return "transfer";
  }

  return "cash";
}
