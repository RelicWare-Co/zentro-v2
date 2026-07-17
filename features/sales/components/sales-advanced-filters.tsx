import { Select, TextInput } from "@mantine/core";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import { SalesFilterField } from "@/features/sales/components/sales-ui-primitives";
import { useSalesPage } from "@/features/sales/sales-page-context";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

function SalesAdvancedFiltersFields({
  layout,
}: {
  layout: "mobile" | "desktop";
}) {
  const { state, actions, meta } = useSalesPage();
  const { filters } = state;
  const isMobile = layout === "mobile";
  const idPrefix = isMobile ? "mobile-" : "";
  const size = isMobile ? "md" : "sm";
  const comboboxProps = isMobile ? undefined : { withinPortal: false };

  return (
    <div className={isMobile ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.paymentMethod}`}
        label="Medio de pago"
      >
        <Select
          comboboxProps={comboboxProps}
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
          value={filters.paymentMethod || ALL_FILTER_VALUE}
        />
      </SalesFilterField>

      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.cashier}`}
        label="Cajero"
      >
        <Select
          comboboxProps={comboboxProps}
          data={[
            { value: ALL_FILTER_VALUE, label: "Todos" },
            ...state.filterOptions.cashiers.map((cashier) => ({
              value: cashier.id,
              label: cashier.name ?? "Cajero",
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
          value={filters.cashierId || ALL_FILTER_VALUE}
        />
      </SalesFilterField>

      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.terminal}`}
        label="Terminal"
      >
        <Select
          comboboxProps={comboboxProps}
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
          value={filters.terminalName || ALL_FILTER_VALUE}
        />
      </SalesFilterField>

      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.balanceStatus}`}
        label="Estado de saldo"
      >
        <Select
          comboboxProps={comboboxProps}
          data={[
            { value: ALL_FILTER_VALUE, label: "Todos" },
            { value: "with_balance", label: "Con saldo pendiente" },
            { value: "settled", label: "Sin saldo" },
          ]}
          id={`${idPrefix}${meta.fieldIds.balanceStatus}`}
          onChange={(value) =>
            actions.setBalanceStatus(
              !value || value === ALL_FILTER_VALUE ? "" : value
            )
          }
          placeholder="Todos"
          size={size}
          value={filters.balanceStatus || ALL_FILTER_VALUE}
        />
      </SalesFilterField>

      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.amountMin}`}
        label="Monto mínimo"
      >
        <TextInput
          autoComplete="off"
          id={`${idPrefix}${meta.fieldIds.amountMin}`}
          inputMode="numeric"
          onChange={(event) =>
            actions.setAmountMin(sanitizeMoneyInput(event.target.value))
          }
          placeholder="Ej. 5.000…"
          size={size}
          type="text"
          value={formatMoneyInput(filters.amountMin)}
        />
      </SalesFilterField>

      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.amountMax}`}
        label="Monto máximo"
      >
        <TextInput
          autoComplete="off"
          id={`${idPrefix}${meta.fieldIds.amountMax}`}
          inputMode="numeric"
          onChange={(event) =>
            actions.setAmountMax(sanitizeMoneyInput(event.target.value))
          }
          placeholder="Ej. 25.000…"
          size={size}
          type="text"
          value={formatMoneyInput(filters.amountMax)}
        />
      </SalesFilterField>

      {meta.isTodayView ? (
        <div
          className={
            isMobile
              ? "rounded-2xl border border-[var(--color-voltage)]/20 border-dashed bg-[var(--color-voltage)]/5 px-4 py-3 text-sm text-zinc-300"
              : "rounded-2xl border border-[var(--color-voltage)]/20 border-dashed bg-[var(--color-voltage)]/5 px-4 py-3 text-sm text-zinc-300 md:col-span-2"
          }
        >
          <p className="font-medium text-white">
            Ventana: {meta.salesWindowLabel}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Mostrando solo las ventas asociadas a este turno.
          </p>
        </div>
      ) : (
        <>
          <SalesFilterField
            htmlFor={`${idPrefix}${meta.fieldIds.startDate}`}
            label="Desde"
          >
            <TextInput
              autoComplete="off"
              id={`${idPrefix}${meta.fieldIds.startDate}`}
              onChange={(event) => actions.setStartDate(event.target.value)}
              size={size}
              type="date"
              value={filters.startDate}
            />
          </SalesFilterField>
          <SalesFilterField
            htmlFor={`${idPrefix}${meta.fieldIds.endDate}`}
            label="Hasta"
          >
            <TextInput
              autoComplete="off"
              id={`${idPrefix}${meta.fieldIds.endDate}`}
              onChange={(event) => actions.setEndDate(event.target.value)}
              size={size}
              type="date"
              value={filters.endDate}
            />
          </SalesFilterField>
        </>
      )}
    </div>
  );
}

export function SalesAdvancedFiltersMobile() {
  return <SalesAdvancedFiltersFields layout="mobile" />;
}

export function SalesAdvancedFiltersDesktop() {
  return <SalesAdvancedFiltersFields layout="desktop" />;
}
