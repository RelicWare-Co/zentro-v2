import {
  CircleDollarSign,
  Clock3,
  Filter,
  Receipt,
  Search,
  Store,
  User,
  Wallet,
} from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { Link } from "@/components/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  createPaymentMethodLabelMap,
  formatCurrency,
  formatPaymentMethodLabel,
} from "@/features/pos/utils";
import { useShiftsList } from "./hooks/use-shifts";

const DEFAULT_LIST_PARAMS = {
  limit: 10,
  cursor: 0,
};

const ALL_FILTER_VALUE = "all";

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const countFormatter = new Intl.NumberFormat("es-CO");

function formatCount(value: number) {
  return countFormatter.format(value);
}

function formatShiftStatus(status: string) {
  return status === "open" ? "Abierto" : "Cerrado";
}

function formatShiftRange(openedAt: number, closedAt: number | null) {
  return closedAt
    ? `${dateTimeFormatter.format(openedAt)} - ${dateTimeFormatter.format(closedAt)}`
    : `${dateTimeFormatter.format(openedAt)} - En curso`;
}

function getShiftStatusBadgeClass(status: string) {
  return status === "open"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10"
    : "border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800/80";
}

function getDifferenceClassName(value: number) {
  if (value > 0) {
    return "text-sm font-medium text-emerald-300";
  }
  if (value < 0) {
    return "text-sm font-medium text-rose-300";
  }
  return "text-sm font-medium text-zinc-300";
}

function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatCurrency(value)}`;
}

function formatMovementType(type: string) {
  const labels: Record<string, string> = {
    inflow: "Ingreso manual",
    expense: "Gasto operativo",
    payout: "Pago a proveedor",
  };
  return labels[type] ?? type;
}

export function ShiftsPage() {
  const searchId = useId();
  const statusId = useId();
  const cashierIdField = useId();
  const terminalIdField = useId();
  const paymentMethodIdField = useId();
  const differenceStatusIdField = useId();
  const hasMovementsIdField = useId();
  const startDateIdField = useId();
  const endDateIdField = useId();

  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [differenceStatus, setDifferenceStatus] = useState("");
  const [hasMovements, setHasMovements] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cursor, setCursor] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PARAMS.limit);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const listParams = useMemo(
    () => ({
      limit: pageSize,
      cursor,
      searchQuery: deferredSearchQuery.trim() || null,
      status:
        status === "open" || status === "closed"
          ? (status as "open" | "closed")
          : null,
      cashierId: cashierId || null,
      terminalName: terminalName || null,
      paymentMethod: paymentMethod || null,
      differenceStatus:
        differenceStatus === "short" ||
        differenceStatus === "over" ||
        differenceStatus === "balanced"
          ? (differenceStatus as "short" | "over" | "balanced")
          : null,
      hasMovements:
        hasMovements === "yes" || hasMovements === "no"
          ? (hasMovements as "yes" | "no")
          : null,
      startDate: startDate || null,
      endDate: endDate || null,
    }),
    [
      pageSize,
      cursor,
      deferredSearchQuery,
      status,
      cashierId,
      terminalName,
      paymentMethod,
      differenceStatus,
      hasMovements,
      startDate,
      endDate,
    ]
  );

  useEffect(() => {
    setCursor(0);
  }, []);

  const shiftsQuery = useShiftsList(listParams);
  const shifts = shiftsQuery.data?.data ?? [];
  const filterOptions = shiftsQuery.data?.filterOptions ?? {
    cashiers: [],
    terminals: [],
    paymentMethods: [],
  };
  const totalResults = shiftsQuery.data?.total ?? shifts.length;
  const nextCursor = shiftsQuery.data?.nextCursor ?? null;
  const _hasMore = shiftsQuery.data?.hasMore ?? false;

  const summary = useMemo(
    () =>
      shifts.reduce(
        (accumulator, shift) => {
          accumulator.expectedCash += shift.totals.expectedCash;
          accumulator.expectedPayments += shift.totals.totalPayments;
          accumulator.closureDifference += shift.totals.totalDifference;
          accumulator.movements += shift.movements.length;
          if (shift.status === "open") {
            accumulator.openShifts += 1;
          }
          return accumulator;
        },
        {
          expectedCash: 0,
          expectedPayments: 0,
          closureDifference: 0,
          movements: 0,
          openShifts: 0,
        }
      ),
    [shifts]
  );

  const paymentMethodLabels = useMemo(
    () => createPaymentMethodLabelMap(filterOptions.paymentMethods),
    [filterOptions.paymentMethods]
  );

  const activeFilterCount = [
    searchQuery,
    status,
    cashierId,
    terminalName,
    paymentMethod,
    differenceStatus,
    hasMovements,
    startDate,
    endDate,
  ].filter(Boolean).length;

  const activeAdvancedFilterCount = [
    cashierId,
    terminalName,
    paymentMethod,
    differenceStatus,
    hasMovements,
    startDate,
    endDate,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setIsMobileFilterOpen(false);
    setSearchQuery("");
    setStatus("");
    setCashierId("");
    setTerminalName("");
    setPaymentMethod("");
    setDifferenceStatus("");
    setHasMovements("");
    setStartDate("");
    setEndDate("");
    setCursor(0);
  };

  const updatePagination = (nextCursor: number, nextPageSize = pageSize) => {
    setCursor(nextCursor);
    setPageSize(nextPageSize);
  };

  const rangeStart = totalResults === 0 ? 0 : cursor + 1;
  const rangeEnd = totalResults === 0 ? 0 : cursor + shifts.length;

  const renderAdvancedFilters = (mode: "mobile" | "desktop") => {
    const isMobile = mode === "mobile";
    const idPrefix = isMobile ? "mobile-" : "";
    const inputClassName = `${
      isMobile ? "h-11" : "h-9"
    } border-zinc-700 bg-black/20 text-white placeholder:text-zinc-500`;
    const selectClassName = `${
      isMobile ? "h-11" : "h-9"
    } w-full border-zinc-700 bg-black/20 text-white`;

    return (
      <div className={isMobile ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
        <FilterField htmlFor={`${idPrefix}${cashierIdField}`} label="Cajero">
          <Select
            onValueChange={(value) =>
              setCashierId(value === ALL_FILTER_VALUE ? "" : value)
            }
            value={cashierId || ALL_FILTER_VALUE}
          >
            <SelectTrigger
              className={selectClassName}
              id={`${idPrefix}${cashierIdField}`}
            >
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
              <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
              {filterOptions.cashiers.map((cashier) => (
                <SelectItem key={cashier.id} value={cashier.id}>
                  {cashier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField htmlFor={`${idPrefix}${terminalIdField}`} label="Terminal">
          <Select
            onValueChange={(value) =>
              setTerminalName(value === ALL_FILTER_VALUE ? "" : value)
            }
            value={terminalName || ALL_FILTER_VALUE}
          >
            <SelectTrigger
              className={selectClassName}
              id={`${idPrefix}${terminalIdField}`}
            >
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
              <SelectItem value={ALL_FILTER_VALUE}>Todas</SelectItem>
              {filterOptions.terminals.map((terminal) => (
                <SelectItem key={terminal} value={terminal}>
                  {terminal}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField
          htmlFor={`${idPrefix}${paymentMethodIdField}`}
          label="Metodo"
        >
          <Select
            onValueChange={(value) =>
              setPaymentMethod(value === ALL_FILTER_VALUE ? "" : value)
            }
            value={paymentMethod || ALL_FILTER_VALUE}
          >
            <SelectTrigger
              className={selectClassName}
              id={`${idPrefix}${paymentMethodIdField}`}
            >
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
              <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
              {filterOptions.paymentMethods.map((pm) => (
                <SelectItem key={pm.id} value={pm.id}>
                  {pm.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField
          htmlFor={`${idPrefix}${differenceStatusIdField}`}
          label="Diferencia"
        >
          <Select
            onValueChange={(value) =>
              setDifferenceStatus(value === ALL_FILTER_VALUE ? "" : value)
            }
            value={differenceStatus || ALL_FILTER_VALUE}
          >
            <SelectTrigger
              className={selectClassName}
              id={`${idPrefix}${differenceStatusIdField}`}
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
        </FilterField>

        <FilterField
          htmlFor={`${idPrefix}${hasMovementsIdField}`}
          label="Movimientos"
        >
          <Select
            onValueChange={(value) =>
              setHasMovements(value === ALL_FILTER_VALUE ? "" : value)
            }
            value={hasMovements || ALL_FILTER_VALUE}
          >
            <SelectTrigger
              className={selectClassName}
              id={`${idPrefix}${hasMovementsIdField}`}
            >
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
              <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
              <SelectItem value="yes">Con movimientos</SelectItem>
              <SelectItem value="no">Sin movimientos</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField htmlFor={`${idPrefix}${startDateIdField}`} label="Desde">
          <Input
            className={inputClassName}
            id={`${idPrefix}${startDateIdField}`}
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
        </FilterField>

        <FilterField htmlFor={`${idPrefix}${endDateIdField}`} label="Hasta">
          <Input
            className={inputClassName}
            id={`${idPrefix}${endDateIdField}`}
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            value={endDate}
          />
        </FilterField>
      </div>
    );
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden bg-[var(--color-void)] p-6 font-sans text-[var(--color-photon)] md:p-8 lg:p-12">
      <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-semibold text-3xl text-white tracking-tight">
            Turnos y cierres de caja
          </h1>
          <span className="text-sm text-zinc-400">
            {formatCount(shifts.length)} turnos •{" "}
            {formatCurrency(summary.expectedCash)}
          </span>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            asChild
            className="h-10 w-full shrink-0 rounded-lg border-zinc-800 bg-[var(--color-carbon)] px-4 py-2 text-zinc-300 hover:bg-white/5 hover:text-white sm:w-auto"
            variant="outline"
          >
            <Link href="/dashboard">Ver dashboard</Link>
          </Button>
          <Button
            asChild
            className="h-10 w-full shrink-0 rounded-lg bg-[var(--color-voltage)] px-4 py-2 font-semibold text-black hover:bg-[#c9e605] sm:w-auto"
          >
            <Link href="/pos">
              <Store aria-hidden="true" className="mr-2 size-4" />
              Ir al POS
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <CompactMetricCard
          icon={Receipt}
          title="Turnos cargados"
          value={formatCount(shifts.length)}
        />
        <CompactMetricCard
          icon={Clock3}
          title="Turnos abiertos"
          value={formatCount(summary.openShifts)}
        />
        <CompactMetricCard
          icon={Wallet}
          title="Efectivo esperado"
          value={formatCurrency(summary.expectedCash)}
        />
        <CompactMetricCard
          icon={CircleDollarSign}
          title="Movimientos"
          value={formatCount(summary.movements)}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[var(--color-carbon)]">
        <div className="flex shrink-0 flex-col gap-4 border-zinc-800 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:max-w-xs md:max-w-sm">
              <Search
                aria-hidden="true"
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
              />
              <Input
                className="h-10 rounded-lg border-zinc-800 bg-black/20 pl-9 focus-visible:border-[var(--color-voltage)] focus-visible:ring-[var(--color-voltage)]/20"
                id={searchId}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cajero, terminal o id…"
                value={searchQuery}
              />
            </div>

            <div className="w-full sm:w-[200px]">
              <Select
                onValueChange={(value) =>
                  setStatus(value === ALL_FILTER_VALUE ? "" : value)
                }
                value={status || ALL_FILTER_VALUE}
              >
                <SelectTrigger
                  className="h-10 w-full rounded-lg border-zinc-800 bg-black/20 text-white"
                  id={statusId}
                >
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                  <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
                  <SelectItem value="open">Abierto</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Sheet
              onOpenChange={setIsMobileFilterOpen}
              open={isMobileFilterOpen}
            >
              <SheetTrigger asChild>
                <Button
                  className="h-10 w-full rounded-lg border-zinc-800 bg-black/20 text-zinc-300 hover:bg-white/5 hover:text-white sm:hidden"
                  type="button"
                  variant="outline"
                >
                  <Filter aria-hidden="true" className="mr-2 size-4" />
                  Filtros
                  {activeAdvancedFilterCount > 0 ? (
                    <Badge className="ml-2 rounded-sm bg-[var(--color-voltage)]/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/30">
                      {activeAdvancedFilterCount}
                    </Badge>
                  ) : null}
                </Button>
              </SheetTrigger>
              <SheetContent
                className="h-[85vh] rounded-t-xl border-zinc-800 bg-[var(--color-carbon)] text-white"
                showCloseButton={false}
                side="bottom"
              >
                <SheetHeader className="border-zinc-800 border-b pb-4">
                  <SheetTitle className="text-zinc-200">
                    Filtros avanzados
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  {renderAdvancedFilters("mobile")}
                </div>
                <div className="grid grid-cols-2 gap-3 border-zinc-800 border-t p-4">
                  <Button
                    className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                    onClick={clearFilters}
                    type="button"
                    variant="outline"
                  >
                    Limpiar
                  </Button>
                  <Button
                    className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
                    onClick={() => {
                      setIsMobileFilterOpen(false);
                      setCursor(0);
                    }}
                    type="button"
                  >
                    Aplicar
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className="hidden h-10 rounded-lg border-zinc-800 bg-black/20 text-zinc-300 hover:bg-white/5 hover:text-white sm:inline-flex"
                  type="button"
                  variant="outline"
                >
                  <Filter aria-hidden="true" className="mr-2 size-4" />
                  Filtros
                  {activeAdvancedFilterCount > 0 ? (
                    <Badge className="ml-2 rounded-sm bg-[var(--color-voltage)]/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/30">
                      {activeAdvancedFilterCount}
                    </Badge>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="z-50 w-[600px] rounded-xl border-zinc-800 bg-[var(--color-carbon)] p-4 text-white shadow-xl"
              >
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-zinc-200">
                    Filtros avanzados
                  </h4>
                  {renderAdvancedFilters("desktop")}
                  <div className="flex justify-end pt-2">
                    <Button
                      className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
                      onClick={() => {
                        setCursor(0);
                      }}
                      type="button"
                    >
                      Aplicar filtros
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {activeFilterCount > 0 && (
              <Button
                className="h-10 text-zinc-400 hover:text-white"
                onClick={clearFilters}
                type="button"
                variant="ghost"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {shiftsQuery.isLoading && !shiftsQuery.isPlaceholderData ? (
              <div className="rounded-xl border border-zinc-800 border-dashed px-4 py-16 text-center text-sm text-zinc-500">
                Cargando turnos…
              </div>
            ) : shiftsQuery.isError ? (
              <div className="rounded-xl border border-rose-800 border-dashed px-4 py-16 text-center text-rose-300 text-sm">
                <p className="font-medium">Error al cargar turnos</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {shiftsQuery.error?.message ?? "Intenta de nuevo más tarde."}
                </p>
                <Button
                  className="mt-4 border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                  onClick={() => shiftsQuery.refetch()}
                  type="button"
                  variant="outline"
                >
                  Reintentar
                </Button>
              </div>
            ) : shifts.length > 0 ? (
              shifts.map((shift) => (
                <div
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-black/10 transition-colors hover:border-zinc-700 hover:bg-white/5"
                  key={shift.id}
                >
                  <div className="flex flex-col gap-4 border-zinc-800/50 border-b bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-[var(--color-carbon)] text-zinc-400">
                        <User className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-medium text-white">
                            {shift.cashierName}
                          </h3>
                          <Badge
                            className={`${getShiftStatusBadgeClass(shift.status)} border-0`}
                          >
                            {formatShiftStatus(shift.status)}
                          </Badge>
                          <span className="font-mono text-xs text-zinc-500">
                            #{shift.id.slice(0, 8)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-zinc-400">
                          {shift.terminalName ?? "Caja principal"}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="font-medium text-sm text-zinc-300">
                        {formatShiftRange(shift.openedAt, shift.closedAt)}
                      </p>
                      {shift.notes ? (
                        <p
                          className="mt-1 max-w-[280px] truncate text-xs text-zinc-500 sm:ml-auto"
                          title={shift.notes}
                        >
                          {shift.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 divide-y divide-zinc-800/50 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                    <div className="p-4">
                      <h4 className="mb-3 font-semibold text-xs text-zinc-500 uppercase tracking-wider">
                        Operaciones
                      </h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-zinc-500">
                              Pagadas (
                              {formatCount(shift.operations.paidSalesCount)})
                            </p>
                            <p className="font-medium text-sm text-white">
                              {formatCurrency(shift.operations.paidSalesAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">
                              A crédito (
                              {formatCount(shift.operations.creditSalesCount)})
                            </p>
                            <p className="font-medium text-sm text-white">
                              {formatCurrency(
                                shift.operations.creditSalesAmount
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="border-zinc-800/50 border-t pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">
                              Anuladas (
                              {formatCount(
                                shift.operations.cancelledSalesCount
                              )}
                              )
                            </span>
                            <span className="text-xs text-zinc-300">
                              {formatCurrency(
                                shift.operations.cancelledSalesAmount
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/5 p-4">
                      <h4 className="mb-3 font-semibold text-xs text-zinc-500 uppercase tracking-wider">
                        Valores Esperados
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-xs text-zinc-500">
                              Efectivo Total
                            </p>
                            <p className="font-semibold text-base text-emerald-400">
                              {formatCurrency(shift.totals.expectedCash)}
                            </p>
                            <p className="text-xs text-zinc-500">
                              Base: {formatCurrency(shift.startingCash)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-zinc-500">
                              Otros Pagos ({formatCount(shift.payments.length)})
                            </p>
                            <p className="font-medium text-sm text-white">
                              {formatCurrency(shift.totals.totalPayments)}
                            </p>
                          </div>
                        </div>
                        {shift.paymentBreakdown.length > 0 && (
                          <div className="space-y-1.5 border-zinc-800/50 border-t pt-2">
                            {shift.paymentBreakdown.map((pm) => (
                              <div
                                className="flex items-center justify-between text-xs"
                                key={pm.method}
                              >
                                <span className="text-zinc-400">
                                  {formatPaymentMethodLabel(
                                    pm.method,
                                    paymentMethodLabels
                                  )}
                                </span>
                                <span className="font-medium text-zinc-300">
                                  {formatCurrency(pm.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-black/10 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-semibold text-xs text-zinc-500 uppercase tracking-wider">
                          Cierre y Conciliación
                        </h4>
                        {shift.closures.length > 0 && (
                          <Badge
                            className={`h-6 rounded-md border-0 px-2 py-0.5 ${getDifferenceClassName(shift.totals.totalDifference)}`}
                            variant="outline"
                          >
                            {shift.totals.totalDifference === 0
                              ? "Cuadrado"
                              : formatSignedCurrency(
                                  shift.totals.totalDifference
                                )}
                          </Badge>
                        )}
                      </div>

                      {shift.closures.length > 0 ? (
                        <div className="space-y-2">
                          {shift.closures.map((closure) => (
                            <div
                              className="flex items-center justify-between text-xs"
                              key={closure.paymentMethod}
                            >
                              <span className="text-zinc-300">
                                {formatPaymentMethodLabel(
                                  closure.paymentMethod,
                                  paymentMethodLabels
                                )}
                              </span>
                              <div className="text-right">
                                <span className="block font-medium text-white">
                                  {formatCurrency(closure.actualAmount)}
                                </span>
                                <span className="text-[10px] text-zinc-500">
                                  vs {formatCurrency(closure.expectedAmount)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 italic">
                          El turno sigue abierto o aún no tiene conciliación
                          registrada.
                        </p>
                      )}

                      {shift.movements.length > 0 && (
                        <div className="mt-4 border-zinc-800/50 border-t pt-3">
                          <p className="mb-2 font-medium text-[10px] text-zinc-500 uppercase tracking-wider">
                            Movimientos de caja ({shift.movements.length})
                          </p>
                          <div className="space-y-1.5">
                            {shift.movements.slice(0, 3).map((m) => (
                              <div
                                className="flex items-start justify-between gap-2 text-xs"
                                key={m.id}
                              >
                                <span
                                  className="line-clamp-2 break-words text-zinc-400"
                                  title={m.description}
                                >
                                  {m.description || formatMovementType(m.type)}
                                </span>
                                <span
                                  className={`shrink-0 font-medium ${
                                    m.type === "inflow"
                                      ? "text-emerald-400"
                                      : "text-rose-400"
                                  }`}
                                >
                                  {m.type === "inflow" ? "+" : "-"}
                                  {formatCurrency(m.amount)}
                                </span>
                              </div>
                            ))}
                            {shift.movements.length > 3 && (
                              <p className="mt-1 text-[10px] text-zinc-500 italic">
                                + {shift.movements.length - 3} movimientos más
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-zinc-800 border-dashed px-4 py-16 text-center text-sm text-zinc-500">
                No hay turnos que coincidan con los filtros actuales.
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-between gap-4 border-zinc-800 border-t bg-black/10 p-4 text-sm text-zinc-400 sm:flex-row">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-start">
            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <Select
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCursor(0);
                }}
                value={`${pageSize}`}
              >
                <SelectTrigger className="h-8 w-[70px] rounded-md border-zinc-700 bg-[var(--color-carbon)] text-white">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                  {[10, 20, 30, 40, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>filas</span>
            </div>
            <div className="hidden tabular-nums sm:block">
              {rangeStart}-{rangeEnd} de {totalResults}
            </div>
          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Button
              className="h-8 rounded-md border-zinc-700 bg-[var(--color-carbon)] px-3 text-zinc-300 hover:bg-white/5 hover:text-white"
              disabled={cursor <= 0}
              onClick={() => updatePagination(Math.max(cursor - pageSize, 0))}
              size="sm"
              type="button"
              variant="outline"
            >
              Anterior
            </Button>
            <Button
              className="h-8 rounded-md border-none bg-[var(--color-voltage)] px-4 font-medium text-black hover:bg-[#c9e605]"
              disabled={!nextCursor}
              onClick={() => nextCursor && updatePagination(nextCursor)}
              size="sm"
              type="button"
              variant="default"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function CompactMetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Receipt;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-xs text-zinc-400">{title}</p>
        <p className="truncate font-semibold text-lg text-white tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-zinc-400" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
