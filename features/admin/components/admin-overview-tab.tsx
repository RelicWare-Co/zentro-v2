import {
  Building2,
  ChartColumn,
  ExternalLink,
  Receipt,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  AdminTabError,
  AdminTabLoading,
} from "@/features/admin/components/admin-page-states";
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
  formatCurrency,
  formatDelta,
  getPercentChange,
} from "@/features/dashboard/dashboard-formatters.shared";

const trendDayFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

function formatTrendDay(dateKey: string) {
  return trendDayFormatter.format(new Date(`${dateKey}T12:00:00`));
}

function AdminPlatformStatCards({
  overview,
}: {
  overview: AdminPlatformOverview;
}) {
  const { month, today, totals } = overview;

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <CompactStatCard
        description={`${formatCount(today.salesCount)} ventas · ticket prom. ${formatCurrency(today.avgTicket)}`}
        icon={Wallet}
        title="Ingresos de hoy"
        value={formatCurrency(today.revenue)}
      />
      <CompactStatCard
        description="Organizaciones con ventas hoy"
        icon={Store}
        title="Clientes activos hoy"
        value={`${formatCount(today.activeOrganizations)} de ${formatCount(totals.organizations)}`}
      />
      <CompactStatCard
        description={formatDelta(
          getPercentChange(month.revenue, month.previousRevenue),
          "vs mes anterior"
        )}
        icon={ChartColumn}
        title="Ingresos del mes"
        value={formatCurrency(month.revenue)}
      />
      <CompactStatCard
        description={formatDelta(
          getPercentChange(month.salesCount, month.previousSalesCount),
          "vs mes anterior"
        )}
        icon={Receipt}
        title="Ventas del mes"
        value={formatCount(month.salesCount)}
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
  const maxRevenue = Math.max(1, ...trend.map((point) => point.revenue));
  const totalRevenue = trend.reduce((total, point) => total + point.revenue, 0);
  const totalSales = trend.reduce(
    (total, point) => total + point.salesCount,
    0
  );
  const hasTrendData = totalRevenue > 0 || totalSales > 0;

  return (
    <DashboardPanelShell
      description="Ingresos diarios sumando todas las organizaciones."
      headerAside={
        <Badge
          className="self-start border-zinc-700 bg-black/20 text-zinc-300 sm:self-auto"
          variant="outline"
        >
          {formatCurrency(totalRevenue)} · {formatCount(totalSales)} ventas
        </Badge>
      }
      title="Ventas de los últimos 14 días"
    >
      {hasTrendData ? (
        <div className="grid h-44 grid-cols-[repeat(14,minmax(0,1fr))] gap-1 sm:gap-2">
          {trend.map((point) => {
            const barHeight = Math.max(
              point.revenue > 0 ? 10 : 4,
              (point.revenue / maxRevenue) * 100
            );

            return (
              <div
                className="flex h-full min-w-0 flex-col justify-end"
                key={point.dateKey}
                title={`${formatTrendDay(point.dateKey)}: ${formatCurrency(point.revenue)} · ${formatCount(point.salesCount)} ventas · ${formatCount(point.activeOrganizations)} clientes activos`}
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
                  {formatTrendDay(point.dateKey)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState>
          No hay ventas en los últimos 14 días para mostrar el gráfico.
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

  return (
    <DashboardPanelShell
      description="Cómo va el día de cada organización, incluyendo las que no han vendido."
      headerAside={
        <Badge
          className="self-start border-zinc-700 bg-black/20 text-zinc-300 sm:self-auto"
          variant="outline"
        >
          {formatCount(overview.today.activeOrganizations)} con ventas hoy
        </Badge>
      }
      title="Ventas de hoy por cliente"
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
                  Ventas hoy
                </TableHead>
                <TableHead className="text-right text-zinc-400">
                  Ingresos hoy
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
                      <Button
                        aria-label={`Ver detalle de ${row.name}`}
                        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
                        onClick={() => actions.openOrganization(row.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
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
  const overviewQuery = useAdminOverviewQuery();

  if (overviewQuery.isPending) {
    return <AdminTabLoading />;
  }

  if (overviewQuery.isError) {
    return (
      <AdminTabError
        error={overviewQuery.error}
        fallbackMessage="Ocurrió un error al cargar las analíticas. Intenta de nuevo."
        title="No se pudo cargar el resumen de la plataforma"
      />
    );
  }

  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <AdminPlatformStatCards overview={overview} />
      <AdminPlatformTrendPanel overview={overview} />
      <AdminDailySalesByClientPanel overview={overview} />
    </div>
  );
}
