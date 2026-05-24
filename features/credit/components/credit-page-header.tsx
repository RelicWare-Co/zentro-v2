import { Badge } from "@/components/ui/badge";
import { creditCurrencyFormatter } from "@/features/credit/credit-formatters.shared";
import { useCreditPage } from "@/features/credit/credit-page-context";

export function CreditPageHeader() {
  const { state } = useCreditPage();

  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-3xl tracking-tight">Crédito</h1>
          <Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
            {state.totalAccounts} cuentas
          </Badge>
        </div>
        <p className="text-sm text-zinc-400">
          Saldo total pendiente:{" "}
          <span className="font-semibold text-[var(--color-voltage)]">
            {creditCurrencyFormatter.format(state.totalBalance)}
          </span>
        </p>
      </div>
    </section>
  );
}
