import { User, Zap } from "lucide-react";
import { useMemo } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { cn } from "@/lib/utils";

interface CheckoutCustomerSectionProps {
  className?: string;
}

export function CheckoutCustomerSection({
  className,
}: CheckoutCustomerSectionProps) {
  const { state } = usePosPage();

  const selectedCustomer = useMemo(
    () =>
      state.customers.find(
        (customer) => customer.id === state.selectedCustomerId
      ) ?? null,
    [state.customers, state.selectedCustomerId]
  );

  const isQuickSale = !selectedCustomer;
  const label = selectedCustomer?.name ?? "Venta rápida";
  const meta = selectedCustomer
    ? [
        selectedCustomer.documentNumber,
        selectedCustomer.phone,
        selectedCustomer.email,
      ]
        .filter(Boolean)
        .join(" · ") || "Cliente seleccionado"
    : "Sin cliente asociado";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-zinc-800 bg-[#0F0F0F] px-3 py-2.5",
        className
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isQuickSale
            ? "bg-zinc-800 text-zinc-500"
            : "bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]"
        )}
      >
        {isQuickSale ? <Zap className="size-4" /> : <User className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm text-zinc-200">{label}</p>
        <p className="truncate text-xs text-zinc-500">{meta}</p>
      </div>
    </div>
  );
}
