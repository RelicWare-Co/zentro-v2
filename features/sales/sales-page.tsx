import { Clock3, Receipt, Store, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
          asChild
          className="h-10 w-full shrink-0 rounded-lg border-zinc-800 bg-[var(--color-carbon)] px-4 py-2 text-zinc-300 hover:bg-white/5 hover:text-white sm:w-auto"
          variant="outline"
        >
          <Link href="/dashboard">Ver dashboard</Link>
        </Button>
        <Button
          asChild
          className="h-10 w-full shrink-0 rounded-lg bg-[var(--color-voltage)] px-4 py-2 font-semibold text-black hover:bg-[#c9e605] sm:w-auto"
        >
          <Link href="/pos">
            <Store aria-hidden="true" className="mr-2 size-4" />
            Ir al POS
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SalesPageViewTabs({ children }: { children: ReactNode }) {
  const { state, actions } = useSalesPage();

  return (
    <Tabs
      className="w-full"
      onValueChange={(value) => {
        if (
          SALES_VIEW_VALUES.includes(
            value as (typeof SALES_VIEW_VALUES)[number]
          )
        ) {
          actions.setActiveView(value as (typeof SALES_VIEW_VALUES)[number]);
        }
      }}
      value={state.activeView}
    >
      <TabsList className="!h-auto mb-6 inline-flex rounded-full border border-zinc-800 bg-black/20 p-1">
        <TabsTrigger
          className="!rounded-full data-[state=active]:!bg-zinc-800/80 data-[state=active]:!text-white data-[state=active]:!shadow-sm data-[state=active]:!border-transparent !border-transparent !h-auto inline-flex min-h-[40px] items-center justify-center bg-transparent px-6 py-1.5 font-medium text-sm text-zinc-400 outline-none transition-all duration-200 ease-in-out hover:text-zinc-200"
          value="today"
        >
          Ventas de hoy
        </TabsTrigger>
        <TabsTrigger
          className="!rounded-full data-[state=active]:!bg-zinc-800/80 data-[state=active]:!text-white data-[state=active]:!shadow-sm data-[state=active]:!border-transparent !border-transparent !h-auto inline-flex min-h-[40px] items-center justify-center bg-transparent px-6 py-1.5 font-medium text-sm text-zinc-400 outline-none transition-all duration-200 ease-in-out hover:text-zinc-200"
          value="history"
        >
          Historial de ventas
        </TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
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
    <div className="flex-1 space-y-6 bg-[var(--color-void)] p-6 font-sans text-[var(--color-photon)] md:p-8 lg:p-12">
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

export const SalesPageCompound = {
  Provider: SalesPageProvider,
  Root: SalesPageRoot,
  Header: SalesPageHeader,
  ViewTabs: SalesPageViewTabs,
  Metrics: SalesPageMetrics,
  ListSection: SalesPageListSection,
  DetailSheet: SalesDetailSheet,
  CancelDialog: SalesCancelDialog,
};
