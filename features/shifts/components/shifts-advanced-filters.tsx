import { FilterDateField } from "@/features/listing/filters/filter-date-field";
import { FilterSection } from "@/features/listing/filters/filter-section";
import {
  FilterSelect,
  type FilterSelectOption,
} from "@/features/listing/filters/filter-select";
import {
  SHIFT_DIFFERENCE_STATUS_LABELS,
  SHIFT_DIFFERENCE_STATUS_VALUES,
  SHIFT_HAS_MOVEMENTS_LABELS,
  SHIFT_HAS_MOVEMENTS_VALUES,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_VALUES,
} from "@/features/shifts/shifts-page.constants.shared";
import { useShiftsPage } from "@/features/shifts/shifts-page-context";

export function ShiftsAdvancedFiltersFields({
  layout,
}: {
  layout: "mobile" | "desktop";
}) {
  const { state, actions, meta } = useShiftsPage();
  const { filters } = state;
  const isMobile = layout === "mobile";
  const idPrefix = isMobile ? "mobile-" : "";
  const size = isMobile ? "md" : "sm";

  const cashierOptions: FilterSelectOption[] = state.filterOptions.cashiers.map(
    (cashier) => ({ value: cashier.id, label: cashier.name })
  );
  const paymentMethodOptions: FilterSelectOption[] =
    state.filterOptions.paymentMethods.map((paymentMethod) => ({
      value: paymentMethod.id,
      label: paymentMethod.label,
    }));
  const terminalOptions: FilterSelectOption[] =
    state.filterOptions.terminals.map((terminal) => ({
      value: terminal,
      label: terminal,
    }));

  return (
    <div
      className={
        isMobile
          ? "space-y-6"
          : "grid items-start gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      <FilterSection title="Estado">
        <FilterSelect
          allLabel="Todos"
          id={`${idPrefix}${meta.fieldIds.status}`}
          label="Estado"
          onChange={actions.setStatus}
          options={SHIFT_STATUS_VALUES.map((value) => ({
            value,
            label: SHIFT_STATUS_LABELS[value],
          }))}
          size={size}
          value={filters.status}
        />
        <FilterSelect
          allLabel="Todas"
          id={`${idPrefix}${meta.fieldIds.differenceStatus}`}
          label="Diferencia"
          onChange={actions.setDifferenceStatus}
          options={SHIFT_DIFFERENCE_STATUS_VALUES.map((value) => ({
            value,
            label: SHIFT_DIFFERENCE_STATUS_LABELS[value],
          }))}
          size={size}
          value={filters.differenceStatus}
        />
        <FilterSelect
          allLabel="Todos"
          id={`${idPrefix}${meta.fieldIds.hasMovements}`}
          label="Movimientos"
          onChange={actions.setHasMovements}
          options={SHIFT_HAS_MOVEMENTS_VALUES.map((value) => ({
            value,
            label: SHIFT_HAS_MOVEMENTS_LABELS[value],
          }))}
          size={size}
          value={filters.hasMovements}
        />
      </FilterSection>

      <FilterSection title="Personas y lugar">
        <FilterSelect
          allLabel="Todos"
          id={`${idPrefix}${meta.fieldIds.cashier}`}
          label="Cajero"
          onChange={actions.setCashierId}
          options={cashierOptions}
          size={size}
          value={filters.cashierId}
        />
        <FilterSelect
          allLabel="Todos"
          id={`${idPrefix}${meta.fieldIds.paymentMethod}`}
          label="Medio de pago"
          onChange={actions.setPaymentMethod}
          options={paymentMethodOptions}
          size={size}
          value={filters.paymentMethod}
        />
        <FilterSelect
          allLabel="Todas"
          id={`${idPrefix}${meta.fieldIds.terminal}`}
          label="Terminal"
          onChange={actions.setTerminalName}
          options={terminalOptions}
          size={size}
          value={filters.terminalName}
        />
      </FilterSection>

      <FilterSection title="Período">
        <FilterDateField
          id={`${idPrefix}${meta.fieldIds.startDate}`}
          label="Desde"
          onChange={actions.setStartDate}
          size={size}
          value={filters.startDate}
        />
        <FilterDateField
          id={`${idPrefix}${meta.fieldIds.endDate}`}
          label="Hasta"
          onChange={actions.setEndDate}
          size={size}
          value={filters.endDate}
        />
      </FilterSection>
    </div>
  );
}
