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
  ShiftsAdvancedFiltersDesktop,
  ShiftsAdvancedFiltersMobile,
} from "@/features/shifts/components/shifts-advanced-filters";
import { useShiftsPage } from "@/features/shifts/shifts-page-context";
import {
  darkDrawerStyles,
  darkInputStyles,
  darkSelectStyles,
} from "@/lib/mantine-dark";

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
            id={meta.fieldIds.search}
            leftSection={<Search aria-hidden="true" className="size-4" />}
            onChange={(event) => actions.setSearchQuery(event.target.value)}
            placeholder="Cajero, terminal o id…"
            styles={darkInputStyles}
            value={filters.searchQuery}
          />
        </div>

        <div className="w-full sm:w-[200px]">
          <Select
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
            styles={darkSelectStyles}
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
          styles={darkDrawerStyles}
          title="Filtros avanzados"
        >
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto p-4">
              <ShiftsAdvancedFiltersMobile />
            </div>
            <div className="grid grid-cols-2 gap-3 border-zinc-800 border-t p-4">
              <Button
                color="gray"
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

        <Popover
          position="bottom-start"
          shadow="xl"
          styles={{
            dropdown: {
              backgroundColor: "var(--color-carbon)",
              borderColor: "#27272a",
              color: "#fff",
            },
          }}
          width={600}
          withinPortal
        >
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
              <ShiftsAdvancedFiltersDesktop />
              <div className="flex justify-end pt-2">
                <Button
                  c="black"
                  color="voltage.5"
                  onClick={actions.applyDesktopFilters}
                  type="button"
                >
                  Aplicar filtros
                </Button>
              </div>
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
