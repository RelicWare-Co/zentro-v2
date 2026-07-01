import { User, Zap } from "lucide-react";
import { CustomerPicker } from "@/features/pos/components/customer-picker";
import { usePosPage } from "@/features/pos/pos-page-context";
import { cn } from "@/lib/utils";

interface CheckoutCustomerSectionProps {
  className?: string;
}

export function CheckoutCustomerSection({
  className,
}: CheckoutCustomerSectionProps) {
  const { state, actions } = usePosPage();

  const selectedCustomer =
    state.customers.find(
      (customer) => customer.id === state.selectedCustomerId
    ) ?? null;

  const isQuickSale = !selectedCustomer;
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
      <CustomerPicker
        buttonClassName="h-auto flex-1 border-0 bg-transparent p-0 hover:bg-transparent hover:text-white"
        contentClassName="w-[min(420px,calc(100vw-2rem))]"
        customers={state.customers}
        onCustomerChange={actions.setSelectedCustomerId}
        selectedCustomerId={state.selectedCustomerId}
      />
    </div>
  );
}
