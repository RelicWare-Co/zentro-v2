import { Button } from "@mantine/core";
import { Pencil } from "lucide-react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { formatCurrency } from "@/features/pos/utils";
import {
  posV2AccentSoftHoverBg,
  posV2AccentText,
  posV2MutedText,
  posV2OrderSurfaceClassName,
} from "@/features/posv2/components/pos-v2-order-styles";
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
          <p
            className={cn(
              "font-medium text-[10px] uppercase tracking-[0.12em]",
              posV2MutedText
            )}
          >
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
          className={cn("shrink-0", posV2AccentSoftHoverBg, posV2AccentText)}
          leftSection={<Pencil className="size-3" />}
          onClick={actions.openCheckoutDetails}
          size="compact-xs"
          type="button"
          variant="subtle"
        >
          Editar
        </Button>
      </div>
    </div>
  );
}
