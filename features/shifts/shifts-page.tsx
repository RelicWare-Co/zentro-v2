import { Button } from "@mantine/core";
import { CircleDollarSign, Clock3, Receipt, Store, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/components/link";
import { formatCurrency } from "@/features/pos/utils";
import { ShiftsFilterToolbar } from "@/features/shifts/components/shifts-filter-toolbar";
import { ShiftsListPanel } from "@/features/shifts/components/shifts-list-panel";
import { ShiftsCompactMetricCard } from "@/features/shifts/components/shifts-ui-primitives";
import { formatShiftCount } from "@/features/shifts/shifts-formatters.shared";
import {
  ShiftsPageProvider,
  useShiftsPage,
} from "@/features/shifts/shifts-page-context";

function ShiftsPageHeader() {
  const { state } = useShiftsPage();

  return (
    <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="flex items-baseline gap-3">
        <h1 className="font-semibold text-3xl text-white tracking-tight">
          Turnos y cierres de caja
        </h1>
        <span className="text-sm text-zinc-400">
          {formatShiftCount(state.shifts.length)} turnos •{" "}
          {formatCurrency(state.summary.expectedCash)}
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

function ShiftsPageMetrics() {
  const { state } = useShiftsPage();

  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
      <ShiftsCompactMetricCard
        icon={Receipt}
        title="Turnos cargados"
        value={formatShiftCount(state.shifts.length)}
      />
      <ShiftsCompactMetricCard
        icon={Clock3}
        title="Turnos abiertos"
        value={formatShiftCount(state.summary.openShifts)}
      />
      <ShiftsCompactMetricCard
        icon={Wallet}
        title="Efectivo esperado"
        value={formatCurrency(state.summary.expectedCash)}
      />
      <ShiftsCompactMetricCard
        icon={CircleDollarSign}
        title="Movimientos"
        value={formatShiftCount(state.summary.movements)}
      />
    </div>
  );
}

function ShiftsPageListSection() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[var(--color-carbon)]">
      <ShiftsFilterToolbar />
      <ShiftsListPanel />
    </div>
  );
}

function ShiftsPageRoot({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden bg-[var(--color-void)] p-6 font-sans text-[var(--color-photon)] md:p-8 lg:p-12">
      {children}
    </main>
  );
}

function ShiftsPageLayout() {
  return (
    <ShiftsPageRoot>
      <ShiftsPageHeader />
      <ShiftsPageMetrics />
      <ShiftsPageListSection />
    </ShiftsPageRoot>
  );
}

export function ShiftsPage() {
  return (
    <ShiftsPageProvider>
      <ShiftsPageLayout />
    </ShiftsPageProvider>
  );
}
