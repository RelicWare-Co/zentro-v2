import { usePosPage } from "@/features/pos/pos-page-context";
import { formatCurrency } from "@/lib/format-currency.shared";
import { cn } from "@/lib/utils";
import {
  getFooterLabel,
  getFooterValue,
  getFooterValueClassName,
} from "./checkout-footer.helpers";

interface CheckoutSummaryFooterProps {
  className?: string;
  showCashChangeHint?: boolean;
}

export function CheckoutSummaryFooter({
  className,
  showCashChangeHint = true,
}: CheckoutSummaryFooterProps) {
  const { state } = usePosPage();

  const footerLabel = getFooterLabel(
    state.isCreditSale,
    state.canReturnCashChange
  );
  const footerValue = getFooterValue(
    state.isCreditSale,
    state.canReturnCashChange,
    state.paymentDifference,
    state.cashChangeDue
  );
  const footerValueClassName = getFooterValueClassName(
    state.isCreditSale,
    state.shouldCreateCreditBalance,
    state.canReturnCashChange,
    state.paymentDifference
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between border-zinc-800 border-t pt-2 text-sm">
        <span className="text-zinc-400">{footerLabel}</span>
        <span className={cn("font-semibold", footerValueClassName)}>
          {formatCurrency(footerValue)}
        </span>
      </div>

      {showCashChangeHint &&
      !state.isCreditSale &&
      state.canReturnCashChange &&
      state.hasPaymentDifference ? (
        <p className="text-sm text-zinc-400">
          El sistema registrará el valor recibido y mostrará este monto como
          vuelto para el cajero.
        </p>
      ) : null}

      {state.checkoutError instanceof Error && (
        <p className="text-red-400 text-sm">{state.checkoutError.message}</p>
      )}
    </div>
  );
}
