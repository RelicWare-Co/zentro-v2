import { Edit3, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { VirtualTable } from "@/components/ui/virtual-table";
import { formatCustomerDocumentLabel } from "@/features/customers/customers-formatters.shared";
import { useCustomersPage } from "@/features/customers/customers-page-context";

export function CustomersListPanel() {
  const { state, actions } = useCustomersPage();
  const searchId = useId();

  return (
    <>
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="border-zinc-800 bg-black/20 pl-9"
          id={searchId}
          onChange={(event) => actions.setSearchQuery(event.target.value)}
          placeholder="Buscar por nombre, teléfono, documento o email…"
          value={state.searchQuery}
        />
        {state.isSearching ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-zinc-500" />
        ) : null}
      </div>

      <VirtualTable
        data={state.customers}
        emptyState={
          state.customers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <Users className="size-8 text-zinc-600" />
              <p className="text-sm text-zinc-500">
                {state.searchQuery.trim()
                  ? "No hay clientes que coincidan con la búsqueda."
                  : "Aún no hay clientes registrados."}
              </p>
              {state.searchQuery.trim() ? null : (
                <Button
                  className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                  onClick={actions.openCreate}
                  type="button"
                  variant="outline"
                >
                  <Plus className="mr-2 size-4" />
                  Crear cliente
                </Button>
              )}
            </div>
          ) : null
        }
        estimateSize={72}
        getItemKey={(customer) => customer.id}
        header={
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="px-4 text-zinc-400">Nombre</TableHead>
            <TableHead className="text-zinc-400">Documento</TableHead>
            <TableHead className="text-zinc-400">Teléfono</TableHead>
            <TableHead className="text-zinc-400">Email</TableHead>
            <TableHead className="text-right text-zinc-400">Acciones</TableHead>
          </TableRow>
        }
        maxHeight={600}
        renderRow={(customer) => (
          <>
            <TableCell className="px-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {customer.name}
                </p>
                {customer.type ? (
                  <Badge
                    className="mt-1 border-zinc-700 bg-zinc-800/80 text-zinc-300"
                    variant="outline"
                  >
                    {customer.type === "juridica" ? "Jurídica" : "Natural"}
                  </Badge>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="text-sm text-zinc-300">
              {formatCustomerDocumentLabel(
                customer.documentType,
                customer.documentNumber
              ) ?? <span className="text-zinc-500">-</span>}
            </TableCell>
            <TableCell className="text-sm text-zinc-300">
              {customer.phone ?? <span className="text-zinc-500">-</span>}
            </TableCell>
            <TableCell className="text-sm text-zinc-300">
              {customer.email ?? <span className="text-zinc-500">-</span>}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
                  onClick={() => actions.openEdit(customer)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Edit3 className="size-3.5" />
                </Button>
                <Button
                  className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
                  onClick={() => actions.openDelete(customer)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </TableCell>
          </>
        )}
      />
    </>
  );
}
