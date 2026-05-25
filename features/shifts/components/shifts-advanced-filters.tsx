import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import { ShiftsFilterField } from "@/features/shifts/components/shifts-ui-primitives";
import { useShiftsPage } from "@/features/shifts/shifts-page-context";

function ShiftsAdvancedFiltersFields({
  layout,
}: {
  layout: "mobile" | "desktop";
}) {
  const { state, actions, meta } = useShiftsPage();
  const { filters } = state;
  const isMobile = layout === "mobile";
  const idPrefix = isMobile ? "mobile-" : "";
  const inputClassName = `${
    isMobile ? "h-11" : "h-9"
  } border-zinc-700 bg-black/20 text-white placeholder:text-zinc-500`;
  const selectClassName = `${
    isMobile ? "h-11" : "h-9"
  } w-full border-zinc-700 bg-black/20 text-white`;

  return (
    <div className={isMobile ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
      <ShiftsFilterField
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
                {cashier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ShiftsFilterField>

      <ShiftsFilterField
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
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.paymentMethod}`}
        label="Metodo"
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
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.differenceStatus}`}
        label="Diferencia"
      >
        <Select
          onValueChange={(value) =>
            actions.setDifferenceStatus(value === ALL_FILTER_VALUE ? "" : value)
          }
          value={filters.differenceStatus || ALL_FILTER_VALUE}
        >
          <SelectTrigger
            className={selectClassName}
            id={`${idPrefix}${meta.fieldIds.differenceStatus}`}
          >
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>Todas</SelectItem>
            <SelectItem value="short">Faltante</SelectItem>
            <SelectItem value="over">Sobrante</SelectItem>
            <SelectItem value="balanced">Cuadrada</SelectItem>
          </SelectContent>
        </Select>
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.hasMovements}`}
        label="Movimientos"
      >
        <Select
          onValueChange={(value) =>
            actions.setHasMovements(value === ALL_FILTER_VALUE ? "" : value)
          }
          value={filters.hasMovements || ALL_FILTER_VALUE}
        >
          <SelectTrigger
            className={selectClassName}
            id={`${idPrefix}${meta.fieldIds.hasMovements}`}
          >
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
            <SelectItem value="yes">Con movimientos</SelectItem>
            <SelectItem value="no">Sin movimientos</SelectItem>
          </SelectContent>
        </Select>
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.startDate}`}
        label="Desde"
      >
        <Input
          className={inputClassName}
          id={`${idPrefix}${meta.fieldIds.startDate}`}
          onChange={(event) => actions.setStartDate(event.target.value)}
          type="date"
          value={filters.startDate}
        />
      </ShiftsFilterField>

      <ShiftsFilterField
        htmlFor={`${idPrefix}${meta.fieldIds.endDate}`}
        label="Hasta"
      >
        <Input
          className={inputClassName}
          id={`${idPrefix}${meta.fieldIds.endDate}`}
          onChange={(event) => actions.setEndDate(event.target.value)}
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
