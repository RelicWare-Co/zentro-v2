import {
  type ActiveFilterChip,
  FilterToolbar,
} from "@/features/listing/filters/filter-toolbar";
import { SalesAdvancedFiltersFields } from "@/features/sales/components/sales-advanced-filters";
import {
  SALE_BALANCE_STATUS_LABELS,
  SALE_STATUS_LABELS,
} from "@/features/sales/sales-page.constants.shared";
import { useSalesPage } from "@/features/sales/sales-page-context";
import { formatMoneyInput } from "@/lib/utils";

export function SalesFilterToolbar() {
  const { state, actions, meta } = useSalesPage();
  const { filters, filterOptions } = state;

  const activeFilterChips: ActiveFilterChip[] = [];

  if (filters.status) {
    activeFilterChips.push({
      key: "status",
      label: `Estado: ${SALE_STATUS_LABELS[filters.status as keyof typeof SALE_STATUS_LABELS]}`,
      onClear: () => actions.setStatus(""),
    });
  }
  if (filters.balanceStatus) {
    activeFilterChips.push({
      key: "balanceStatus",
      label: `Saldo: ${SALE_BALANCE_STATUS_LABELS[filters.balanceStatus as keyof typeof SALE_BALANCE_STATUS_LABELS]}`,
      onClear: () => actions.setBalanceStatus(""),
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
  if (filters.amountMin) {
    activeFilterChips.push({
      key: "amountMin",
      label: `Mínimo: ${formatMoneyInput(filters.amountMin)}`,
      onClear: () => actions.setAmountMin(""),
    });
  }
  if (filters.amountMax) {
    activeFilterChips.push({
      key: "amountMax",
      label: `Máximo: ${formatMoneyInput(filters.amountMax)}`,
      onClear: () => actions.setAmountMax(""),
    });
  }
  if (!meta.isTodayView && filters.startDate) {
    activeFilterChips.push({
      key: "startDate",
      label: `Desde: ${filters.startDate}`,
      onClear: () => actions.setStartDate(""),
    });
  }
  if (!meta.isTodayView && filters.endDate) {
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
        <SalesAdvancedFiltersFields layout={layout} />
      )}
      searchAriaLabel="Buscar ventas"
      searchFieldId={meta.fieldIds.search}
      searchPlaceholder="Cliente, cajero o id…"
      searchQuery={state.filters.searchQuery}
      setSearchQuery={actions.setSearchQuery}
    />
  );
}
