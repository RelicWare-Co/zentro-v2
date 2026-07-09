import { Badge } from "@mantine/core";
import { useCreditPage } from "@/features/credit/credit-page-context";
import { formatCurrency } from "@/lib/format-currency.shared";

export function CreditPageHeader() {
  const { state } = useCreditPage();

  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-3xl tracking-tight">Crédito</h1>
          <Badge color="voltage" radius="xl" variant="light">
            {state.totalAccounts} cuentas
          </Badge>
        </div>
        <p className="text-sm text-zinc-400">
          Saldo total pendiente:{" "}
          <span className="font-semibold text-[var(--color-voltage)]">
            {formatCurrency(state.totalBalance)}
          </span>
        </p>
      </div>
    </section>
  );
}
