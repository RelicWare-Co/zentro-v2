import { ActionIcon, TextInput } from "@mantine/core";
import { History, Plus, Search, Wallet } from "lucide-react";
import { useId } from "react";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { VirtualTable } from "@/components/ui/virtual-table";
import { creditCurrencyFormatter } from "@/features/credit/credit-formatters.shared";
import { useCreditPage } from "@/features/credit/credit-page-context";
import { darkInputStyles } from "@/lib/mantine-dark";

export function CreditAccountsPanel() {
  const { state, actions } = useCreditPage();
  const searchId = useId();

  return (
    <>
      <div className="w-full sm:max-w-sm">
        <TextInput
          id={searchId}
          leftSection={<Search className="size-4 text-zinc-500" />}
          onChange={(event) => actions.setSearchQuery(event.target.value)}
          placeholder="Buscar por nombre, documento o teléfono…"
          styles={darkInputStyles}
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
                <ActionIcon
                  aria-label="Ver historial"
                  color="gray"
                  onClick={() => actions.openLedger(account)}
                  variant="outline"
                >
                  <History className="size-3.5" />
                </ActionIcon>
                {account.balance > 0 ? (
                  <ActionIcon
                    aria-label="Registrar abono"
                    color="teal"
                    onClick={() => actions.openPayment(account)}
                    variant="outline"
                  >
                    <Plus className="size-3.5" />
                  </ActionIcon>
                ) : null}
              </div>
            </TableCell>
          </>
        )}
      />
    </>
  );
}
