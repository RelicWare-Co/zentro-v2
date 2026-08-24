import { FilterDateField } from "@/features/listing/filters/filter-date-field";
import { FilterMoneyField } from "@/features/listing/filters/filter-money-field";
import { FilterSection } from "@/features/listing/filters/filter-section";
import {
  FilterSelect,
  type FilterSelectOption,
} from "@/features/listing/filters/filter-select";
import {
  SALE_BALANCE_STATUS_LABELS,
  SALE_BALANCE_STATUS_VALUES,
  SALE_STATUS_LABELS,
  SALE_STATUS_VALUES,
} from "@/features/sales/sales-page.constants.shared";
import { useSalesPage } from "@/features/sales/sales-page-context";

export function SalesAdvancedFiltersFields({
  layout,
}: {
  layout: "mobile" | "desktop";
}) {
  const { state, actions, meta } = useSalesPage();
  const { filters } = state;
  const isMobile = layout === "mobile";
  const idPrefix = isMobile ? "mobile-" : "";
  const size = isMobile ? "md" : "sm";

  const cashierOptions: FilterSelectOption[] = state.filterOptions.cashiers.map(
    (cashier) => ({ value: cashier.id, label: cashier.name ?? "Cajero" })
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
          : "grid items-start gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4"
      }
    >
      <FilterSection title="Estado">
        <FilterSelect
          allLabel="Todos"
          id={`${idPrefix}${meta.fieldIds.status}`}
          label="Estado"
          onChange={actions.setStatus}
          options={SALE_STATUS_VALUES.map((value) => ({
            value,
            label: SALE_STATUS_LABELS[value],
          }))}
          size={size}
          value={filters.status}
        />
        <FilterSelect
          allLabel="Todos"
          id={`${idPrefix}${meta.fieldIds.balanceStatus}`}
          label="Saldo pendiente"
          onChange={actions.setBalanceStatus}
          options={SALE_BALANCE_STATUS_VALUES.map((value) => ({
            value,
            label: SALE_BALANCE_STATUS_LABELS[value],
          }))}
          size={size}
          value={filters.balanceStatus}
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

      <FilterSection title="Montos">
        <FilterMoneyField
          id={`${idPrefix}${meta.fieldIds.amountMin}`}
          label="Monto mínimo"
          onChange={actions.setAmountMin}
          placeholder="Ej. 5.000…"
          size={size}
          value={filters.amountMin}
        />
        <FilterMoneyField
          id={`${idPrefix}${meta.fieldIds.amountMax}`}
          label="Monto máximo"
          onChange={actions.setAmountMax}
          placeholder="Ej. 25.000…"
          size={size}
          value={filters.amountMax}
        />
      </FilterSection>

      <FilterSection title="Período">
        {meta.isTodayView ? (
          <div className="rounded-2xl border border-[var(--color-voltage)]/20 border-dashed bg-[var(--color-voltage)]/5 px-4 py-3 text-sm text-zinc-300">
            <p className="font-medium text-white">
              Ventana: {meta.salesWindowLabel}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Mostrando solo las ventas asociadas a este turno.
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </FilterSection>
    </div>
  );
}
