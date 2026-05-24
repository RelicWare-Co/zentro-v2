import { useId } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { formatCurrency } from "@/features/pos/utils";
import { cn } from "@/lib/utils";

interface CheckoutCreditSectionProps {
  className?: string;
  showToggle?: boolean;
}

export function CheckoutCreditSection({
  className,
  showToggle = true,
}: CheckoutCreditSectionProps) {
  const { state, actions, meta } = usePosPage();
  const creditSaleId = useId();

  if (!(meta.allowCreditSales || state.isCreditSale)) {
    return showToggle ? (
      <div className="flex items-center justify-end">
        <span className="text-sm text-zinc-500">
          Crédito deshabilitado en ajustes
        </span>
      </div>
    ) : null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {showToggle && meta.allowCreditSales ? (
        <div className="flex items-center justify-end gap-2">
          <input
            checked={state.isCreditSale}
            className="size-4 rounded border-zinc-700 bg-[#0a0a0a] text-[var(--color-voltage)] focus:ring-[var(--color-voltage)]"
            id={creditSaleId}
            onChange={(event) => actions.setIsCreditSale(event.target.checked)}
            type="checkbox"
          />
          <label
            className="cursor-pointer text-sm text-zinc-400"
            htmlFor={creditSaleId}
          >
            Dejar saldo a crédito
          </label>
        </div>
      ) : null}

      {state.shouldCreateCreditBalance && !state.selectedCustomerId && (
        <p className="text-amber-400 text-sm">
          Selecciona un cliente para registrar venta a crédito.
        </p>
      )}

      {state.shouldCreateCreditBalance &&
        state.selectedCustomerId &&
        !state.selectedCustomerCreditAccount && (
          <p className="text-amber-300 text-sm">
            Se creará la cuenta de crédito del cliente con el saldo pendiente de
            esta venta.
          </p>
        )}

      {state.isCreditSale && (
        <p className="text-sm text-zinc-400">
          {state.shouldCreateCreditBalance
            ? "Puedes registrar un abono inicial ahora y el restante quedará pendiente en la cuenta del cliente."
            : "Con los descuentos y pagos actuales no quedará saldo pendiente, así que la venta se registrará como pagada."}
        </p>
      )}

      {state.selectedCustomerCreditAccount && (
        <div className="space-y-1 rounded-lg border border-amber-900/40 bg-amber-900/20 p-3 text-sm">
          <p className="font-medium text-amber-300">
            Saldo pendiente actual:{" "}
            {formatCurrency(state.selectedCustomerCreditAccount.balance)}
          </p>
          {state.isCreditSale && (
            <>
              <p className="text-amber-200">
                {state.shouldCreateCreditBalance
                  ? "Saldo que quedará pendiente por esta venta: "
                  : "Saldo pendiente por esta venta: "}
                {formatCurrency(state.remainingCreditAmount)}
              </p>
              {state.shouldCreateCreditBalance ? (
                <p className="text-amber-200">
                  Saldo proyectado total tras esta venta:{" "}
                  {formatCurrency(state.projectedCreditBalance)}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
