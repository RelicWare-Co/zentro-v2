import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosPage } from "@/features/pos/pos-page-context";
import { formatCurrency } from "@/features/pos/utils";
import { posV2OrderSurfaceClassName } from "@/features/posv2/components/pos-v2-order-styles";
import { cn } from "@/lib/utils";

export function AccountCreditSummary() {
  const { state, actions } = usePosPage();
  const selectedCustomer = state.customers.find(
    (customer) => customer.id === state.selectedCustomerId
  );

  return (
    <div className={cn("space-y-2 p-2.5", posV2OrderSurfaceClassName)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-[#6b6b6b] text-[10px] uppercase tracking-[0.12em]">
            Venta a crédito
          </p>
          <p className="truncate text-sm text-white">
            {selectedCustomer?.name ?? "Sin cliente asignado"}
          </p>
          {state.shouldCreateCreditBalance ? (
            <p className="text-amber-300 text-xs">
              Pendiente: {formatCurrency(state.remainingCreditAmount)}
            </p>
          ) : (
            <p className="text-emerald-400 text-xs">Cubierta con el abono</p>
          )}
        </div>
        <Button
          className="h-7 shrink-0 px-2 text-[#dfff06] text-xs hover:bg-[rgba(223,255,6,0.08)]"
          onClick={actions.openCheckoutDetails}
          type="button"
          variant="ghost"
        >
          <Pencil className="mr-1 size-3" />
          Editar
        </Button>
      </div>
    </div>
  );
}
