import { Select, TextInput } from "@mantine/core";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import { ShiftsFilterField } from "@/features/shifts/components/shifts-ui-primitives";
import { useShiftsPage } from "@/features/shifts/shifts-page-context";
import { darkInputStyles, darkSelectStyles } from "@/lib/mantine-dark";

function ShiftsAdvancedFiltersFields({
  layout,
}: {
  layout: "mobile" | "desktop";
}) {
  const { state, actions, meta } = useShiftsPage();
  const { filters } = state;
  const isMobile = layout === "mobile";
  const idPrefix = isMobile ? "mobile-" : "";
  const size = isMobile ? "md" : "sm";

  return (
    <div className={isMobile ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.cashier}`}
        label="Cajero"
      >
        <Select
          data={[
            { value: ALL_FILTER_VALUE, label: "Todos" },
            ...state.filterOptions.cashiers.map((cashier) => ({
              value: cashier.id,
              label: cashier.name,
            })),
          ]}
          id={`${idPrefix}${meta.fieldIds.cashier}`}
          onChange={(value) =>
            actions.setCashierId(
              !value || value === ALL_FILTER_VALUE ? "" : value
            )
          }
          placeholder="Todos"
          size={size}
          styles={darkSelectStyles}
          value={filters.cashierId || ALL_FILTER_VALUE}
        />
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.terminal}`}
        label="Terminal"
      >
        <Select
          data={[
            { value: ALL_FILTER_VALUE, label: "Todas" },
            ...state.filterOptions.terminals.map((terminal) => ({
              value: terminal,
              label: terminal,
            })),
          ]}
          id={`${idPrefix}${meta.fieldIds.terminal}`}
          onChange={(value) =>
            actions.setTerminalName(
              !value || value === ALL_FILTER_VALUE ? "" : value
            )
          }
          placeholder="Todas"
          size={size}
          styles={darkSelectStyles}
          value={filters.terminalName || ALL_FILTER_VALUE}
        />
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.paymentMethod}`}
        label="Metodo"
      >
        <Select
          data={[
            { value: ALL_FILTER_VALUE, label: "Todos" },
            ...state.filterOptions.paymentMethods.map((paymentMethod) => ({
              value: paymentMethod.id,
              label: paymentMethod.label,
            })),
          ]}
          id={`${idPrefix}${meta.fieldIds.paymentMethod}`}
          onChange={(value) =>
            actions.setPaymentMethod(
              !value || value === ALL_FILTER_VALUE ? "" : value
            )
          }
          placeholder="Todos"
          size={size}
          styles={darkSelectStyles}
          value={filters.paymentMethod || ALL_FILTER_VALUE}
        />
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.differenceStatus}`}
        label="Diferencia"
      >
        <Select
          data={[
            { value: ALL_FILTER_VALUE, label: "Todas" },
            { value: "short", label: "Faltante" },
            { value: "over", label: "Sobrante" },
            { value: "balanced", label: "Cuadrada" },
          ]}
          id={`${idPrefix}${meta.fieldIds.differenceStatus}`}
          onChange={(value) =>
            actions.setDifferenceStatus(
              !value || value === ALL_FILTER_VALUE ? "" : value
            )
          }
          placeholder="Todas"
          size={size}
          styles={darkSelectStyles}
          value={filters.differenceStatus || ALL_FILTER_VALUE}
        />
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.hasMovements}`}
        label="Movimientos"
      >
        <Select
          data={[
            { value: ALL_FILTER_VALUE, label: "Todos" },
            { value: "yes", label: "Con movimientos" },
            { value: "no", label: "Sin movimientos" },
          ]}
          id={`${idPrefix}${meta.fieldIds.hasMovements}`}
          onChange={(value) =>
            actions.setHasMovements(
              !value || value === ALL_FILTER_VALUE ? "" : value
            )
          }
          placeholder="Todos"
          size={size}
          styles={darkSelectStyles}
          value={filters.hasMovements || ALL_FILTER_VALUE}
        />
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.startDate}`}
        label="Desde"
      >
        <TextInput
          id={`${idPrefix}${meta.fieldIds.startDate}`}
          onChange={(event) => actions.setStartDate(event.target.value)}
          size={size}
          styles={darkInputStyles}
          type="date"
          value={filters.startDate}
        />
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.endDate}`}
        label="Hasta"
      >
        <TextInput
          id={`${idPrefix}${meta.fieldIds.endDate}`}
          onChange={(event) => actions.setEndDate(event.target.value)}
          size={size}
          styles={darkInputStyles}
          type="date"
          value={filters.endDate}
        />
      </ShiftsFilterField>
    </div>
  );
}

export function ShiftsAdvancedFiltersMobile() {
  return <ShiftsAdvancedFiltersFields layout="mobile" />;
}

export function ShiftsAdvancedFiltersDesktop() {
  return <ShiftsAdvancedFiltersFields layout="desktop" />;
}
