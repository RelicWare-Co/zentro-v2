import {
  getPaymentModeConfig,
  type PosV2PaymentMode,
} from "@/features/posv2/components/payment-method-grid-v2.shared";
import {
  posV2AccentBorder,
  posV2AccentSoftBg,
  posV2AccentText,
  posV2MutedText,
  posV2OrderBorder,
  posV2OrderHoverBorder,
  posV2OrderSurfaceBg,
  posV2SubtleHoverText,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn } from "@/lib/utils";

interface PaymentMethodGridV2Props {
  allowCreditSales?: boolean;
  availableModes: PosV2PaymentMode[];
  className?: string;
  onSelect: (mode: PosV2PaymentMode) => void;
  selectedMode: PosV2PaymentMode;
}

export function PaymentMethodGridV2({
  availableModes,
  selectedMode,
  onSelect,
  className,
}: PaymentMethodGridV2Props) {
  return (
    <div className={className}>
      <p
        className={cn(
          "mb-2 font-semibold text-[10px] uppercase tracking-[0.14em]",
          posV2MutedText
        )}
      >
        Método de pago
      </p>
      <div className="grid grid-cols-3 gap-2">
        {availableModes.map((mode) => {
          const config = getPaymentModeConfig(mode);
          const Icon = config.icon;
          const isActive = selectedMode === mode;

          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 transition-all",
                isActive
                  ? `${posV2AccentBorder} ${posV2AccentSoftBg} ${posV2AccentText}`
                  : cn(
                      posV2OrderBorder,
                      posV2OrderSurfaceBg,
                      posV2MutedText,
                      posV2OrderHoverBorder,
                      posV2SubtleHoverText
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
