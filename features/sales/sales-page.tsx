import { Button, SegmentedControl } from "@mantine/core";
import { Clock3, Receipt, Store, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/components/link";
import { SalesDetailSheet } from "@/features/sales/components/sale-detail-sheet";
import { SalesCancelDialog } from "@/features/sales/components/sales-cancel-dialog";
import { SalesFilterToolbar } from "@/features/sales/components/sales-filter-toolbar";
import { SalesListPanel } from "@/features/sales/components/sales-list-panel";
import {
  SalesCompactMetricCard,
  SalesIndeterminateProgressBar,
} from "@/features/sales/components/sales-ui-primitives";
import { formatSalesCurrency } from "@/features/sales/sales-formatters.shared";
import { SALES_VIEW_VALUES } from "@/features/sales/sales-page.constants.shared";
import {
  SalesPageProvider,
  useSalesPage,
} from "@/features/sales/sales-page-context";

function SalesPageHeader() {
  const { state } = useSalesPage();

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="flex items-baseline gap-3">
        <h1 className="font-semibold text-3xl text-white tracking-tight">
          Ventas
        </h1>
        <span className="text-sm text-zinc-400">
          {state.sales.length} registros •{" "}
          {formatSalesCurrency(state.totalRevenue)} facturado
        </span>
      </div>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button
          className="w-full shrink-0 sm:w-auto"
          color="gray"
          component={Link}
          href="/dashboard"
          variant="outline"
        >
          Ver dashboard
        </Button>
        <Button
          c="black"
          className="w-full shrink-0 sm:w-auto"
          color="voltage.5"
          component={Link}
          href="/pos"
          leftSection={<Store aria-hidden="true" className="size-4" />}
        >
          Ir al POS
        </Button>
      </div>
    </div>
  );
}

function SalesPageViewTabs({ children }: { children: ReactNode }) {
  const { state, actions } = useSalesPage();

  return (
    <div className="w-full">
      <div className="mb-6 flex w-full justify-center">
        <SegmentedControl
          data={[
            { label: "Ventas de hoy", value: "today" },
            { label: "Historial de ventas", value: "history" },
          ]}
          onChange={(value) => {
            if (
              SALES_VIEW_VALUES.includes(
                value as (typeof SALES_VIEW_VALUES)[number]
              )
            ) {
              actions.setActiveView(
                value as (typeof SALES_VIEW_VALUES)[number]
              );
            }
          }}
          value={state.activeView}
        />
      </div>
      {children}
    </div>
  );
}

function SalesPageMetrics() {
  const { state } = useSalesPage();

  return (
    <div className="mb-6 grid gap-3 lg:grid-cols-3">
      <SalesCompactMetricCard
        icon={Receipt}
        title={state.viewSummary.resultsTitle}
        value={`${state.sales.length}`}
      />
      <SalesCompactMetricCard
        icon={Wallet}
        title={state.viewSummary.revenueTitle}
        value={formatSalesCurrency(state.totalRevenue)}
      />
      <SalesCompactMetricCard
        icon={Clock3}
        title={state.viewSummary.pendingTitle}
        value={formatSalesCurrency(state.totalPending)}
      />
    </div>
  );
}

function SalesPageListSection() {
  const { state } = useSalesPage();

  return (
    <>
      <SalesIndeterminateProgressBar active={state.isRefreshing} />
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[var(--color-carbon)]">
        <div
          aria-busy={state.isRefreshing}
          className={`transition-opacity ${state.isRefreshing ? "opacity-80" : "opacity-100"}`}
        >
          <SalesFilterToolbar />
          <SalesListPanel />
        </div>
      </div>
    </>
  );
}

function SalesPageRoot({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 space-y-6 bg-[var(--color-page-bg)] p-6 font-sans text-[var(--color-photon)] md:p-8 lg:p-12">
      {children}
    </div>
  );
}

function SalesPageLayout() {
  return (
    <>
      <SalesPageRoot>
        <SalesPageHeader />
        <SalesPageViewTabs>
          <SalesPageMetrics />
          <SalesPageListSection />
        </SalesPageViewTabs>
      </SalesPageRoot>
      <SalesDetailSheet />
      <SalesCancelDialog />
    </>
  );
}

export function SalesPage() {
  return (
    <SalesPageProvider>
      <SalesPageLayout />
    </SalesPageProvider>
  );
}
