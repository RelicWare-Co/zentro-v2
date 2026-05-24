import type { ReactNode } from "react";
import { DashboardAlertsPanel } from "@/features/dashboard/components/dashboard-alerts-panel";
import { DashboardOperationPanel } from "@/features/dashboard/components/dashboard-operation-panel";
import { DashboardPageHeader } from "@/features/dashboard/components/dashboard-page-header";
import {
  DashboardPageError,
  DashboardPageLoading,
} from "@/features/dashboard/components/dashboard-page-states";
import { DashboardRecentSalesPanel } from "@/features/dashboard/components/dashboard-recent-sales-panel";
import { DashboardSalesTrendPanel } from "@/features/dashboard/components/dashboard-sales-trend-panel";
import { DashboardStatsSection } from "@/features/dashboard/components/dashboard-stats-section";
import { DashboardTopProductsPanel } from "@/features/dashboard/components/dashboard-top-products-panel";
import {
  DashboardPageProvider,
  useDashboardPage,
} from "@/features/dashboard/dashboard-page-context";

function DashboardPageRoot({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 space-y-6 overflow-y-auto bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      {children}
    </main>
  );
}

function DashboardPageLayout() {
  const { state } = useDashboardPage();

  if (state.isPending) {
    return <DashboardPageLoading />;
  }

  if (state.isError || !state.data) {
    return <DashboardPageError />;
  }

  return (
    <DashboardPageRoot>
      <DashboardPageHeader />
      <DashboardStatsSection />
      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <DashboardSalesTrendPanel />
        <DashboardOperationPanel />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <DashboardTopProductsPanel />
        <DashboardAlertsPanel />
      </section>
      <section>
        <DashboardRecentSalesPanel />
      </section>
    </DashboardPageRoot>
  );
}

export function DashboardPage() {
  return (
    <DashboardPageProvider>
      <DashboardPageLayout />
    </DashboardPageProvider>
  );
}

export const DashboardPageCompound = {
  Provider: DashboardPageProvider,
  Root: DashboardPageRoot,
  Header: DashboardPageHeader,
  Stats: DashboardStatsSection,
  SalesTrend: DashboardSalesTrendPanel,
  Operation: DashboardOperationPanel,
  TopProducts: DashboardTopProductsPanel,
  Alerts: DashboardAlertsPanel,
  RecentSales: DashboardRecentSalesPanel,
  Loading: DashboardPageLoading,
  Error: DashboardPageError,
};
