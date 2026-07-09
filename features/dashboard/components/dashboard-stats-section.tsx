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
  formatDelta,
  getPercentChange,
} from "@/features/dashboard/dashboard-formatters.shared";
import { useDashboardData } from "@/features/dashboard/dashboard-page-context";
import { formatCurrency } from "@/lib/format-currency.shared";

export function DashboardStatsSection() {
  const { stats, salesWindow, lowStockThreshold } = useDashboardData();

  const shiftRevenueChange = getPercentChange(
    stats.shiftRevenue,
    stats.previousShiftRevenue
  );
  const monthRevenueChange = getPercentChange(
    stats.monthRevenue,
    stats.previousMonthRevenue
  );

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      <CompactStatCard
        description={
          salesWindow.kind === "none"
            ? "Sin turnos registrados"
            : `${formatCurrency(stats.shiftGrossSales)} facturados · ${formatCurrency(stats.shiftTaxCollected)} IVA`
        }
        highlight={formatDelta(shiftRevenueChange, "vs turno anterior")}
        icon={Receipt}
        title={
          salesWindow.kind === "closed"
            ? "Ingreso neto último turno"
            : "Ingreso neto del turno"
        }
        value={formatCurrency(stats.shiftRevenue)}
      />
      <CompactStatCard
        description={
          stats.shiftCustomersServed > 0
            ? `${formatCount(stats.shiftCustomersServed)} clientes identificados`
            : "Sin clientes identificados"
        }
        highlight="Basado en ventas del turno"
        icon={Wallet}
        title="Ticket promedio"
        value={formatCurrency(stats.shiftAvgTicket)}
      />
      <CompactStatCard
        description={`${formatCurrency(stats.monthGrossSales)} facturados · ${formatCurrency(stats.monthTaxCollected)} IVA`}
        highlight={formatDelta(monthRevenueChange, "vs mes anterior")}
        icon={TrendingUp}
        title="Ingreso neto del mes"
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
