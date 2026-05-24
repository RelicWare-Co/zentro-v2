import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import { SalesFilterField } from "@/features/sales/components/sales-ui-primitives";
import { useSalesPage } from "@/features/sales/sales-page-context";

function SalesAdvancedFiltersFields({
  layout,
}: {
  layout: "mobile" | "desktop";
}) {
  const { state, actions, meta } = useSalesPage();
  const { filters } = state;
  const isMobile = layout === "mobile";
  const idPrefix = isMobile ? "mobile-" : "";
  const inputClassName = isMobile
    ? "h-11 border-zinc-700 bg-black/20 text-white placeholder:text-zinc-500"
    : "h-9 border-zinc-700 bg-black/20 text-white placeholder:text-zinc-500";
  const selectClassName = `${isMobile ? "h-11" : "h-9"} w-full border-zinc-700 bg-black/20 text-white`;

  return (
    <div className={isMobile ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.paymentMethod}`}
        label="Medio de pago"
      >
        <Select
          onValueChange={(value) =>
            actions.setPaymentMethod(value === ALL_FILTER_VALUE ? "" : value)
          }
          value={filters.paymentMethod || ALL_FILTER_VALUE}
        >
          <SelectTrigger
            className={selectClassName}
            id={`${idPrefix}${meta.fieldIds.paymentMethod}`}
          >
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
            {state.filterOptions.paymentMethods.map((paymentMethod) => (
              <SelectItem key={paymentMethod.id} value={paymentMethod.id}>
                {paymentMethod.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SalesFilterField>

      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.cashier}`}
        label="Cajero"
      >
        <Select
          onValueChange={(value) =>
            actions.setCashierId(value === ALL_FILTER_VALUE ? "" : value)
          }
          value={filters.cashierId || ALL_FILTER_VALUE}
        >
          <SelectTrigger
            className={selectClassName}
            id={`${idPrefix}${meta.fieldIds.cashier}`}
          >
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
            {state.filterOptions.cashiers.map((cashier) => (
              <SelectItem key={cashier.id} value={cashier.id}>
                {cashier.name ?? "Cajero"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SalesFilterField>

      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.terminal}`}
        label="Terminal"
      >
        <Select
          onValueChange={(value) =>
            actions.setTerminalName(value === ALL_FILTER_VALUE ? "" : value)
          }
          value={filters.terminalName || ALL_FILTER_VALUE}
        >
          <SelectTrigger
            className={selectClassName}
            id={`${idPrefix}${meta.fieldIds.terminal}`}
          >
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>Todas</SelectItem>
            {state.filterOptions.terminals.map((terminal) => (
              <SelectItem key={terminal} value={terminal}>
                {terminal}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SalesFilterField>

      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.balanceStatus}`}
        label="Estado de saldo"
      >
        <Select
          onValueChange={(value) =>
            actions.setBalanceStatus(value === ALL_FILTER_VALUE ? "" : value)
          }
          value={filters.balanceStatus || ALL_FILTER_VALUE}
        >
          <SelectTrigger
            className={selectClassName}
            id={`${idPrefix}${meta.fieldIds.balanceStatus}`}
          >
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
            <SelectItem value="with_balance">Con saldo pendiente</SelectItem>
            <SelectItem value="settled">Sin saldo</SelectItem>
          </SelectContent>
        </Select>
      </SalesFilterField>

      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.amountMin}`}
        label="Monto mínimo"
      >
        <Input
          autoComplete="off"
          className={inputClassName}
          id={`${idPrefix}${meta.fieldIds.amountMin}`}
          inputMode="numeric"
          min={0}
          onChange={(event) => actions.setAmountMin(event.target.value)}
          placeholder="Ej. 5000…"
          step={500}
          type="number"
          value={filters.amountMin}
        />
      </SalesFilterField>

      <SalesFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.amountMax}`}
        label="Monto máximo"
      >
        <Input
          autoComplete="off"
          className={inputClassName}
          id={`${idPrefix}${meta.fieldIds.amountMax}`}
          inputMode="numeric"
          min={0}
          onChange={(event) => actions.setAmountMax(event.target.value)}
          placeholder="Ej. 25000…"
          step={500}
          type="number"
          value={filters.amountMax}
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
          <p className="font-medium text-white">Fecha fija en hoy</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Mostrando solo ventas del {meta.todayLabel}.
          </p>
        </div>
      ) : (
        <>
          <SalesFilterField
            htmlFor={`${idPrefix}${meta.fieldIds.startDate}`}
            label="Desde"
          >
            <Input
              autoComplete="off"
              className={inputClassName}
              id={`${idPrefix}${meta.fieldIds.startDate}`}
              onChange={(event) => actions.setStartDate(event.target.value)}
              type="date"
              value={filters.startDate}
            />
          </SalesFilterField>
          <SalesFilterField
            htmlFor={`${idPrefix}${meta.fieldIds.endDate}`}
            label="Hasta"
          >
            <Input
              autoComplete="off"
              className={inputClassName}
              id={`${idPrefix}${meta.fieldIds.endDate}`}
              onChange={(event) => actions.setEndDate(event.target.value)}
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
