import { Badge, Button, Drawer, Loader } from "@mantine/core";
import { History, Plus, Receipt } from "lucide-react";
import { VirtualList } from "@/components/ui/virtual-list";
import type { CreditTransaction } from "@/features/credit/credit.shared";
import {
  creditDateTimeFormatter,
  formatCreditTransactionType,
  getCreditTransactionAmountClass,
  getCreditTransactionTypeBadgeClass,
} from "@/features/credit/credit-formatters.shared";
import { useCreditPage } from "@/features/credit/credit-page-context";
import { formatCurrency } from "@/lib/format-currency.shared";

function CreditTransactionRow({
  data: tx,
}: {
  data: CreditTransaction;
  index: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black/10 p-4">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Badge
            className={`${getCreditTransactionTypeBadgeClass(tx.type)} border-0`}
            size="sm"
          >
            {formatCreditTransactionType(tx.type)}
          </Badge>
          {tx.saleId ? (
            <span className="text-xs text-zinc-500">
              <Receipt className="inline size-3" /> {tx.saleId.slice(0, 8)}…
            </span>
          ) : null}
        </div>
        {tx.notes ? <p className="text-sm text-zinc-400">{tx.notes}</p> : null}
        <p className="text-xs text-zinc-500">
          {creditDateTimeFormatter.format(tx.createdAt)}
        </p>
      </div>
      <div className="shrink-0 pl-4 text-right">
        <p
          className={`font-semibold tabular-nums ${getCreditTransactionAmountClass(tx.type)}`}
        >
          {tx.type === "payment" ? "-" : "+"}
          {formatCurrency(tx.amount)}
        </p>
      </div>
    </div>
  );
}

function CreditLedgerTransactions() {
  const { meta } = useCreditPage();

  if (meta.transactionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader color="voltage.5" size="md" />
      </div>
    );
  }

  if (meta.transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <History className="size-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">No hay movimientos registrados.</p>
      </div>
    );
  }

  return (
    <VirtualList
      className="h-full"
      data={meta.transactions}
      estimateSize={80}
      gap={12}
      getItemKey={(tx) => tx.id}
      RowComponent={CreditTransactionRow}
    />
  );
}

export function CreditLedgerSheet() {
  const { state, actions } = useCreditPage();
  const isOpen = state.activeOverlay?.type === "ledger";

  return (
    <Drawer
      onClose={actions.closeOverlay}
      opened={isOpen}
      position="right"
      size={640}
      title="Historial de crédito"
    >
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-zinc-800 border-b p-6">
          <p className="text-sm text-zinc-400">
            {state.selectedAccount?.customerName}: Saldo pendiente:{" "}
            <span className="font-semibold text-[var(--color-voltage)]">
              {formatCurrency(state.selectedAccount?.balance ?? 0)}
            </span>
          </p>
        </div>

        <div className="flex-1 overflow-hidden p-6">
          <CreditLedgerTransactions />
        </div>
        <div className="shrink-0 border-zinc-800 border-t bg-black/30 p-4">
          <Button
            c="black"
            color="voltage.5"
            disabled={
              !state.selectedAccount || state.selectedAccount.balance <= 0
            }
            fullWidth
            leftSection={<Plus className="size-4" />}
            onClick={actions.openPaymentFromLedger}
            type="button"
          >
            Registrar abono
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
