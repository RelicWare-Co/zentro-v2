import { Badge, Button, Drawer, Select, TextInput } from "@mantine/core";
import { Filter, Search } from "lucide-react";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import { SalesAdvancedFiltersMobile } from "@/features/sales/components/sales-advanced-filters";
import { useSalesPage } from "@/features/sales/sales-page-context";

export function SalesFilterToolbar() {
  const { state, actions, meta } = useSalesPage();
  const { filters } = state;

  const filterCountBadge =
    state.activeAdvancedFilterCount > 0 ? (
      <Badge
        className="ml-2 bg-[var(--color-voltage)]/20 font-mono text-[var(--color-voltage)]"
        size="sm"
        tt="none"
      >
        {state.activeAdvancedFilterCount}
      </Badge>
    ) : null;

  return (
    <div className="flex flex-col gap-4 border-zinc-800 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full sm:max-w-xs md:max-w-sm">
          <TextInput
            aria-label="Buscar ventas"
            autoComplete="off"
            id={meta.fieldIds.search}
            leftSection={<Search aria-hidden="true" className="size-4" />}
            onChange={(event) => actions.setSearchQuery(event.target.value)}
            placeholder="Cliente, cajero o id…"
            value={filters.searchQuery}
          />
        </div>

        {/* Mobile: button opens bottom drawer with all advanced filters. */}
        <Button
          className="w-full sm:hidden"
          leftSection={<Filter aria-hidden="true" className="size-4" />}
          onClick={() => actions.setMobileFilterOpen(true)}
          type="button"
          variant="outline"
        >
          Filtros
          {filterCountBadge}
        </Button>

        {/* Desktop: inline small selects — no big "Filtros" popover here.
            Less-used fields (terminal, fechas, montos) live only on mobile. */}
        <div className="hidden items-center gap-3 sm:flex">
          <Select
            aria-label="Filtrar por estado"
            comboboxProps={{ withinPortal: false }}
            data={[
              { value: ALL_FILTER_VALUE, label: "Todos" },
              { value: "completed", label: "Pagada" },
              { value: "credit", label: "Crédito" },
              { value: "cancelled", label: "Cancelada" },
            ]}
            id={meta.fieldIds.status}
            onChange={(value) =>
              actions.setStatus(
                !value || value === ALL_FILTER_VALUE ? "" : value
              )
            }
            placeholder="Estado"
            size="sm"
            value={filters.status || ALL_FILTER_VALUE}
            w={150}
          />
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Select
            aria-label="Filtrar por cajero"
            comboboxProps={{ withinPortal: false }}
            data={[
              { value: ALL_FILTER_VALUE, label: "Todos" },
              ...state.filterOptions.cashiers.map((cashier) => ({
                value: cashier.id,
                label: cashier.name ?? "Cajero",
              })),
            ]}
            id={meta.fieldIds.cashier}
            onChange={(value) =>
              actions.setCashierId(
                !value || value === ALL_FILTER_VALUE ? "" : value
              )
            }
            placeholder="Cajero"
            size="sm"
            value={filters.cashierId || ALL_FILTER_VALUE}
            w={150}
          />
          <Select
            aria-label="Filtrar por medio de pago"
            comboboxProps={{ withinPortal: false }}
            data={[
              { value: ALL_FILTER_VALUE, label: "Todos" },
              ...state.filterOptions.paymentMethods.map((paymentMethod) => ({
                value: paymentMethod.id,
                label: paymentMethod.label,
              })),
            ]}
            id={meta.fieldIds.paymentMethod}
            onChange={(value) =>
              actions.setPaymentMethod(
                !value || value === ALL_FILTER_VALUE ? "" : value
              )
            }
            placeholder="Método"
            size="sm"
            value={filters.paymentMethod || ALL_FILTER_VALUE}
            w={150}
          />
          <Select
            aria-label="Filtrar por saldo"
            comboboxProps={{ withinPortal: false }}
            data={[
              { value: ALL_FILTER_VALUE, label: "Todos" },
              { value: "with_balance", label: "Con saldo pendiente" },
              { value: "settled", label: "Sin saldo" },
            ]}
            id={meta.fieldIds.balanceStatus}
            onChange={(value) =>
              actions.setBalanceStatus(
                !value || value === ALL_FILTER_VALUE ? "" : value
              )
            }
            placeholder="Saldo"
            size="sm"
            value={filters.balanceStatus || ALL_FILTER_VALUE}
            w={170}
          />
        </div>

        {state.activeFilterCount > 0 ? (
          <Button onClick={actions.clearFilters} type="button" variant="subtle">
            Limpiar
          </Button>
        ) : null}
      </div>

      <Drawer
        onClose={() => actions.setMobileFilterOpen(false)}
        opened={state.isMobileFilterOpen}
        position="bottom"
        size="85%"
        title="Filtros avanzados"
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            <SalesAdvancedFiltersMobile />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
