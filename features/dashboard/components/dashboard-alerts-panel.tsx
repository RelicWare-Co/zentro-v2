import { Badge } from "@mantine/core";
import { AlertTriangle, CreditCard } from "lucide-react";
import { Link } from "@/components/link";
import {
  DashboardPanelShell,
  EmptyState,
} from "@/features/dashboard/components/dashboard-ui-primitives";
import {
  formatCount,
  formatCurrency,
} from "@/features/dashboard/dashboard-formatters.shared";
import { useDashboardData } from "@/features/dashboard/dashboard-page-context";
import { getStockStatus } from "@/features/inventory/stock-status.shared";

function productsPageStockFilterHref(
  product: { minStock: number | null; stock: number },
  lowStockThreshold: number
) {
  const status = getStockStatus({
    trackInventory: true,
    stock: product.stock,
    minStock: product.minStock,
    lowStockThreshold,
  });
  return status === "out" || status === "low"
    ? `/products?stock=${status}`
    : "/products?stock=low";
}

export function DashboardAlertsPanel() {
  const { stats, lowStockProducts, lowStockThreshold } = useDashboardData();

  return (
    <DashboardPanelShell
      description="Señales clave para actuar antes de que afecten la operación."
      title="Alertas operativas"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-amber-200 text-sm">
                Inventario bajo
              </p>
              <p className="mt-1 text-amber-200/70 text-xs">
                {formatCount(stats.lowStockCount)} productos con stock en
                riesgo.
              </p>
            </div>
            <AlertTriangle className="size-5 text-amber-400" />
          </div>
        </div>

        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-sky-200 text-sm">
                Cartera pendiente
              </p>
              <p className="mt-1 text-sky-200/70 text-xs">
                {formatCurrency(stats.pendingCreditBalance)} por cobrar en{" "}
                {formatCount(stats.creditAccountsCount)} cuentas.
              </p>
            </div>
            <CreditCard className="size-5 text-sky-400" />
          </div>
        </div>

        {lowStockProducts.length > 0 ? (
          <div className="space-y-3 pt-2">
            {lowStockProducts.map((productItem) => (
              <Link
                className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-black/10 px-4 py-3 transition-colors hover:bg-white/5"
                href={productsPageStockFilterHref(
                  productItem,
                  lowStockThreshold
                )}
                key={productItem.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm text-white">
                    {productItem.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {productItem.categoryName ?? "Sin categoría"}
                  </p>
                </div>
                <Badge
                  className="border-0 bg-amber-500/10 text-amber-300"
                  tt="none"
                >
                  Stock {formatCount(productItem.stock)}
                </Badge>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState>No hay productos con stock comprometido.</EmptyState>
        )}
      </div>
    </DashboardPanelShell>
  );
}
