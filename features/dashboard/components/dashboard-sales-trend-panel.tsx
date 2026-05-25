import { Badge } from "@/components/ui/badge";
import {
  DashboardPanelShell,
  EmptyState,
  MiniMetric,
} from "@/features/dashboard/components/dashboard-ui-primitives";
import {
  formatCompactCurrency,
  formatCount,
  formatCurrency,
  formatShortDay,
} from "@/features/dashboard/dashboard-formatters.shared";
import { useDashboardData } from "@/features/dashboard/dashboard-page-context";

export function DashboardSalesTrendPanel() {
  const { salesTrend } = useDashboardData();

  const maxTrendRevenue = Math.max(
    1,
    ...salesTrend.map((point) => point.revenue)
  );
  const weeklyRevenue = salesTrend.reduce(
    (total, point) => total + point.revenue,
    0
  );
  const weeklySales = salesTrend.reduce(
    (total, point) => total + point.salesCount,
    0
  );
  const hasTrendData = weeklyRevenue > 0 || weeklySales > 0;
  const bestDay =
    salesTrend.toSorted((left, right) => right.revenue - left.revenue)[0] ??
    null;

  return (
    <DashboardPanelShell
      description="Comportamiento reciente de ingresos y volumen de ventas."
      headerAside={
        <Badge
          className="self-start border-zinc-700 bg-black/20 text-zinc-300 sm:self-auto"
          variant="outline"
        >
          {formatCurrency(weeklyRevenue)}
        </Badge>
      }
      title="Ventas de los últimos 7 días"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <MiniMetric
          description="Últimos 7 días"
          label="Ingresos"
          value={formatCurrency(weeklyRevenue)}
        />
        <MiniMetric
          description="Tickets registrados"
          label="Ventas"
          value={formatCount(weeklySales)}
        />
        <MiniMetric
          description={
            bestDay && bestDay.revenue > 0
              ? formatCurrency(bestDay.revenue)
              : "Aún no hay historial"
          }
          label="Mejor día"
          value={
            bestDay && bestDay.revenue > 0
              ? formatShortDay(bestDay.dateKey)
              : "Sin ventas"
          }
        />
      </div>

      {hasTrendData ? (
        <div className="grid h-48 grid-cols-7 gap-2 sm:gap-3">
          {salesTrend.map((point) => {
            const barHeight = Math.max(
              point.revenue > 0 ? 12 : 4,
              (point.revenue / maxTrendRevenue) * 100
            );

            return (
              <div
                className="flex h-full min-w-0 flex-col justify-end"
                key={point.dateKey}
              >
                <div className="mb-2 text-center text-[10px] text-zinc-500 sm:text-[11px]">
                  {formatCompactCurrency(point.revenue)}
                </div>
                <div className="flex h-28 items-end border-zinc-800/80 border-b px-1">
                  <div
                    className={
                      point.revenue > 0
                        ? "w-full rounded-t-lg bg-gradient-to-t from-[var(--color-voltage)] to-[#f1ff87] shadow-[0_0_20px_rgba(201,230,5,0.12)] transition-all"
                        : "w-full rounded-full bg-zinc-800 transition-all"
                    }
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <div className="mt-3 text-center">
                  <div className="font-medium text-xs text-zinc-300">
                    {formatShortDay(point.dateKey)}
                  </div>
                  <div className="mt-1 hidden text-[10px] text-zinc-500 sm:block">
                    {formatCount(point.salesCount)} ventas
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState>
          No hay ventas en los últimos 7 días para mostrar el gráfico.
        </EmptyState>
      )}
    </DashboardPanelShell>
  );
}
