import {
  AlertTriangle,
  CreditCard,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { CompactStatCard } from "@/features/dashboard/components/dashboard-ui-primitives";
import {
  formatCount,
  formatCurrency,
  formatDelta,
  getPercentChange,
} from "@/features/dashboard/dashboard-formatters.shared";
import { useDashboardData } from "@/features/dashboard/dashboard-page-context";

export function DashboardStatsSection() {
  const { stats, lowStockThreshold } = useDashboardData();

  const todayRevenueChange = getPercentChange(
    stats.todayRevenue,
    stats.yesterdayRevenue
  );
  const monthRevenueChange = getPercentChange(
    stats.monthRevenue,
    stats.previousMonthRevenue
  );

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      <CompactStatCard
        description={`${formatCount(stats.todaySalesCount)} ventas registradas`}
        highlight={formatDelta(todayRevenueChange, "vs ayer")}
        icon={Receipt}
        title="Ventas hoy"
        value={formatCurrency(stats.todayRevenue)}
      />
      <CompactStatCard
        description={
          stats.todayCustomersServed > 0
            ? `${formatCount(stats.todayCustomersServed)} clientes identificados`
            : "Sin clientes identificados"
        }
        highlight="Basado en ventas del día"
        icon={Wallet}
        title="Ticket promedio"
        value={formatCurrency(stats.todayAvgTicket)}
      />
      <CompactStatCard
        description={`${formatCount(stats.monthSalesCount)} ventas acumuladas`}
        highlight={formatDelta(monthRevenueChange, "vs mes anterior")}
        icon={TrendingUp}
        title="Ventas del mes"
        value={formatCurrency(stats.monthRevenue)}
      />
      <CompactStatCard
        description={`${formatCount(stats.creditAccountsCount)} cuentas por cobrar`}
        highlight={
          stats.creditAccountsCount > 0
            ? "Requiere seguimiento"
            : "Sin saldo pendiente"
        }
        icon={CreditCard}
        title="Cartera pendiente"
        value={formatCurrency(stats.pendingCreditBalance)}
      />
      <CompactStatCard
        description={`${formatCount(stats.activeProductsCount)} productos activos`}
        highlight={`Stock <= ${lowStockThreshold}`}
        icon={AlertTriangle}
        title="Inventario en riesgo"
        value={formatCount(stats.lowStockCount)}
      />
    </section>
  );
}
