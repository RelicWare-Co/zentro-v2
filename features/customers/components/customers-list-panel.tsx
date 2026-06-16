import { ActionIcon, Badge, Button, Loader, TextInput } from "@mantine/core";
import { Edit3, Plus, Search, Trash2, Users } from "lucide-react";
import { useId } from "react";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { VirtualTable } from "@/components/ui/virtual-table";
import { formatCustomerDocumentLabel } from "@/features/customers/customers-formatters.shared";
import { useCustomersPage } from "@/features/customers/customers-page-context";
import { darkInputStyles } from "@/lib/mantine-dark";

export function CustomersListPanel() {
  const { state, actions } = useCustomersPage();
  const searchId = useId();

  return (
    <>
      <div className="w-full sm:max-w-sm">
        <TextInput
          id={searchId}
          leftSection={<Search className="size-4 text-zinc-500" />}
          onChange={(event) => actions.setSearchQuery(event.target.value)}
          placeholder="Buscar por nombre, teléfono, documento o email…"
          rightSection={
            state.isSearching ? <Loader color="gray" size="xs" /> : null
          }
          styles={darkInputStyles}
          value={state.searchQuery}
        />
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
                  color="gray"
                  leftSection={<Plus className="size-4" />}
                  onClick={actions.openCreate}
                  type="button"
                  variant="outline"
                >
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
                    className="mt-1"
                    color="gray"
                    size="sm"
                    variant="default"
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
                <ActionIcon
                  aria-label="Editar cliente"
                  color="gray"
                  onClick={() => actions.openEdit(customer)}
                  variant="outline"
                >
                  <Edit3 className="size-3.5" />
                </ActionIcon>
                <ActionIcon
                  aria-label="Eliminar cliente"
                  color="red"
                  onClick={() => actions.openDelete(customer)}
                  variant="outline"
                >
                  <Trash2 className="size-3.5" />
                </ActionIcon>
              </div>
            </TableCell>
          </>
        )}
      />
    </>
  );
}
