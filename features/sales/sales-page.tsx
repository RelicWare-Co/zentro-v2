import {
  ArrowRight,
  Clock3,
  Filter,
  Receipt,
  Search,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Link } from "@/components/Link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useActiveShift,
  useCancelSaleMutation,
  useSaleDetail,
  useSalesList,
} from "./hooks/use-sales";

const DEFAULT_LIST_PARAMS = {
  limit: 10,
  cursor: 0,
};

const ALL_FILTER_VALUE = "all";
const SALES_VIEW_VALUES = ["today", "history"] as const;
const DEFAULT_SALES_VIEW = "today" as const;
const SALE_STATUS_VALUES = ["completed", "credit", "cancelled"] as const;
const SALE_BALANCE_STATUS_VALUES = ["with_balance", "settled"] as const;

type SalesView = (typeof SALES_VIEW_VALUES)[number];

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
});

function getCurrentDateFilterValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

function formatSaleStatus(status: string) {
  if (status === "credit") {
    return "Credito";
  }
  if (status === "completed") {
    return "Pagada";
  }
  if (status === "cancelled") {
    return "Cancelada";
  }
  return status;
}

function getSaleStatusBadgeClass(status: string) {
  if (status === "credit") {
    return "border-sky-500/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/10";
  }
  if (status === "completed") {
    return "border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10";
  }
  if (status === "cancelled") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/10";
  }
  return "border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800/80";
}

function formatPaymentSummary(
  sale: { status: string; paymentMethods: string[] },
  labelMap?: Record<string, string>
) {
  if (sale.status === "cancelled") {
    return "Venta anulada";
  }
  if (sale.paymentMethods.length === 0) {
    return sale.status === "credit" ? "Venta a credito" : "Sin pagos";
  }
  return sale.paymentMethods.map((m) => labelMap?.[m] ?? m).join(" + ");
}

function formatItemCountLabel(itemCount: number) {
  return `${itemCount} item${itemCount === 1 ? "" : "s"}`;
}

function resolveDateFilters(
  activeView: SalesView,
  todayDate: string,
  startDate: string,
  endDate: string
) {
  if (activeView === "today") {
    return { startDate: todayDate, endDate: todayDate };
  }
  return { startDate: startDate || null, endDate: endDate || null };
}

function resolveAmountRange(amountMin: string, amountMax: string) {
  const min = amountMin ? Number(amountMin) : null;
  const max = amountMax ? Number(amountMax) : null;
  const resolvedMin =
    min !== null && Number.isFinite(min) && min >= 0 ? Math.trunc(min) : null;
  const resolvedMax =
    max !== null && Number.isFinite(max) && max >= 0 ? Math.trunc(max) : null;
  if (
    resolvedMin !== null &&
    resolvedMax !== null &&
    resolvedMin > resolvedMax
  ) {
    return { min: resolvedMax, max: resolvedMin };
  }
  return { min: resolvedMin, max: resolvedMax };
}

function resolveSaleStatus(status: string) {
  if ((SALE_STATUS_VALUES as readonly string[]).includes(status)) {
    return status as "completed" | "credit" | "cancelled";
  }
  return null;
}

function resolveBalanceStatus(balanceStatus: string) {
  if (
    (SALE_BALANCE_STATUS_VALUES as readonly string[]).includes(balanceStatus)
  ) {
    return balanceStatus as "with_balance" | "settled";
  }
  return null;
}

function useSalesListParams({
  activeView,
  amountMax,
  amountMin,
  balanceStatus,
  cashierId,
  cursor,
  deferredSearchQuery,
  endDate,
  pageSize,
  paymentMethod,
  startDate,
  status,
  terminalName,
  todayDate,
}: {
  activeView: SalesView;
  amountMax: string;
  amountMin: string;
  balanceStatus: string;
  cashierId: string;
  cursor: number;
  deferredSearchQuery: string;
  endDate: string;
  pageSize: number;
  paymentMethod: string;
  startDate: string;
  status: string;
  terminalName: string;
  todayDate: string;
}) {
  return useMemo(() => {
    const resolvedDateFilters = resolveDateFilters(
      activeView,
      todayDate,
      startDate,
      endDate
    );
    const { min: finalMin, max: finalMax } = resolveAmountRange(
      amountMin,
      amountMax
    );

    return {
      limit: pageSize,
      cursor,
      searchQuery: deferredSearchQuery.trim() || null,
      status: resolveSaleStatus(status),
      paymentMethod: paymentMethod || null,
      cashierId: cashierId || null,
      terminalName: terminalName || null,
      balanceStatus: resolveBalanceStatus(balanceStatus),
      amountMin: finalMin,
      amountMax: finalMax,
      startDate: resolvedDateFilters.startDate,
      endDate: resolvedDateFilters.endDate,
    };
  }, [
    activeView,
    amountMax,
    amountMin,
    balanceStatus,
    cashierId,
    cursor,
    deferredSearchQuery,
    endDate,
    pageSize,
    paymentMethod,
    startDate,
    status,
    terminalName,
    todayDate,
  ]);
}

function useSalesViewSummary(
  isTodayView: boolean,
  todayLabel: string,
  activeFilterCount: number
) {
  return useMemo(() => {
    if (isTodayView) {
      return {
        kicker: `Solo ${todayLabel}`,
        title: "Ventas de hoy",
        description:
          "Consulta lo que pasó hoy sin mezclar operaciones anteriores.",
        resultsTitle: "Ventas del dia",
        resultsDescription: "Registros creados durante el dia actual",
        revenueTitle: "Ingreso del dia",
        revenueDescription: "Total facturado hoy",
        pendingTitle: "Saldo pendiente hoy",
        pendingDescription: "Pendientes abiertos del dia actual",
        listTitle: "Ventas de hoy",
        listDescription:
          "Vista operativa del día con acceso rápido al detalle de cada venta.",
        emptyTitle: "No hay ventas registradas hoy.",
      };
    }
    return {
      kicker: "Consulta completa",
      title: "Historial de ventas",
      description:
        "Consulta ventas pasadas con filtros por fecha, estado y medio de pago.",
      resultsTitle: "Ventas cargadas",
      resultsDescription:
        activeFilterCount > 0
          ? "Resultados del filtro actual"
          : "Ultimos registros disponibles en pantalla",
      revenueTitle: "Monto acumulado",
      revenueDescription: "Suma de las ventas listadas",
      pendingTitle: "Saldo pendiente",
      pendingDescription: "Principalmente ventas a credito",
      listTitle: "Historial de ventas",
      listDescription:
        "Usa esta vista para revisar ventas anteriores, pagos y saldos.",
      emptyTitle: "No se han registrado ventas todavia.",
    };
  }, [isTodayView, todayLabel, activeFilterCount]);
}

function AdvancedFilters({
  mode,
  isTodayView,
  todayLabel,
  paymentMethod,
  setPaymentMethod,
  cashierId,
  setCashierId,
  terminalName,
  setTerminalName,
  balanceStatus,
  setBalanceStatus,
  amountMin,
  setAmountMin,
  amountMax,
  setAmountMax,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  ids,
  options,
}: {
  mode: "mobile" | "desktop";
  isTodayView: boolean;
  todayLabel: string;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  cashierId: string;
  setCashierId: (value: string) => void;
  terminalName: string;
  setTerminalName: (value: string) => void;
  balanceStatus: string;
  setBalanceStatus: (value: string) => void;
  amountMin: string;
  setAmountMin: (value: string) => void;
  amountMax: string;
  setAmountMax: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  ids: {
    paymentMethod: string;
    cashier: string;
    terminal: string;
    balanceStatus: string;
    amountMin: string;
    amountMax: string;
    startDate: string;
    endDate: string;
  };
  options: {
    paymentMethods: Array<{ id: string; label: string }>;
    cashiers: Array<{ id: string; name: string | null }>;
    terminals: string[];
  };
}) {
  const isMobile = mode === "mobile";
  const idPrefix = isMobile ? "mobile-" : "";
  const inputClassName = isMobile
    ? "h-11 border-zinc-700 bg-black/20 text-white placeholder:text-zinc-500"
    : "h-9 border-zinc-700 bg-black/20 text-white placeholder:text-zinc-500";
  const selectClassName = `${isMobile ? "h-11" : "h-9"} w-full border-zinc-700 bg-black/20 text-white`;

  return (
    <div className={isMobile ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
      <FilterField
        htmlFor={`${idPrefix}${ids.paymentMethod}`}
        label="Medio de pago"
      >
        <Select
          onValueChange={(value) =>
            setPaymentMethod(value === ALL_FILTER_VALUE ? "" : value)
          }
          value={paymentMethod || ALL_FILTER_VALUE}
        >
          <SelectTrigger
            className={selectClassName}
            id={`${idPrefix}${ids.paymentMethod}`}
          >
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
            {options.paymentMethods.map((pm) => (
              <SelectItem key={pm.id} value={pm.id}>
                {pm.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor={`${idPrefix}${ids.cashier}`} label="Cajero">
        <Select
          onValueChange={(value) =>
            setCashierId(value === ALL_FILTER_VALUE ? "" : value)
          }
          value={cashierId || ALL_FILTER_VALUE}
        >
          <SelectTrigger
            className={selectClassName}
            id={`${idPrefix}${ids.cashier}`}
          >
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
            {options.cashiers.map((cashier) => (
              <SelectItem key={cashier.id} value={cashier.id}>
                {cashier.name ?? "Cajero"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor={`${idPrefix}${ids.terminal}`} label="Terminal">
        <Select
          onValueChange={(value) =>
            setTerminalName(value === ALL_FILTER_VALUE ? "" : value)
          }
          value={terminalName || ALL_FILTER_VALUE}
        >
          <SelectTrigger
            className={selectClassName}
            id={`${idPrefix}${ids.terminal}`}
          >
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>Todas</SelectItem>
            {options.terminals.map((terminal) => (
              <SelectItem key={terminal} value={terminal}>
                {terminal}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField
        htmlFor={`${idPrefix}${ids.balanceStatus}`}
        label="Estado de saldo"
      >
        <Select
          onValueChange={(value) =>
            setBalanceStatus(value === ALL_FILTER_VALUE ? "" : value)
          }
          value={balanceStatus || ALL_FILTER_VALUE}
        >
          <SelectTrigger
            className={selectClassName}
            id={`${idPrefix}${ids.balanceStatus}`}
          >
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
            <SelectItem value="with_balance">Con saldo pendiente</SelectItem>
            <SelectItem value="settled">Sin saldo</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor={`${idPrefix}${ids.amountMin}`} label="Monto mínimo">
        <Input
          autoComplete="off"
          className={inputClassName}
          id={`${idPrefix}${ids.amountMin}`}
          inputMode="numeric"
          min={0}
          onChange={(e) => setAmountMin(e.target.value)}
          placeholder="Ej. 5000…"
          step={500}
          type="number"
          value={amountMin}
        />
      </FilterField>

      <FilterField htmlFor={`${idPrefix}${ids.amountMax}`} label="Monto máximo">
        <Input
          autoComplete="off"
          className={inputClassName}
          id={`${idPrefix}${ids.amountMax}`}
          inputMode="numeric"
          min={0}
          onChange={(e) => setAmountMax(e.target.value)}
          placeholder="Ej. 25000…"
          step={500}
          type="number"
          value={amountMax}
        />
      </FilterField>

      {isTodayView ? (
        <div
          className={
            isMobile
              ? "rounded-2xl border border-[var(--color-voltage)]/20 border-dashed bg-[var(--color-voltage)]/5 px-4 py-3 text-sm text-zinc-300"
              : "rounded-2xl border border-[var(--color-voltage)]/20 border-dashed bg-[var(--color-voltage)]/5 px-4 py-3 text-sm text-zinc-300 md:col-span-2"
          }
        >
          <p className="font-medium text-white">Fecha fija en hoy</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Mostrando solo ventas del {todayLabel}.
          </p>
        </div>
      ) : (
        <>
          <FilterField htmlFor={`${idPrefix}${ids.startDate}`} label="Desde">
            <Input
              autoComplete="off"
              className={inputClassName}
              id={`${idPrefix}${ids.startDate}`}
              onChange={(e) => setStartDate(e.target.value)}
              type="date"
              value={startDate}
            />
          </FilterField>
          <FilterField htmlFor={`${idPrefix}${ids.endDate}`} label="Hasta">
            <Input
              autoComplete="off"
              className={inputClassName}
              id={`${idPrefix}${ids.endDate}`}
              onChange={(e) => setEndDate(e.target.value)}
              type="date"
              value={endDate}
            />
          </FilterField>
        </>
      )}
    </div>
  );
}

function SaleDetailPane({
  saleDetailQuery,
  activeShiftId,
  cancelSaleMutation,
  onRequestCancel,
}: {
  saleDetailQuery: ReturnType<typeof useSaleDetail>;
  activeShiftId?: string;
  cancelSaleMutation: ReturnType<typeof useCancelSaleMutation>;
  onRequestCancel: () => void;
}) {
  if (saleDetailQuery.isLoading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-400">
        Cargando detalle…
      </div>
    );
  }
  if (saleDetailQuery.data) {
    return (
      <SaleDetailContent
        activeShiftId={activeShiftId}
        isCancelling={cancelSaleMutation.isPending}
        onRequestCancel={onRequestCancel}
        sale={saleDetailQuery.data}
      />
    );
  }
  return (
    <div className="py-12 text-center text-sm text-zinc-400">
      No se encontró el detalle.
    </div>
  );
}

export function SalesPage() {
  const salesSearchId = useId();
  const salesStatusId = useId();
  const salesPaymentMethodId = useId();
  const salesCashierId = useId();
  const salesTerminalId = useId();
  const salesBalanceStatusId = useId();
  const salesAmountMinId = useId();
  const salesAmountMaxId = useId();
  const salesStartDateId = useId();
  const salesEndDateId = useId();

  const [activeView, setActiveView] = useState<SalesView>(DEFAULT_SALES_VIEW);
  const isTodayView = activeView === "today";
  const todayDate = getCurrentDateFilterValue();

  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [balanceStatus, setBalanceStatus] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cursor, setCursor] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PARAMS.limit);

  const [isViewPending, startViewTransition] = useTransition();
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const listParams = useSalesListParams({
    activeView,
    amountMax,
    amountMin,
    balanceStatus,
    cashierId,
    cursor,
    deferredSearchQuery,
    endDate,
    pageSize,
    paymentMethod,
    startDate,
    status,
    terminalName,
    todayDate,
  });

  const salesQuery = useSalesList(listParams);
  const sales = salesQuery.data?.data ?? [];
  const salesFilterOptions = salesQuery.data?.filterOptions ?? {
    cashiers: [],
    terminals: [],
    paymentMethods: [],
  };
  const totalResults = salesQuery.data?.total ?? sales.length;
  const nextCursor = salesQuery.data?.nextCursor ?? null;

  const saleDetailQuery = useSaleDetail(isDetailOpen ? selectedSaleId : null);
  const activeShiftQuery = useActiveShift();
  const activeShiftId = activeShiftQuery.data?.shift?.id;
  const cancelSaleMutation = useCancelSaleMutation();

  useEffect(() => {
    if (sales.length === 0) {
      setSelectedSaleId(null);
      setIsDetailOpen(false);
      return;
    }
    if (!(selectedSaleId && sales.some((s) => s.id === selectedSaleId))) {
      setSelectedSaleId(sales[0]?.id ?? null);
    }
  }, [sales, selectedSaleId]);

  const selectedSaleSummary = useMemo(
    () => sales.find((s) => s.id === selectedSaleId) ?? null,
    [sales, selectedSaleId]
  );

  const totalRevenue = sales.reduce(
    (total, s) => (s.status === "cancelled" ? total : total + s.totalAmount),
    0
  );
  const totalPending = sales.reduce(
    (total, s) => (s.status === "cancelled" ? total : total + s.balanceDue),
    0
  );

  const rangeStart = totalResults === 0 ? 0 : cursor + 1;
  const rangeEnd = totalResults === 0 ? 0 : cursor + sales.length;

  const activeFilterCount = [
    searchQuery,
    status,
    paymentMethod,
    cashierId,
    terminalName,
    balanceStatus,
    amountMin,
    amountMax,
    ...(isTodayView ? [] : [startDate, endDate]),
  ].filter(Boolean).length;

  const activeAdvancedFilterCount = [
    paymentMethod,
    cashierId,
    terminalName,
    balanceStatus,
    amountMin,
    amountMax,
    ...(isTodayView ? [] : [startDate, endDate]),
  ].filter(Boolean).length;

  const isSalesViewRefreshing = isViewPending || salesQuery.isFetching;

  const todayLabel = dayFormatter.format(new Date(`${todayDate}T00:00:00`));
  const viewSummary = useSalesViewSummary(
    isTodayView,
    todayLabel,
    activeFilterCount
  );

  const clearFilters = () => {
    setIsMobileFilterOpen(false);
    setSearchQuery("");
    setStatus("");
    setPaymentMethod("");
    setCashierId("");
    setTerminalName("");
    setBalanceStatus("");
    setAmountMin("");
    setAmountMax("");
    setStartDate("");
    setEndDate("");
    setCursor(0);
  };

  const handleViewChange = (value: string) => {
    const nextView = SALES_VIEW_VALUES.includes(value as SalesView)
      ? (value as SalesView)
      : DEFAULT_SALES_VIEW;
    if (nextView === activeView) {
      return;
    }
    startViewTransition(() => {
      setActiveView(nextView);
      setCursor(0);
    });
  };

  const paymentMethodLabels = useMemo(
    () =>
      Object.fromEntries(
        salesFilterOptions.paymentMethods.map((pm) => [pm.id, pm.label])
      ),
    [salesFilterOptions.paymentMethods]
  );

  return (
    <>
      <div className="flex-1 space-y-6 bg-[var(--color-void)] p-6 font-sans text-[var(--color-photon)] md:p-8 lg:p-12">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="font-semibold text-3xl text-white tracking-tight">
              Ventas
            </h1>
            <span className="text-sm text-zinc-400">
              {sales.length} registros • {formatCurrency(totalRevenue)}{" "}
              facturado
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

        <Tabs
          className="w-full"
          onValueChange={handleViewChange}
          value={activeView}
        >
          <TabsList className="!h-auto mb-6 inline-flex rounded-full border border-zinc-800 bg-black/20 p-1">
            <TabsTrigger
              className="!rounded-full data-[state=active]:!bg-zinc-800/80 data-[state=active]:!text-white data-[state=active]:!shadow-sm data-[state=active]:!border-transparent !border-transparent !h-auto inline-flex min-h-[40px] items-center justify-center bg-transparent px-6 py-1.5 font-medium text-sm text-zinc-400 outline-none transition-all duration-200 ease-in-out hover:text-zinc-200"
              value="today"
            >
              Ventas de hoy
            </TabsTrigger>
            <TabsTrigger
              className="!rounded-full data-[state=active]:!bg-zinc-800/80 data-[state=active]:!text-white data-[state=active]:!shadow-sm data-[state=active]:!border-transparent !border-transparent !h-auto inline-flex min-h-[40px] items-center justify-center bg-transparent px-6 py-1.5 font-medium text-sm text-zinc-400 outline-none transition-all duration-200 ease-in-out hover:text-zinc-200"
              value="history"
            >
              Historial de ventas
            </TabsTrigger>
          </TabsList>

          <div className="mb-6 grid gap-3 lg:grid-cols-3">
            <CompactMetricCard
              icon={Receipt}
              title={viewSummary.resultsTitle}
              value={`${sales.length}`}
            />
            <CompactMetricCard
              icon={Wallet}
              title={viewSummary.revenueTitle}
              value={formatCurrency(totalRevenue)}
            />
            <CompactMetricCard
              icon={Clock3}
              title={viewSummary.pendingTitle}
              value={formatCurrency(totalPending)}
            />
          </div>

          <IndeterminateProgressBar active={isSalesViewRefreshing} />

          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[var(--color-carbon)]">
            <div
              aria-busy={isSalesViewRefreshing}
              className={`transition-opacity ${isSalesViewRefreshing ? "opacity-80" : "opacity-100"}`}
            >
              <div className="flex flex-col gap-4 border-zinc-800 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="relative w-full sm:max-w-xs md:max-w-sm">
                    <Search
                      aria-hidden="true"
                      className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
                    />
                    <Input
                      autoComplete="off"
                      className="h-10 rounded-lg border-zinc-800 bg-black/20 pl-9 focus-visible:border-[var(--color-voltage)] focus-visible:ring-[var(--color-voltage)]/20"
                      id={salesSearchId}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cliente, cajero o id…"
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
                        id={salesStatusId}
                      >
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                        <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
                        <SelectItem value="completed">Pagada</SelectItem>
                        <SelectItem value="credit">Crédito</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
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
                        <AdvancedFilters
                          amountMax={amountMax}
                          amountMin={amountMin}
                          balanceStatus={balanceStatus}
                          cashierId={cashierId}
                          endDate={endDate}
                          ids={{
                            amountMax: salesAmountMaxId,
                            amountMin: salesAmountMinId,
                            balanceStatus: salesBalanceStatusId,
                            cashier: salesCashierId,
                            endDate: salesEndDateId,
                            paymentMethod: salesPaymentMethodId,
                            startDate: salesStartDateId,
                            terminal: salesTerminalId,
                          }}
                          isTodayView={isTodayView}
                          mode="mobile"
                          options={salesFilterOptions}
                          paymentMethod={paymentMethod}
                          setAmountMax={setAmountMax}
                          setAmountMin={setAmountMin}
                          setBalanceStatus={setBalanceStatus}
                          setCashierId={setCashierId}
                          setEndDate={setEndDate}
                          setPaymentMethod={setPaymentMethod}
                          setStartDate={setStartDate}
                          setTerminalName={setTerminalName}
                          startDate={startDate}
                          terminalName={terminalName}
                          todayLabel={todayLabel}
                        />
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
                        <AdvancedFilters
                          amountMax={amountMax}
                          amountMin={amountMin}
                          balanceStatus={balanceStatus}
                          cashierId={cashierId}
                          endDate={endDate}
                          ids={{
                            amountMax: salesAmountMaxId,
                            amountMin: salesAmountMinId,
                            balanceStatus: salesBalanceStatusId,
                            cashier: salesCashierId,
                            endDate: salesEndDateId,
                            paymentMethod: salesPaymentMethodId,
                            startDate: salesStartDateId,
                            terminal: salesTerminalId,
                          }}
                          isTodayView={isTodayView}
                          mode="desktop"
                          options={salesFilterOptions}
                          paymentMethod={paymentMethod}
                          setAmountMax={setAmountMax}
                          setAmountMin={setAmountMin}
                          setBalanceStatus={setBalanceStatus}
                          setCashierId={setCashierId}
                          setEndDate={setEndDate}
                          setPaymentMethod={setPaymentMethod}
                          setStartDate={setStartDate}
                          setTerminalName={setTerminalName}
                          startDate={startDate}
                          terminalName={terminalName}
                          todayLabel={todayLabel}
                        />
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
              <div className="p-4 pt-4">
                {sales.length > 0 ? (
                  <div className="space-y-2">
                    <div className="hidden grid-cols-[minmax(0,1.45fr)_minmax(0,1.15fr)_84px_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)_44px] gap-4 px-3 font-medium text-[11px] text-zinc-500 uppercase tracking-[0.16em] md:grid">
                      <span>Cliente</span>
                      <span>Fecha/Hora</span>
                      <span>Items</span>
                      <span>Método</span>
                      <span className="text-right">Monto total</span>
                      <span className="text-right">Estado</span>
                      <span />
                    </div>

                    <div className="space-y-2 [content-visibility:auto]">
                      {sales.map((sale) => {
                        const paymentSummary = formatPaymentSummary(
                          sale,
                          paymentMethodLabels
                        );

                        return (
                          <button
                            className={`group w-full touch-manipulation rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)]/30 ${
                              selectedSaleSummary?.id === sale.id
                                ? "border-[var(--color-voltage)]/30 bg-[var(--color-voltage)]/10"
                                : "border-zinc-800 bg-black/10 hover:border-zinc-700 hover:bg-white/5"
                            }`}
                            key={sale.id}
                            onClick={() => {
                              setSelectedSaleId(sale.id);
                              setIsDetailOpen(true);
                            }}
                            type="button"
                          >
                            <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1.45fr)_minmax(0,1.15fr)_84px_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)_44px] md:items-center md:gap-4">
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                  <UserRound
                                    aria-hidden="true"
                                    className="size-3.5 shrink-0 text-zinc-500"
                                  />
                                  <p className="truncate font-medium text-white">
                                    {sale.customerName ?? "Cliente mostrador"}
                                  </p>
                                </div>
                                <p className="mt-1 truncate pl-5 text-xs text-zinc-500">
                                  {sale.cashierName ?? "Sin cajero"}
                                </p>
                              </div>

                              <div className="min-w-0 text-sm text-zinc-300 tabular-nums">
                                <p>
                                  {dateTimeFormatter.format(sale.createdAt)}
                                </p>
                              </div>

                              <div className="text-sm text-zinc-300">
                                {formatItemCountLabel(sale.itemCount)}
                              </div>

                              <div className="min-w-0 text-sm text-zinc-300">
                                <p className="truncate" title={paymentSummary}>
                                  {paymentSummary}
                                </p>
                              </div>

                              <div className="tabular-nums md:text-right">
                                <p className="font-semibold text-[var(--color-voltage)] text-base">
                                  {formatCurrency(sale.totalAmount)}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                <Badge
                                  className={`${getSaleStatusBadgeClass(
                                    sale.status
                                  )} border-0 px-2 py-0.5 text-xs`}
                                >
                                  {formatSaleStatus(sale.status)}
                                </Badge>
                                <p className="text-sm text-zinc-400 md:text-right">
                                  {sale.balanceDue > 0
                                    ? `Pendiente ${formatCurrency(
                                        sale.balanceDue
                                      )}`
                                    : "Sin saldo pendiente"}
                                </p>
                              </div>

                              <div className="hidden justify-end md:flex">
                                <div className="rounded-full border border-zinc-800 p-2 text-zinc-400 transition-colors group-hover:border-zinc-700 group-hover:text-white">
                                  <ArrowRight
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="-mx-4 mt-4 -mb-4 flex flex-col items-center justify-between gap-4 border-zinc-800 border-t bg-black/10 p-4 text-sm text-zinc-400 sm:flex-row">
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
                          disabled={cursor === 0}
                          onClick={() =>
                            setCursor(Math.max(cursor - pageSize, 0))
                          }
                          size="sm"
                          variant="outline"
                        >
                          Anterior
                        </Button>
                        <Button
                          className="h-8 rounded-md border-none bg-[var(--color-voltage)] px-4 font-medium text-black hover:bg-[#c9e605]"
                          disabled={nextCursor === null}
                          onClick={() => {
                            if (nextCursor !== null) {
                              setCursor(nextCursor);
                            }
                          }}
                          size="sm"
                          variant="default"
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-800 border-dashed px-4 py-16 text-center">
                    <p className="text-zinc-400">{viewSummary.emptyTitle}</p>
                    <Button
                      asChild
                      className="mt-4 border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                      variant="outline"
                    >
                      <Link href="/pos">Registrar una venta</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Tabs>
      </div>

      <Sheet onOpenChange={setIsDetailOpen} open={isDetailOpen}>
        <SheetContent
          className="!w-full !max-w-full sm:!w-[1000px] overflow-hidden border-zinc-800 bg-[var(--color-carbon)] p-0 text-[var(--color-photon)]"
          side="right"
        >
          <SheetHeader className="shrink-0 border-zinc-800 border-b px-6 py-5">
            <SheetTitle className="font-bold text-2xl text-[var(--color-photon)]">
              Detalle de venta
            </SheetTitle>
            <SheetDescription className="text-base text-zinc-400">
              Revisa cliente, pagos e items registrados para esta venta.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <SaleDetailPane
              activeShiftId={activeShiftId}
              cancelSaleMutation={cancelSaleMutation}
              onRequestCancel={() => setIsCancelDialogOpen(true)}
              saleDetailQuery={saleDetailQuery}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        onOpenChange={setIsCancelDialogOpen}
        open={isCancelDialogOpen}
      >
        <AlertDialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Anular venta</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Esta venta quedará anulada. Sus pagos dejarán de contar para caja
              y sus valores no sumarán en ventas. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
              disabled={cancelSaleMutation.isPending}
            >
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              className="border-none bg-rose-500 text-white hover:bg-rose-600"
              disabled={cancelSaleMutation.isPending}
              onClick={async () => {
                if (!selectedSaleId) {
                  return;
                }
                await cancelSaleMutation.mutateAsync({
                  saleId: selectedSaleId,
                });
                setIsCancelDialogOpen(false);
                setIsDetailOpen(false);
              }}
            >
              {cancelSaleMutation.isPending
                ? "Anulando…"
                : "Confirmar anulación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SaleDetailContent({
  sale,
  onRequestCancel,
  isCancelling,
  activeShiftId,
}: {
  sale: NonNullable<ReturnType<typeof useSaleDetail>["data"]>;
  onRequestCancel: () => void;
  isCancelling: boolean;
  activeShiftId?: string;
}) {
  const canCancelSale =
    sale.status !== "cancelled" &&
    Boolean(activeShiftId) &&
    sale.shift?.id === activeShiftId &&
    !isCancelling;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-400">ID</p>
          <p className="font-mono text-sm text-white">{sale.id}</p>
        </div>
        <Badge
          className={`${getSaleStatusBadgeClass(sale.status)} border-0 px-2 py-0.5 text-xs`}
        >
          {formatSaleStatus(sale.status)}
          {sale.status === "credit" && sale.balanceDue > 0
            ? ` • Pendiente ${formatCurrency(sale.balanceDue)}`
            : null}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-zinc-400">Fecha</p>
          <p className="text-sm text-white">
            {dateTimeFormatter.format(sale.createdAt)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Cajero</p>
          <p className="text-sm text-white">
            {sale.cashier?.name ?? "Sin cajero"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Terminal</p>
          <p className="text-sm text-white">
            {sale.shift?.terminalName ?? "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Cliente</p>
          <p className="text-sm text-white">
            {sale.customer?.name ?? "Cliente mostrador"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-zinc-200">Items</h4>
        <div className="space-y-2">
          {sale.items.map((item) => (
            <div
              className="rounded-lg border border-zinc-800 bg-black/10 p-3"
              key={item.id}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{item.name}</p>
                <p className="text-sm text-zinc-300">
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </p>
              </div>
              {item.modifiers.length > 0 && (
                <div className="mt-2 space-y-1">
                  {item.modifiers.map((mod) => (
                    <div
                      className="flex items-center justify-between text-xs text-zinc-400"
                      key={mod.id}
                    >
                      <span>+ {mod.name}</span>
                      <span>
                        {mod.quantity} x {formatCurrency(mod.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-400">
                  Subtotal {formatCurrency(item.subtotal)}
                  {item.taxAmount > 0
                    ? ` • Imp ${formatCurrency(item.taxAmount)}`
                    : null}
                  {item.discountAmount > 0
                    ? ` • Desc ${formatCurrency(item.discountAmount)}`
                    : null}
                </span>
                <span className="font-medium text-[var(--color-voltage)]">
                  {formatCurrency(item.totalAmount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-zinc-200">Pagos</h4>
        {sale.payments.length === 0 ? (
          <p className="text-sm text-zinc-400">Sin pagos registrados</p>
        ) : (
          <div className="space-y-2">
            {sale.payments.map((payment) => (
              <div
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/10 p-3"
                key={payment.id}
              >
                <div>
                  <p className="text-sm text-white capitalize">
                    {payment.method}
                  </p>
                  {payment.reference ? (
                    <p className="text-xs text-zinc-400">
                      Ref: {payment.reference}
                    </p>
                  ) : null}
                </div>
                <p className="font-medium text-[var(--color-voltage)]">
                  {formatCurrency(payment.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-black/10 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Subtotal</span>
          <span className="text-white">{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.taxAmount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Impuestos</span>
            <span className="text-white">{formatCurrency(sale.taxAmount)}</span>
          </div>
        )}
        {sale.discountAmount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Descuentos</span>
            <span className="text-white">
              -{formatCurrency(sale.discountAmount)}
            </span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-zinc-800 border-t pt-2">
          <span className="font-medium text-white">Total</span>
          <span className="font-bold text-[var(--color-voltage)] text-lg">
            {formatCurrency(sale.totalAmount)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-zinc-400">Pagado</span>
          <span className="text-white">{formatCurrency(sale.paidAmount)}</span>
        </div>
        {sale.balanceDue > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Saldo pendiente</span>
            <span className="text-sky-300">
              {formatCurrency(sale.balanceDue)}
            </span>
          </div>
        )}
      </div>

      {canCancelSale && (
        <Button
          className="w-full border-rose-500/30 bg-transparent text-rose-200 hover:bg-rose-500/10"
          disabled={isCancelling}
          onClick={onRequestCancel}
          variant="outline"
        >
          {isCancelling ? "Anulando…" : "Anular venta"}
        </Button>
      )}
    </div>
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

function IndeterminateProgressBar({ active }: { active: boolean }) {
  return (
    <>
      <style>{`
				@keyframes sales-progress-primary {
					0% { transform: translateX(-140%) scaleX(0.55); }
					100% { transform: translateX(340%) scaleX(1); }
				}
				@keyframes sales-progress-secondary {
					0% { transform: translateX(-180%) scaleX(0.35); }
					100% { transform: translateX(250%) scaleX(0.8); }
				}
			`}</style>
      <div
        aria-hidden="true"
        className={`mt-2 h-1 overflow-hidden rounded-full bg-white/5 transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
      >
        <div className="relative size-full">
          <div
            className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--color-voltage)]/85"
            style={
              active
                ? {
                    animation:
                      "sales-progress-primary 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                  }
                : undefined
            }
          />
          <div
            className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-[var(--color-voltage)]/35"
            style={
              active
                ? {
                    animation:
                      "sales-progress-secondary 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                  }
                : undefined
            }
          />
        </div>
      </div>
    </>
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
      <label
        className="font-medium text-xs text-zinc-500 uppercase tracking-[0.16em]"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
