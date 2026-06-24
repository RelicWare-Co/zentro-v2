import {
  Badge,
  Button,
  Drawer,
  Popover,
  Select,
  TextInput,
} from "@mantine/core";
import { Filter, Search } from "lucide-react";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import {
  SalesAdvancedFiltersDesktop,
  SalesAdvancedFiltersMobile,
} from "@/features/sales/components/sales-advanced-filters";
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

        <div className="w-full sm:w-[200px]">
          <Select
            aria-label="Filtrar por estado"
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
            value={filters.status || ALL_FILTER_VALUE}
          />
        </div>

        <Button
          className="w-full sm:hidden"
          color="gray"
          leftSection={<Filter aria-hidden="true" className="size-4" />}
          onClick={() => actions.setMobileFilterOpen(true)}
          type="button"
          variant="outline"
        >
          Filtros
          {filterCountBadge}
        </Button>

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

        <Popover position="bottom-start" shadow="xl" width={600} withinPortal>
          <Popover.Target>
            <Button
              className="hidden sm:inline-flex"
              color="gray"
              leftSection={<Filter aria-hidden="true" className="size-4" />}
              type="button"
              variant="outline"
            >
              Filtros
              {filterCountBadge}
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-zinc-200">
                Filtros avanzados
              </h4>
              <SalesAdvancedFiltersDesktop />
            </div>
          </Popover.Dropdown>
        </Popover>

        {state.activeFilterCount > 0 ? (
          <Button
            color="gray"
            onClick={actions.clearFilters}
            type="button"
            variant="subtle"
          >
            Limpiar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
