import { CustomerPicker } from "@/features/pos/components/customer-picker";
import { usePosPage } from "@/features/pos/pos-page-context";
import { cn } from "@/lib/utils";

interface CheckoutCustomerSectionProps {
  buttonClassName?: string;
  className?: string;
  contentClassName?: string;
  description?: string;
  title?: string;
}

export function CheckoutCustomerSection({
  className,
  title = "Cliente de la venta",
  description = "Puedes asignarlo aquí mismo antes de finalizar el cobro.",
  buttonClassName,
  contentClassName,
}: CheckoutCustomerSectionProps) {
  const { state, actions } = usePosPage();

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-800 bg-[#0F0F0F] p-3",
        className
      )}
    >
      <div className="space-y-1">
        <p className="font-medium text-sm text-zinc-200">{title}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <CustomerPicker
        buttonClassName={cn(
          "mt-3 h-auto w-full justify-between border-zinc-700 bg-[#151515] hover:bg-[#151515]",
          buttonClassName
        )}
        contentClassName={contentClassName ?? "w-[min(420px,calc(100vw-2rem))]"}
        customers={state.customers}
        onCustomerChange={actions.setSelectedCustomerId}
        selectedCustomerId={state.selectedCustomerId}
      />
    </div>
  );
}
