import { ArrowRight } from "lucide-react";
import { Link } from "@/components/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DashboardPanelShell,
  MetricItem,
} from "@/features/dashboard/components/dashboard-ui-primitives";
import {
  dashboardDateTimeFormatter,
  formatCount,
  formatCurrency,
  formatPaymentMethod,
} from "@/features/dashboard/dashboard-formatters.shared";
import { useDashboardData } from "@/features/dashboard/dashboard-page-context";

export function DashboardOperationPanel() {
  const { activeShift, paymentMix, paymentMethodLabels, stats } =
    useDashboardData();

  const paymentTotal = paymentMix.reduce(
    (total, payment) => total + payment.amount,
    0
  );
  const primaryPaymentMethod =
    paymentMix.toSorted((left, right) => right.amount - left.amount)[0] ?? null;

  return (
    <DashboardPanelShell
      description="Estado del turno y distribución de cobros de hoy."
      title="Operación actual"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sm text-white">Turno</p>
          <p className="mt-1 text-sm text-zinc-400">
            {activeShift
              ? `Abierto en ${activeShift.terminalName ?? "caja principal"}`
              : "No hay un turno abierto para este usuario"}
          </p>
        </div>
        <Badge
          className={
            activeShift
              ? "border-0 bg-emerald-500/10 text-emerald-300"
              : "border-0 bg-zinc-800/80 text-zinc-300"
          }
        >
          {activeShift ? "Activo" : "Pendiente"}
        </Badge>
      </div>

      {activeShift ? (
        <div className="rounded-xl border border-zinc-800/60 bg-black/20 p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <MetricItem
              description="Hora local"
              label="Abierto desde"
              value={dashboardDateTimeFormatter.format(activeShift.openedAt)}
            />
            <MetricItem
              description="Efectivo de apertura"
              label="Base inicial"
              value={formatCurrency(activeShift.startingCash)}
            />
          </div>
        </div>
      ) : (
        <Button
          asChild
          className="h-9 w-full border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
          variant="outline"
        >
          <Link href="/pos">
            Abrir caja en POS
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      )}

      <div className="border-zinc-800 border-t pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium text-sm text-white">Cobros hoy</p>
          <p className="text-sm text-zinc-400">
            {formatCurrency(paymentTotal)}
          </p>
        </div>

        {paymentMix.length > 0 ? (
          <div className="space-y-3">
            {paymentMix.map((paymentMethod) => {
              const width =
                paymentTotal > 0
                  ? (paymentMethod.amount / paymentTotal) * 100
                  : 0;

              return (
                <div className="space-y-1.5" key={paymentMethod.method}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">
                      {formatPaymentMethod(
                        paymentMethod.method,
                        paymentMethodLabels
                      )}
                    </span>
                    <span className="text-zinc-400">
                      {formatCurrency(paymentMethod.amount)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/20">
                    <div
                      className="h-2 rounded-full bg-[var(--color-voltage)] transition-all"
                      style={{ width: `${Math.max(width, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-zinc-500">
              Medio principal:{" "}
              {primaryPaymentMethod
                ? formatPaymentMethod(
                    primaryPaymentMethod.method,
                    paymentMethodLabels
                  )
                : "Sin registros"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 border-dashed px-4 py-6 text-center text-sm text-zinc-500">
            Aún no hay cobros registrados hoy.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800/60 bg-black/20 p-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <MetricItem
            description="Base disponible"
            label="Clientes activos"
            value={formatCount(stats.activeCustomersCount)}
          />
          <MetricItem
            description="Catálogo habilitado"
            label="Productos activos"
            value={formatCount(stats.activeProductsCount)}
          />
        </div>
      </div>

      <Button
        asChild
        className="h-10 w-full border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
        variant="outline"
      >
        <Link href="/shifts">
          Ver turnos y cierres
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </Button>
    </DashboardPanelShell>
  );
}
