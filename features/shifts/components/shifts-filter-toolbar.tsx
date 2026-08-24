import {
  type ActiveFilterChip,
  FilterToolbar,
} from "@/features/listing/filters/filter-toolbar";
import { ShiftsAdvancedFiltersFields } from "@/features/shifts/components/shifts-advanced-filters";
import {
  SHIFT_DIFFERENCE_STATUS_LABELS,
  SHIFT_HAS_MOVEMENTS_LABELS,
  SHIFT_STATUS_LABELS,
} from "@/features/shifts/shifts-page.constants.shared";
import { useShiftsPage } from "@/features/shifts/shifts-page-context";

export function ShiftsFilterToolbar() {
  const { state, actions, meta } = useShiftsPage();
  const { filters, filterOptions } = state;

  const activeFilterChips: ActiveFilterChip[] = [];

  if (filters.status) {
    activeFilterChips.push({
      key: "status",
      label: `Estado: ${SHIFT_STATUS_LABELS[filters.status as keyof typeof SHIFT_STATUS_LABELS]}`,
      onClear: () => actions.setStatus(""),
    });
  }
  if (filters.differenceStatus) {
    activeFilterChips.push({
      key: "differenceStatus",
      label: `Diferencia: ${SHIFT_DIFFERENCE_STATUS_LABELS[filters.differenceStatus as keyof typeof SHIFT_DIFFERENCE_STATUS_LABELS]}`,
      onClear: () => actions.setDifferenceStatus(""),
    });
  }
  if (filters.hasMovements) {
    activeFilterChips.push({
      key: "hasMovements",
      label: `Movimientos: ${SHIFT_HAS_MOVEMENTS_LABELS[filters.hasMovements as keyof typeof SHIFT_HAS_MOVEMENTS_LABELS]}`,
      onClear: () => actions.setHasMovements(""),
    });
  }
  if (filters.cashierId) {
    const cashier = filterOptions.cashiers.find(
      (item) => item.id === filters.cashierId
    );
    activeFilterChips.push({
      key: "cashierId",
      label: `Cajero: ${cashier?.name ?? "Cajero"}`,
      onClear: () => actions.setCashierId(""),
    });
  }
  if (filters.paymentMethod) {
    activeFilterChips.push({
      key: "paymentMethod",
      label: `Medio de pago: ${meta.paymentMethodLabels[filters.paymentMethod] ?? filters.paymentMethod}`,
      onClear: () => actions.setPaymentMethod(""),
    });
  }
  if (filters.terminalName) {
    activeFilterChips.push({
      key: "terminalName",
      label: `Terminal: ${filters.terminalName}`,
      onClear: () => actions.setTerminalName(""),
    });
  }
  if (filters.startDate) {
    activeFilterChips.push({
      key: "startDate",
      label: `Desde: ${filters.startDate}`,
      onClear: () => actions.setStartDate(""),
    });
  }
  if (filters.endDate) {
    activeFilterChips.push({
      key: "endDate",
      label: `Hasta: ${filters.endDate}`,
      onClear: () => actions.setEndDate(""),
    });
  }

  return (
    <FilterToolbar
      activeAdvancedFilterCount={state.activeAdvancedFilterCount}
      activeFilterChips={activeFilterChips}
      hasActiveFilters={state.activeFilterCount > 0}
      onClearFilters={actions.clearFilters}
      renderAdvancedFilters={(layout) => (
        <ShiftsAdvancedFiltersFields layout={layout} />
      )}
      searchAriaLabel="Buscar turnos"
      searchFieldId={meta.fieldIds.search}
      searchPlaceholder="Cajero, terminal o id…"
      searchQuery={state.filters.searchQuery}
      setSearchQuery={actions.setSearchQuery}
    />
  );
}
