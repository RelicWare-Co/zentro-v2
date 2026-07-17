import {
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  Table,
  Tabs,
  TextInput,
} from "@mantine/core";
import {
  ArrowDownToLine,
  BadgeDollarSign,
  BanknoteArrowDown,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { CompactStatCard } from "@/features/dashboard/components/dashboard-ui-primitives";
import {
  downloadBusinessReport,
  useBusinessReport,
} from "@/features/reports/hooks/use-business-report";
import type { ReportFilters } from "@/features/reports/reports.schema";
import { formatCurrency } from "@/lib/format-currency.shared";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const COUNT_FORMATTER = new Intl.NumberFormat("es-CO");

const STATUS_OPTIONS = [
  { value: "active", label: "Ventas válidas" },
  { value: "completed", label: "Pagadas" },
  { value: "credit", label: "Crédito pendiente" },
  { value: "cancelled", label: "Canceladas" },
];

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildInitialFilters(): ReportFilters {
  const today = new Date();
  return {
    startDate: formatDateKey(
      new Date(today.getFullYear(), today.getMonth(), 1)
    ),
    endDate: formatDateKey(today),
    status: "active",
  };
}

function buildPresetRange(preset: "today" | "week" | "month" | "30days") {
  const today = new Date();
  if (preset === "today") {
    const dateKey = formatDateKey(today);
    return { startDate: dateKey, endDate: dateKey };
  }
  if (preset === "month") {
    return {
      startDate: formatDateKey(
        new Date(today.getFullYear(), today.getMonth(), 1)
      ),
      endDate: formatDateKey(today),
    };
  }
  const daysBack = preset === "week" ? 6 : 29;
  const start = new Date(today);
  start.setDate(start.getDate() - daysBack);
  return { startDate: formatDateKey(start), endDate: formatDateKey(today) };
}

function ReportPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Paper
      className="overflow-hidden border-zinc-800 bg-[var(--color-carbon)]"
      p={0}
      radius="lg"
      withBorder
    >
      <div className="border-zinc-800 border-b px-5 py-4">
        <h2 className="font-semibold text-base text-white">{title}</h2>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
      {children}
    </Paper>
  );
}

function EmptyRows({ colSpan }: { colSpan: number }) {
  return (
    <Table.Tr>
      <Table.Td className="py-10 text-center text-zinc-500" colSpan={colSpan}>
        No hay datos para los filtros seleccionados.
      </Table.Td>
    </Table.Tr>
  );
}

function ReportFiltersPanel({
  filters,
  cashiers,
  onChange,
}: {
  filters: ReportFilters;
  cashiers: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<ReportFilters>) => void;
}) {
  const setPreset = (preset: "today" | "week" | "month" | "30days") => {
    onChange(buildPresetRange(preset));
  };
  return (
    <Paper
      className="border-zinc-800 bg-[var(--color-carbon)]"
      p="md"
      radius="lg"
      withBorder
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={() => setPreset("today")} size="xs" variant="light">
          Hoy
        </Button>
        <Button onClick={() => setPreset("week")} size="xs" variant="light">
          Últimos 7 días
        </Button>
        <Button onClick={() => setPreset("30days")} size="xs" variant="light">
          Últimos 30 días
        </Button>
        <Button onClick={() => setPreset("month")} size="xs" variant="light">
          Este mes
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextInput
          label="Desde"
          max={filters.endDate}
          onChange={(event) => onChange({ startDate: event.target.value })}
          type="date"
          value={filters.startDate}
        />
        <TextInput
          label="Hasta"
          min={filters.startDate}
          onChange={(event) => onChange({ endDate: event.target.value })}
          type="date"
          value={filters.endDate}
        />
        <Select
          clearable
          data={cashiers.map((cashier) => ({
            value: cashier.id,
            label: cashier.name,
          }))}
          label="Cajero"
          onChange={(value) => onChange({ cashierId: value ?? undefined })}
          placeholder="Todos los cajeros"
          searchable
          value={filters.cashierId ?? null}
        />
        <Select
          data={STATUS_OPTIONS}
          label="Estado de venta"
          onChange={(value) => {
            if (value) {
              onChange({ status: value as ReportFilters["status"] });
            }
          }}
          value={filters.status}
        />
      </div>
    </Paper>
  );
}

function SalesTrend({
  trend,
}: {
  trend: Array<{
    dateKey: string;
    salesCount: number;
    grossSales: number;
    netRevenue: number;
  }>;
}) {
  const maxValue = Math.max(1, ...trend.map((point) => point.grossSales));
  return (
    <ReportPanel
      description="Facturación contable diaria, sin productos de paso"
      title="Comportamiento de ventas"
    >
      <div className="space-y-3 p-5">
        {trend.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No hay ventas en este periodo.
          </p>
        ) : (
          trend.map((point) => (
            <div
              className="grid grid-cols-[76px_1fr_auto] items-center gap-3"
              key={point.dateKey}
            >
              <span className="text-xs text-zinc-400">
                {point.dateKey.slice(5)}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-[var(--color-voltage)]"
                  style={{
                    width: `${Math.max(2, (point.grossSales / maxValue) * 100)}%`,
                  }}
                />
              </div>
              <span className="min-w-24 text-right font-medium text-sm text-white tabular-nums">
                {formatCurrency(point.grossSales)}
              </span>
            </div>
          ))
        )}
      </div>
    </ReportPanel>
  );
}

function ProductsTable({
  products,
}: {
  products: NonNullable<
    ReturnType<typeof useBusinessReport>["data"]
  >["products"];
}) {
  return (
    <ReportPanel
      description="Sin productos de paso; valores según el catálogo actual"
      title="Productos y categorías"
    >
      <Table.ScrollContainer minWidth={760}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Producto</Table.Th>
              <Table.Th>Categoría</Table.Th>
              <Table.Th ta="right">Cantidad</Table.Th>
              <Table.Th ta="right">Facturado</Table.Th>
              <Table.Th ta="right">Ingreso neto</Table.Th>
              <Table.Th ta="right">Descuento</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {products.length === 0 ? (
              <EmptyRows colSpan={6} />
            ) : (
              products.map((row) => (
                <Table.Tr key={row.productId}>
                  <Table.Td className="font-medium text-white">
                    {row.name}
                  </Table.Td>
                  <Table.Td>{row.categoryName ?? "Sin categoría"}</Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {COUNT_FORMATTER.format(row.quantitySold)}
                  </Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {formatCurrency(row.billedTotal)}
                  </Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {formatCurrency(row.netRevenue)}
                  </Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {formatCurrency(row.discountAmount)}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </ReportPanel>
  );
}

function PaymentsTable({
  payments,
}: {
  payments: NonNullable<
    ReturnType<typeof useBusinessReport>["data"]
  >["payments"];
}) {
  return (
    <ReportPanel
      description="Distingue dinero entregado, cambio y valor aplicado"
      title="Medios de pago"
    >
      <Table.ScrollContainer minWidth={680}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Medio</Table.Th>
              <Table.Th ta="right">Operaciones</Table.Th>
              <Table.Th ta="right">Entregado</Table.Th>
              <Table.Th ta="right">Cambio</Table.Th>
              <Table.Th ta="right">Aplicado</Table.Th>
              <Table.Th ta="right">Recaudo neto</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {payments.length === 0 ? (
              <EmptyRows colSpan={6} />
            ) : (
              payments.map((row) => (
                <Table.Tr key={row.method}>
                  <Table.Td className="font-medium text-white">
                    {row.label}
                  </Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {COUNT_FORMATTER.format(row.paymentCount)}
                  </Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {formatCurrency(row.tenderedAmount)}
                  </Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {formatCurrency(row.changeAmount)}
                  </Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {formatCurrency(row.appliedAmount)}
                  </Table.Td>
                  <Table.Td
                    className="font-medium text-white tabular-nums"
                    ta="right"
                  >
                    {formatCurrency(row.netCollected)}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </ReportPanel>
  );
}

function SalesTable({
  sales,
}: {
  sales: NonNullable<ReturnType<typeof useBusinessReport>["data"]>["sales"];
}) {
  return (
    <ReportPanel
      description="Últimas 100 ventas; acota el rango si Excel supera 50.000"
      title="Detalle de ventas"
    >
      <Table.ScrollContainer minWidth={900}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th>
              <Table.Th>Venta</Table.Th>
              <Table.Th>Cajero</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th ta="right">Total cobrado</Table.Th>
              <Table.Th ta="right">Ingreso neto</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sales.length === 0 ? (
              <EmptyRows colSpan={7} />
            ) : (
              sales.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td className="whitespace-nowrap">
                    {DATE_FORMATTER.format(row.createdAt)}
                  </Table.Td>
                  <Table.Td className="font-mono text-xs">{row.id}</Table.Td>
                  <Table.Td>{row.cashierName}</Table.Td>
                  <Table.Td>{row.customerName ?? "Mostrador"}</Table.Td>
                  <Table.Td>{row.status}</Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {formatCurrency(row.totalAmount)}
                  </Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {formatCurrency(row.netRevenue)}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </ReportPanel>
  );
}

function MovementsTable({
  movements,
}: {
  movements: NonNullable<
    ReturnType<typeof useBusinessReport>["data"]
  >["movements"];
}) {
  const movementLabels: Record<string, string> = {
    expense: "Gasto operativo",
    payout: "Pago a proveedor",
    inflow: "Ingreso manual",
  };
  return (
    <ReportPanel
      description="Gastos, pagos a proveedores e ingresos manuales del periodo"
      title="Movimientos de caja"
    >
      <Table.ScrollContainer minWidth={820}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Descripción</Table.Th>
              <Table.Th>Cajero</Table.Th>
              <Table.Th>Medio</Table.Th>
              <Table.Th ta="right">Monto</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {movements.length === 0 ? (
              <EmptyRows colSpan={6} />
            ) : (
              movements.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td className="whitespace-nowrap">
                    {DATE_FORMATTER.format(row.createdAt)}
                  </Table.Td>
                  <Table.Td>{movementLabels[row.type] ?? row.type}</Table.Td>
                  <Table.Td className="max-w-80 whitespace-normal">
                    {row.description}
                  </Table.Td>
                  <Table.Td>{row.cashierName}</Table.Td>
                  <Table.Td>{row.paymentMethodLabel}</Table.Td>
                  <Table.Td className="tabular-nums" ta="right">
                    {formatCurrency(row.amount)}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </ReportPanel>
  );
}

export function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>(buildInitialFilters);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const report = useBusinessReport(filters);
  const updateFilters = (patch: Partial<ReportFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };
  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await downloadBusinessReport(filters);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "No se pudo exportar el reporte"
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="flex-1 space-y-6 overflow-y-auto bg-[var(--color-page-bg)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[var(--color-voltage)]">
            <ChartNoAxesCombined className="size-5" />
            <span className="font-semibold text-xs uppercase tracking-[0.2em]">
              Inteligencia del negocio
            </span>
          </div>
          <h1 className="font-bold text-3xl text-white tracking-tight">
            Reportes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Ventas, recaudo, productos y caja bajo una misma definición
            contable.
          </p>
        </div>
        <Button
          leftSection={<ArrowDownToLine className="size-4" />}
          loading={isExporting}
          onClick={() => {
            handleExport().catch(() => undefined);
          }}
        >
          Exportar Excel
        </Button>
      </header>

      <ReportFiltersPanel
        cashiers={report.data?.options.cashiers ?? []}
        filters={filters}
        onChange={updateFilters}
      />

      {exportError ? (
        <Alert
          color="red"
          icon={<TriangleAlert className="size-4" />}
          title="No se pudo exportar"
        >
          {exportError}
        </Alert>
      ) : null}
      {report.isError ? (
        <Alert
          color="red"
          icon={<TriangleAlert className="size-4" />}
          title="No se pudo cargar el reporte"
        >
          <Group justify="space-between">
            <span>{report.error.message}</span>
            <Button
              leftSection={<RefreshCw className="size-4" />}
              onClick={() => {
                report.refetch().catch(() => undefined);
              }}
              size="xs"
              variant="light"
            >
              Reintentar
            </Button>
          </Group>
        </Alert>
      ) : null}
      {report.isPending || !report.data ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader />
        </div>
      ) : (
        <div
          className={
            report.isFetching
              ? "space-y-6 opacity-70 transition-opacity"
              : "space-y-6 transition-opacity"
          }
        >
          <Alert color="blue" icon={<CalendarDays className="size-4" />}>
            Periodo {report.data.period.startDate} a{" "}
            {report.data.period.endDate}, zona {report.data.timeZone}. Los
            gastos y movimientos siguen fecha y cajero, no el estado de venta.
          </Alert>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <CompactStatCard
              icon={ShoppingCart}
              title="Ventas"
              value={COUNT_FORMATTER.format(report.data.summary.salesCount)}
            />
            <CompactStatCard
              icon={ReceiptText}
              title="Facturación"
              value={formatCurrency(report.data.summary.grossSales)}
            />
            <CompactStatCard
              icon={BadgeDollarSign}
              title="Ingreso neto"
              value={formatCurrency(report.data.summary.netRevenue)}
            />
            <CompactStatCard
              icon={WalletCards}
              title="Recaudo neto"
              value={formatCurrency(report.data.summary.collectedTotal)}
            />
            <CompactStatCard
              icon={CircleDollarSign}
              title="Ticket promedio"
              value={formatCurrency(report.data.summary.averageTicket)}
            />
            <CompactStatCard
              icon={BanknoteArrowDown}
              title="Gastos + pagos"
              value={formatCurrency(
                report.data.summary.expensesTotal +
                  report.data.summary.payoutsTotal
              )}
            />
          </section>
          <SalesTrend trend={report.data.trend} />
          <Tabs defaultValue="products" keepMounted={false}>
            <Tabs.List grow>
              <Tabs.Tab
                leftSection={<PackageSearch className="size-4" />}
                value="products"
              >
                Productos
              </Tabs.Tab>
              <Tabs.Tab
                leftSection={<WalletCards className="size-4" />}
                value="payments"
              >
                Pagos
              </Tabs.Tab>
              <Tabs.Tab
                leftSection={<ReceiptText className="size-4" />}
                value="sales"
              >
                Ventas
              </Tabs.Tab>
              <Tabs.Tab
                leftSection={<BanknoteArrowDown className="size-4" />}
                value="movements"
              >
                Caja
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel pt="md" value="products">
              <ProductsTable products={report.data.products} />
            </Tabs.Panel>
            <Tabs.Panel pt="md" value="payments">
              <PaymentsTable payments={report.data.payments} />
            </Tabs.Panel>
            <Tabs.Panel pt="md" value="sales">
              <SalesTable sales={report.data.sales} />
            </Tabs.Panel>
            <Tabs.Panel pt="md" value="movements">
              <MovementsTable movements={report.data.movements} />
            </Tabs.Panel>
          </Tabs>
        </div>
      )}
    </main>
  );
}
