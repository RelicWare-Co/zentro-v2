import { ActionIcon, Badge, Button, Select, TextInput } from "@mantine/core";
import {
  Building2,
  ChartColumn,
  ExternalLink,
  Receipt,
  Store,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDateTime } from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import {
  getAdminUrlParams,
  replaceAdminUrlParams,
} from "@/features/admin/admin-url-state";
import {
  AdminTabError,
  AdminTabLoading,
} from "@/features/admin/components/admin-page-states";
import { useAdminOptionsQuery } from "@/features/admin/hooks/use-admin-options";
import {
  type AdminPlatformOverview,
  useAdminOverviewQuery,
} from "@/features/admin/hooks/use-admin-platform";
import {
  CompactStatCard,
  DashboardPanelShell,
  EmptyState,
} from "@/features/dashboard/components/dashboard-ui-primitives";
import {
  formatCompactCurrency,
  formatCount,
} from "@/features/dashboard/dashboard-formatters.shared";
import { formatCurrency } from "@/lib/format-currency.shared";

const trendDayFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});
const trendMonthFormatter = new Intl.DateTimeFormat("es-CO", {
  month: "short",
  year: "2-digit",
});

function formatTrendBucket(
  dateKey: string,
  granularity: "day" | "week" | "month"
) {
  const date = new Date(
    granularity === "month" ? `${dateKey}-01T12:00:00` : `${dateKey}T12:00:00`
  );
  return granularity === "month"
    ? trendMonthFormatter.format(date)
    : trendDayFormatter.format(date);
}

function granularityLabel(granularity: "day" | "week" | "month") {
  if (granularity === "week") {
    return "Semanal";
  }
  return granularity === "month" ? "Mensual" : "Diaria";
}

function AdminPlatformStatCards({
  overview,
}: {
  overview: AdminPlatformOverview;
}) {
  const { today, totals } = overview;
  const period = overview.periodSummary ?? {
    activeOrganizations: today.activeOrganizations,
    paidAmount: today.revenue,
    pendingAmount: 0,
    saleAmount: today.revenue,
    salesCount: today.salesCount,
  };
  const averagePaid =
    period.salesCount > 0 ? period.paidAmount / period.salesCount : 0;

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <CompactStatCard
        description={`${formatCount(period.salesCount)} ventas · ticket prom. ${formatCurrency(averagePaid)}`}
        icon={Wallet}
        title="Cobrado del periodo"
        value={formatCurrency(period.paidAmount)}
      />
      <CompactStatCard
        description="Organizaciones con ventas en el periodo"
        icon={Store}
        title="Clientes activos"
        value={`${formatCount(period.activeOrganizations)} de ${formatCount(totals.organizations)}`}
      />
      <CompactStatCard
        description="Importe de ventas no canceladas"
        icon={ChartColumn}
        title="Ventas del periodo"
        value={formatCurrency(period.saleAmount)}
      />
      <CompactStatCard
        description="Pendiente de cobro en ventas no canceladas"
        icon={Receipt}
        title="Pendiente"
        value={formatCurrency(period.pendingAmount)}
      />
      <CompactStatCard
        description={`+${formatCount(totals.newOrganizationsThisMonth)} este mes`}
        icon={Building2}
        title="Organizaciones"
        value={formatCount(totals.organizations)}
      />
      <CompactStatCard
        description={`+${formatCount(totals.newUsersThisMonth)} este mes`}
        icon={Users}
        title="Usuarios"
        value={formatCount(totals.users)}
      />
    </section>
  );
}

function AdminPlatformTrendPanel({
  overview,
}: {
  overview: AdminPlatformOverview;
}) {
  const trend = overview.salesTrend;
  const trendMeta = overview.trendMeta ?? {
    granularity: "day" as const,
    maxPoints: 45,
    truncated: false,
    startDateKey: trend[0]?.dateKey ?? null,
    endDateKey: trend.at(-1)?.dateKey ?? null,
  };
  const maxRevenue = Math.max(1, ...trend.map((point) => point.revenue));
  const totalRevenue =
    overview.periodSummary?.paidAmount ??
    trend.reduce((total, point) => total + point.revenue, 0);
  const totalSales =
    overview.periodSummary?.salesCount ??
    trend.reduce((total, point) => total + point.salesCount, 0);
  const hasTrendData = totalRevenue > 0 || totalSales > 0;
  const trendRange =
    trendMeta.startDateKey && trendMeta.endDateKey
      ? `${formatTrendBucket(trendMeta.startDateKey, trendMeta.granularity)} – ${formatTrendBucket(trendMeta.endDateKey, trendMeta.granularity)}`
      : "Sin rango disponible";

  return (
    <DashboardPanelShell
      description={`Cobros aplicados con granularidad ${granularityLabel(trendMeta.granularity).toLowerCase()} · ${trendRange}${trendMeta.truncated ? ` · últimos ${trendMeta.maxPoints} periodos con actividad` : ""}.`}
      headerAside={
        <Badge
          className="self-start border-zinc-700 bg-black/20 text-zinc-300 sm:self-auto"
          tt="none"
          variant="outline"
        >
          {granularityLabel(trendMeta.granularity)} ·{" "}
          {formatCurrency(totalRevenue)} · {formatCount(totalSales)} ventas
        </Badge>
      }
      title="Ventas del periodo seleccionado"
    >
      {hasTrendData ? (
        <div className="overflow-x-auto pb-2">
          <div
            className="grid h-44 gap-1 sm:gap-2"
            style={{
              gridTemplateColumns: `repeat(${trend.length}, minmax(32px, 1fr))`,
              minWidth: `${Math.max(560, trend.length * 36)}px`,
            }}
          >
            {trend.map((point) => {
              const barHeight = Math.max(
                point.revenue > 0 ? 10 : 4,
                (point.revenue / maxRevenue) * 100
              );

              return (
                <div
                  className="flex h-full min-w-0 flex-col justify-end"
                  key={point.dateKey}
                  title={`${formatTrendBucket(point.dateKey, trendMeta.granularity)}: ${formatCurrency(point.revenue)} · ${formatCount(point.salesCount)} ventas · ${formatCount(point.activeOrganizations)} clientes activos`}
                >
                  <div className="mb-1 hidden text-center text-[10px] text-zinc-500 lg:block">
                    {formatCompactCurrency(point.revenue)}
                  </div>
                  <div className="flex h-24 items-end border-zinc-800/80 border-b px-0.5">
                    <div
                      className={
                        point.revenue > 0
                          ? "w-full rounded-t-md bg-gradient-to-t from-[var(--color-voltage)] to-[#f1ff87] shadow-[0_0_20px_rgba(201,230,5,0.12)] transition-all"
                          : "w-full rounded-full bg-zinc-800 transition-all"
                      }
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <div className="mt-2 truncate text-center text-[10px] text-zinc-400">
                    {formatTrendBucket(point.dateKey, trendMeta.granularity)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState>
          No hay ventas para mostrar en el periodo seleccionado.
        </EmptyState>
      )}
    </DashboardPanelShell>
  );
}

function AdminDailySalesByClientPanel({
  overview,
}: {
  overview: AdminPlatformOverview;
}) {
  const { actions } = useAdminPage();
  const rows = overview.organizationsDaily;
  const rankingMeta = overview.rankingMeta ?? {
    limit: rows.length,
    total: rows.length,
    truncated: false,
  };
  const openOrganizations = () => {
    replaceAdminUrlParams({ adminTab: "organizations" });
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <DashboardPanelShell
      description={`Ranking por cobrado del periodo${rankingMeta.truncated ? ` · top ${rankingMeta.limit} de ${rankingMeta.total}` : ""}.`}
      headerAside={
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className="self-start border-zinc-700 bg-black/20 text-zinc-300 sm:self-auto"
            tt="none"
            variant="outline"
          >
            {formatCount(overview.today.activeOrganizations)} con ventas
          </Badge>
          {rankingMeta.truncated ? (
            <Button
              onClick={openOrganizations}
              size="compact-xs"
              variant="subtle"
            >
              Ver listado completo
            </Button>
          ) : null}
        </div>
      }
      title="Ventas por organización"
    >
      {rows.length === 0 ? (
        <EmptyState>Aún no hay organizaciones registradas.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="px-4 text-zinc-400">Cliente</TableHead>
                <TableHead className="text-right text-zinc-400">
                  Ventas del periodo
                </TableHead>
                <TableHead className="text-right text-zinc-400">
                  Cobrado del periodo
                </TableHead>
                <TableHead className="hidden text-zinc-400 md:table-cell">
                  Última venta
                </TableHead>
                <TableHead className="text-right text-zinc-400">
                  Detalle
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const hasSalesToday = row.salesCountToday > 0;

                return (
                  <TableRow
                    className="border-zinc-800 hover:bg-white/[0.02]"
                    key={row.id}
                  >
                    <TableCell className="px-4">
                      <div className="min-w-0">
                        <p
                          className={`truncate font-medium ${hasSalesToday ? "text-white" : "text-zinc-400"}`}
                        >
                          {row.name}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {row.slug}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-zinc-300 tabular-nums">
                      {formatCount(row.salesCountToday)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm tabular-nums ${hasSalesToday ? "font-medium text-white" : "text-zinc-500"}`}
                    >
                      {formatCurrency(row.revenueToday)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-zinc-400 md:table-cell">
                      {row.lastSaleAt
                        ? formatAdminDateTime(row.lastSaleAt)
                        : "Sin ventas"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionIcon
                        aria-label={`Ver detalle de ${row.name}`}
                        color="gray"
                        onClick={() => actions.openOrganization(row.id)}
                        variant="outline"
                      >
                        <ExternalLink className="size-3.5" />
                      </ActionIcon>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardPanelShell>
  );
}

export function AdminOverviewTab() {
  const initialParams = getAdminUrlParams();
  const [period, setPeriod] = useState<"30d" | "custom" | "all">(() => {
    const value = initialParams.get("v_period");
    return value === "custom" || value === "all" ? value : "30d";
  });
  const [organizationId, setOrganizationId] = useState(
    () => initialParams.get("v_organizationId") ?? ""
  );
  const [startDate, setStartDate] = useState(
    () => initialParams.get("v_startDate") ?? ""
  );
  const [endDate, setEndDate] = useState(
    () => initialParams.get("v_endDate") ?? ""
  );
  const [organizationSearch, setOrganizationSearch] = useState("");
  const organizationOptions = useAdminOptionsQuery({
    resource: "organizations",
    search: organizationSearch,
    selectedIds: organizationId ? [organizationId] : [],
  });
  const updatePeriod = (value: string) => {
    const next = value === "custom" || value === "all" ? value : "30d";
    setPeriod(next);
    replaceAdminUrlParams({ v_period: next, v_page: null });
  };
  const updateOrganization = (value: string | null) => {
    setOrganizationId(value ?? "");
    replaceAdminUrlParams({ v_organizationId: value, v_page: null });
  };
  const updateDate = (key: "startDate" | "endDate", value: string) => {
    if (key === "startDate") {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
    replaceAdminUrlParams({ [`v_${key}`]: value, v_page: null });
  };
  const clear = () => {
    setPeriod("30d");
    setOrganizationId("");
    setStartDate("");
    setEndDate("");
    replaceAdminUrlParams({
      v_period: null,
      v_organizationId: null,
      v_startDate: null,
      v_endDate: null,
    });
  };
  const overviewQuery = useAdminOverviewQuery({
    period,
    organizationId: organizationId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  if (overviewQuery.isPending) {
    return <AdminTabLoading />;
  }

  if (overviewQuery.isError) {
    return (
      <AdminTabError
        error={overviewQuery.error}
        fallbackMessage="Ocurrió un error al cargar las analíticas. Intenta de nuevo."
        onRetry={() => overviewQuery.refetch()}
        title="No se pudo cargar el resumen de la plataforma"
      />
    );
  }

  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-4">
        <Select
          allowDeselect={false}
          data={[
            { value: "30d", label: "Últimos 30 días" },
            { value: "custom", label: "Periodo personalizado" },
            { value: "all", label: "Histórico" },
          ]}
          onChange={(value) => updatePeriod(value ?? "30d")}
          value={period}
          w={190}
        />
        <Select
          clearable
          data={(organizationOptions.data?.items ?? []).map((organization) => ({
            value: organization.id,
            label: organization.name,
          }))}
          nothingFoundMessage="No se encontraron organizaciones"
          onChange={updateOrganization}
          onSearchChange={setOrganizationSearch}
          placeholder="Todas las organizaciones"
          searchable
          searchValue={organizationSearch}
          value={organizationId || null}
          w={240}
        />
        {period === "custom" ? (
          <>
            <TextInput
              label="Desde"
              onChange={(event) => updateDate("startDate", event.target.value)}
              type="date"
              value={startDate}
            />
            <TextInput
              label="Hasta"
              onChange={(event) => updateDate("endDate", event.target.value)}
              type="date"
              value={endDate}
            />
          </>
        ) : null}
        <Button
          leftSection={<X className="size-4" />}
          onClick={clear}
          variant="subtle"
        >
          Limpiar filtros
        </Button>
      </div>
      <AdminPlatformStatCards overview={overview} />
      <AdminPlatformTrendPanel overview={overview} />
      <AdminDailySalesByClientPanel overview={overview} />
    </div>
  );
}
