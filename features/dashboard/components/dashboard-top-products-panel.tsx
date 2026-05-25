import {
  DashboardPanelShell,
  EmptyState,
} from "@/features/dashboard/components/dashboard-ui-primitives";
import {
  formatCount,
  formatCurrency,
} from "@/features/dashboard/dashboard-formatters.shared";
import { useDashboardData } from "@/features/dashboard/dashboard-page-context";

export function DashboardTopProductsPanel() {
  const { topProducts } = useDashboardData();

  return (
    <DashboardPanelShell
      description="Top de los últimos 30 días para vigilar rotación y stock."
      title="Productos más vendidos"
    >
      {topProducts.length > 0 ? (
        <div className="space-y-3">
          {topProducts.map((productItem, index) => (
            <div
              className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-black/10 px-4 py-3 transition-colors hover:bg-white/5"
              key={productItem.productId}
            >
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <p className="font-semibold text-[var(--color-voltage)] text-xs">
                    #{index + 1}
                  </p>
                  <p className="truncate font-medium text-white">
                    {productItem.name}
                  </p>
                </div>
                <p className="text-xs text-zinc-400">
                  {formatCount(productItem.quantitySold)} uds. vendidas
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium text-sm text-white">
                  {formatCurrency(productItem.revenue)}
                </p>
                <p className="text-xs text-zinc-500">
                  Stock: {formatCount(productItem.stock)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>
          Aún no hay ventas suficientes para construir el ranking.
        </EmptyState>
      )}
    </DashboardPanelShell>
  );
}
