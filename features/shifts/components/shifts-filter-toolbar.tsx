import { Badge, Button, Drawer, Select, TextInput } from "@mantine/core";
import { Filter, Search } from "lucide-react";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import { ShiftsAdvancedFiltersMobile } from "@/features/shifts/components/shifts-advanced-filters";
import { useShiftsPage } from "@/features/shifts/shifts-page-context";

export function ShiftsFilterToolbar() {
  const { state, actions, meta } = useShiftsPage();
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
    <div className="flex shrink-0 flex-col gap-4 border-zinc-800 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full sm:max-w-xs md:max-w-sm">
          <TextInput
            aria-label="Buscar turnos"
            id={meta.fieldIds.search}
            leftSection={<Search aria-hidden="true" className="size-4" />}
            onChange={(event) => actions.setSearchQuery(event.target.value)}
            placeholder="Cajero, terminal o id…"
            value={filters.searchQuery}
          />
        </div>

        {/* Mobile: one button opens the bottom drawer with all advanced
            filters. */}
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

        {/* Desktop: inline small filters — no big "Filtros" popover.
            Keeps the quick selects and the applicable date range; less
            used fields (terminal / movimientos) live only on mobile. */}
        <div className="hidden items-center gap-3 sm:flex">
          <Select
            aria-label="Filtrar por estado"
            comboboxProps={{ withinPortal: false }}
            data={[
              { value: ALL_FILTER_VALUE, label: "Todos" },
              { value: "open", label: "Abierto" },
              { value: "closed", label: "Cerrado" },
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
            w={140}
          />
        </div>

        <div className="hidden items-end gap-3 md:flex">
          <Select
            aria-label="Filtrar por cajero"
            comboboxProps={{ withinPortal: false }}
            data={[
              { value: ALL_FILTER_VALUE, label: "Todos" },
              ...state.filterOptions.cashiers.map((cashier) => ({
                value: cashier.id,
                label: cashier.name,
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
            aria-label="Filtrar por método"
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
            aria-label="Filtrar por diferencia"
            comboboxProps={{ withinPortal: false }}
            data={[
              { value: ALL_FILTER_VALUE, label: "Todas" },
              { value: "short", label: "Faltante" },
              { value: "over", label: "Sobrante" },
              { value: "balanced", label: "Cuadrada" },
            ]}
            id={meta.fieldIds.differenceStatus}
            onChange={(value) =>
              actions.setDifferenceStatus(
                !value || value === ALL_FILTER_VALUE ? "" : value
              )
            }
            placeholder="Diferencia"
            size="sm"
            value={filters.differenceStatus || ALL_FILTER_VALUE}
            w={150}
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
            <ShiftsAdvancedFiltersMobile />
          </div>
          <div className="grid grid-cols-2 gap-3 border-zinc-800 border-t p-4">
            <Button
              onClick={actions.clearFilters}
              type="button"
              variant="outline"
            >
              Limpiar
            </Button>
            <Button
              c="black"
              color="voltage.5"
              onClick={actions.applyMobileFilters}
              type="button"
            >
              Aplicar
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
