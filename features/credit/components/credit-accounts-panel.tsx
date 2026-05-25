import { History, Plus, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { VirtualTable } from "@/components/ui/virtual-table";
import { creditCurrencyFormatter } from "@/features/credit/credit-formatters.shared";
import { useCreditPage } from "@/features/credit/credit-page-context";

export function CreditAccountsPanel() {
  const { state, actions } = useCreditPage();

  return (
    <>
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="border-zinc-800 bg-black/20 pl-9"
          onChange={(event) => actions.setSearchQuery(event.target.value)}
          placeholder="Buscar por nombre, documento o teléfono…"
          value={state.searchQuery}
        />
      </div>

      <VirtualTable
        data={state.accounts}
        emptyState={
          state.accounts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <Wallet className="size-8 text-zinc-600" />
              <p className="text-sm text-zinc-500">
                {state.searchQuery.trim()
                  ? "No hay cuentas que coincidan con la búsqueda."
                  : "Aún no hay cuentas de crédito registradas."}
              </p>
            </div>
          ) : null
        }
        estimateSize={64}
        getItemKey={(account) => account.id}
        header={
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="px-4 text-zinc-400">Cliente</TableHead>
            <TableHead className="text-zinc-400">Documento</TableHead>
            <TableHead className="text-zinc-400">Teléfono</TableHead>
            <TableHead className="text-right text-zinc-400">
              Saldo pendiente
            </TableHead>
            <TableHead className="text-right text-zinc-400">Acciones</TableHead>
          </TableRow>
        }
        maxHeight={600}
        renderRow={(account) => (
          <>
            <TableCell className="px-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {account.customerName}
                </p>
              </div>
            </TableCell>
            <TableCell className="text-sm text-zinc-300">
              {account.customerDocument ?? (
                <span className="text-zinc-500">-</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-zinc-300">
              {account.customerPhone ?? (
                <span className="text-zinc-500">-</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <p
                className={`font-semibold tabular-nums ${account.balance > 0 ? "text-[var(--color-voltage)]" : "text-zinc-400"}`}
              >
                {creditCurrencyFormatter.format(account.balance)}
              </p>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
                  onClick={() => actions.openLedger(account)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <History className="size-3.5" />
                  <span className="sr-only">Ver historial</span>
                </Button>
                {account.balance > 0 ? (
                  <Button
                    className="border-emerald-500/30 bg-transparent text-emerald-200 hover:bg-emerald-500/10"
                    onClick={() => actions.openPayment(account)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus className="size-3.5" />
                    <span className="sr-only">Registrar abono</span>
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </>
        )}
      />
    </>
  );
}
