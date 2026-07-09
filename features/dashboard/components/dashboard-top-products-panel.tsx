import { SegmentedControl } from "@mantine/core";
import { useMemo, useState } from "react";
import {
  DashboardPanelShell,
  EmptyState,
} from "@/features/dashboard/components/dashboard-ui-primitives";
import { formatCount } from "@/features/dashboard/dashboard-formatters.shared";
import { useDashboardData } from "@/features/dashboard/dashboard-page-context";
import { formatCurrency } from "@/lib/format-currency.shared";

export function DashboardTopProductsPanel() {
  const { salesWindow, topProductsToday, topProductsShift } =
    useDashboardData();
  const [viewMode, setViewMode] = useState<"day" | "shift">("shift");

  const activeRows = useMemo(
    () => (viewMode === "day" ? topProductsToday : topProductsShift),
    [topProductsToday, topProductsShift, viewMode]
  );

  let panelDescription = "Productos vendidos hoy (día calendario).";
  if (viewMode === "shift") {
    panelDescription =
      salesWindow.kind === "none"
        ? "No hay turno abierto ni cerrado reciente para construir el ranking del turno."
        : "Productos vendidos en la ventana operativa del turno actual.";
  }

  return (
    <DashboardPanelShell
      description={panelDescription}
      headerAside={
        <SegmentedControl
          data={[
            { label: "Turno", value: "shift" },
            { label: "Día", value: "day" },
          ]}
          onChange={(value) => setViewMode(value as "day" | "shift")}
          size="xs"
          value={viewMode}
        />
      }
      title="Productos más vendidos"
    >
      {activeRows.length > 0 ? (
        <div className="space-y-3">
          {activeRows.map((productItem, index) => (
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
          {viewMode === "day"
            ? "Aún no hay ventas hoy para construir el ranking."
            : "Aún no hay ventas en el turno para construir el ranking."}
        </EmptyState>
      )}
    </DashboardPanelShell>
  );
}
