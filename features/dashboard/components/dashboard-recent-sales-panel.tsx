import { Badge } from "@mantine/core";
import {
  DashboardPanelShell,
  EmptyState,
} from "@/features/dashboard/components/dashboard-ui-primitives";
import { dashboardDateTimeFormatter } from "@/features/dashboard/dashboard-formatters.shared";
import { useDashboardData } from "@/features/dashboard/dashboard-page-context";
import {
  formatSaleStatus,
  getSaleStatusBadgeClass,
} from "@/features/sales/sales-formatters.shared";
import { formatCurrency } from "@/lib/format-currency.shared";

export function DashboardRecentSalesPanel() {
  const { recentSales } = useDashboardData();

  return (
    <DashboardPanelShell
      description="Actividad más reciente para validar montos, tiempos y tipo de venta."
      title="Ventas recientes"
    >
      {recentSales.length > 0 ? (
        <div className="space-y-3">
          {recentSales.map((recentSale) => (
            <div
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-black/10 px-4 py-3 transition-colors hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between"
              key={recentSale.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-sm text-white">
                    {recentSale.customerName ?? "Cliente mostrador"}
                  </p>
                  <Badge
                    className={`${getSaleStatusBadgeClass(recentSale.status)} border-0`}
                    size="sm"
                    tt="none"
                  >
                    {formatSaleStatus(recentSale.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {dashboardDateTimeFormatter.format(recentSale.createdAt)}
                </p>
              </div>
              <p className="font-semibold text-[var(--color-voltage)] text-sm">
                {formatCurrency(recentSale.totalAmount)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>No se han registrado ventas todavía.</EmptyState>
      )}
    </DashboardPanelShell>
  );
}
