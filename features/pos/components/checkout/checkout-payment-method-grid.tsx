import {
  Banknote,
  Building2,
  CircleDollarSign,
  CreditCard,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentMethodGridProps {
  className?: string;
  onSelect: (methodId: string) => void;
  paymentMethodOptions: Array<{ id: string; label: string }>;
  selectedMethodId: string;
}

const methodIconMap: Record<string, typeof Banknote> = {
  card: CreditCard,
  cash: Banknote,
  nequi: Smartphone,
  transfer: Building2,
};

function getIconForMethod(methodId: string): typeof Banknote {
  const id = methodId.toLowerCase();
  if (methodIconMap[id]) {
    return methodIconMap[id];
  }
  if (id.includes("cash")) {
    return Banknote;
  }
  if (id.includes("card")) {
    return CreditCard;
  }
  if (id.includes("transfer")) {
    return Building2;
  }
  if (id.includes("nequi")) {
    return Smartphone;
  }
  return CircleDollarSign;
}

export function PaymentMethodGrid({
  className,
  onSelect,
  paymentMethodOptions,
  selectedMethodId,
}: PaymentMethodGridProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {paymentMethodOptions.map((method) => {
        const Icon = getIconForMethod(method.id);
        const isActive = selectedMethodId === method.id;
        return (
          <button
            aria-pressed={isActive}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-lg border px-1 py-3 transition-all",
              isActive
                ? "border-[var(--color-voltage)] bg-[rgba(223,255,6,0.08)] text-[var(--color-voltage)]"
                : "border-zinc-800 bg-[#0F0F0F] text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
            )}
            key={method.id}
            onClick={() => onSelect(method.id)}
            type="button"
          >
            <Icon className="size-5" strokeWidth={1.5} />
            <span className="font-medium text-[11px]">{method.label}</span>
          </button>
        );
      })}
    </div>
  );
}
