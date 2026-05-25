import { History, Loader2, Plus, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VirtualList } from "@/components/ui/virtual-list";
import {
  creditCurrencyFormatter,
  creditDateTimeFormatter,
  formatCreditTransactionType,
  getCreditTransactionAmountClass,
  getCreditTransactionTypeBadgeClass,
} from "@/features/credit/credit-formatters.shared";
import { useCreditPage } from "@/features/credit/credit-page-context";

function CreditLedgerTransactions() {
  const { meta } = useCreditPage();

  if (meta.transactionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-[var(--color-voltage)]" />
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
      renderItem={(tx) => (
        <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black/10 p-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                className={`${getCreditTransactionTypeBadgeClass(tx.type)} border-0 px-2 py-0.5 text-xs`}
              >
                {formatCreditTransactionType(tx.type)}
              </Badge>
              {tx.saleId ? (
                <span className="text-xs text-zinc-500">
                  <Receipt className="inline size-3" /> {tx.saleId.slice(0, 8)}…
                </span>
              ) : null}
            </div>
            {tx.notes ? (
              <p className="text-sm text-zinc-400">{tx.notes}</p>
            ) : null}
            <p className="text-xs text-zinc-500">
              {creditDateTimeFormatter.format(tx.createdAt)}
            </p>
          </div>
          <div className="shrink-0 pl-4 text-right">
            <p
              className={`font-semibold tabular-nums ${getCreditTransactionAmountClass(tx.type)}`}
            >
              {tx.type === "payment" ? "-" : "+"}
              {creditCurrencyFormatter.format(tx.amount)}
            </p>
          </div>
        </div>
      )}
    />
  );
}

export function CreditLedgerSheet() {
  const { state, actions } = useCreditPage();
  const isOpen = state.activeOverlay?.type === "ledger";

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          actions.closeOverlay();
        }
      }}
      open={isOpen}
    >
      <SheetContent className="!w-full !max-w-full sm:!w-[640px] overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)] p-0 text-white">
        <div className="flex h-full flex-col">
          <SheetHeader className="shrink-0 border-zinc-800 border-b p-6">
            <SheetTitle className="font-bold text-2xl">
              Historial de crédito
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              {state.selectedAccount?.customerName}: Saldo pendiente:{" "}
              <span className="font-semibold text-[var(--color-voltage)]">
                {creditCurrencyFormatter.format(
                  state.selectedAccount?.balance ?? 0
                )}
              </span>
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-hidden p-6">
            <CreditLedgerTransactions />
          </div>
          <div className="shrink-0 border-zinc-800 border-t bg-black/30 p-4">
            <Button
              className="w-full bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
              disabled={
                !state.selectedAccount || state.selectedAccount.balance <= 0
              }
              onClick={actions.openPaymentFromLedger}
              type="button"
            >
              <Plus className="mr-2 size-4" />
              Registrar abono
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
