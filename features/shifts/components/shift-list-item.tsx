import { Badge } from "@mantine/core";
import { User } from "lucide-react";
import { formatCurrency, formatPaymentMethodLabel } from "@/features/pos/utils";
import type { ShiftListItem } from "@/features/shifts/shifts.shared";
import {
  formatMovementType,
  formatShiftCount,
  formatShiftRange,
  formatShiftStatus,
  formatSignedCurrency,
  getDifferenceClassName,
  getShiftStatusBadgeClass,
} from "@/features/shifts/shifts-formatters.shared";

export function ShiftListItemCard({
  shift,
  paymentMethodLabels,
}: {
  shift: ShiftListItem;
  paymentMethodLabels: Record<string, string>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black/10 transition-colors hover:border-zinc-700 hover:bg-white/5">
      <div className="flex flex-col gap-4 border-zinc-800/50 border-b bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-[var(--color-carbon)] text-zinc-400">
            <User className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-medium text-white">
                {shift.cashierName}
              </h3>
              <Badge
                className={`${getShiftStatusBadgeClass(shift.status)} border-0`}
                tt="none"
              >
                {formatShiftStatus(shift.status)}
              </Badge>
              <span className="font-mono text-xs text-zinc-500">
                #{shift.id.slice(0, 8)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-zinc-400">
              {shift.terminalName ?? "Caja principal"}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="font-medium text-sm text-zinc-300">
            {formatShiftRange(shift.openedAt, shift.closedAt)}
          </p>
          {shift.notes ? (
            <p
              className="mt-1 max-w-[280px] truncate text-xs text-zinc-500 sm:ml-auto"
              title={shift.notes}
            >
              {shift.notes}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-zinc-800/50 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <div className="p-4">
          <h4 className="mb-3 font-semibold text-xs text-zinc-500 uppercase tracking-wider">
            Operaciones
          </h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">
                  Pagadas ({formatShiftCount(shift.operations.paidSalesCount)})
                </p>
                <p className="font-medium text-sm text-white">
                  {formatCurrency(shift.operations.paidSalesAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">
                  A crédito (
                  {formatShiftCount(shift.operations.creditSalesCount)})
                </p>
                <p className="font-medium text-sm text-white">
                  {formatCurrency(shift.operations.creditSalesAmount)}
                </p>
              </div>
            </div>
            <div className="border-zinc-800/50 border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  Anuladas (
                  {formatShiftCount(shift.operations.cancelledSalesCount)})
                </span>
                <span className="text-xs text-zinc-300">
                  {formatCurrency(shift.operations.cancelledSalesAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/5 p-4">
          <h4 className="mb-3 font-semibold text-xs text-zinc-500 uppercase tracking-wider">
            Valores Esperados
          </h4>
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-zinc-500">Efectivo Total</p>
                <p className="font-semibold text-base text-emerald-400">
                  {formatCurrency(shift.totals.expectedCash)}
                </p>
                <p className="text-xs text-zinc-500">
                  Base: {formatCurrency(shift.startingCash)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">
                  Otros Pagos ({formatShiftCount(shift.payments.length)})
                </p>
                <p className="font-medium text-sm text-white">
                  {formatCurrency(shift.totals.totalPayments)}
                </p>
              </div>
            </div>
            {shift.paymentBreakdown.length > 0 ? (
              <div className="space-y-1.5 border-zinc-800/50 border-t pt-2">
                {shift.paymentBreakdown.map((paymentMethod) => (
                  <div
                    className="flex items-center justify-between text-xs"
                    key={paymentMethod.method}
                  >
                    <span className="text-zinc-400">
                      {formatPaymentMethodLabel(
                        paymentMethod.method,
                        paymentMethodLabels
                      )}
                    </span>
                    <span className="font-medium text-zinc-300">
                      {formatCurrency(paymentMethod.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-black/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold text-xs text-zinc-500 uppercase tracking-wider">
              Cierre y Conciliación
            </h4>
            {shift.closures.length > 0 ? (
              <span
                className={`inline-flex h-6 items-center rounded-md border border-zinc-700/60 bg-zinc-800/60 px-2 py-0.5 font-medium text-xs ${getDifferenceClassName(shift.totals.totalDifference)}`}
              >
                {shift.totals.totalDifference === 0
                  ? "Cuadrado"
                  : formatSignedCurrency(shift.totals.totalDifference)}
              </span>
            ) : null}
          </div>

          {shift.closures.length > 0 ? (
            <div className="space-y-2">
              {shift.closures.map((closure) => (
                <div
                  className="flex items-center justify-between text-xs"
                  key={closure.paymentMethod}
                >
                  <span className="text-zinc-300">
                    {formatPaymentMethodLabel(
                      closure.paymentMethod,
                      paymentMethodLabels
                    )}
                  </span>
                  <div className="text-right">
                    <span className="block font-medium text-white">
                      {formatCurrency(closure.actualAmount)}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      vs {formatCurrency(closure.expectedAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">
              El turno sigue abierto o aún no tiene conciliación registrada.
            </p>
          )}

          {shift.movements.length > 0 ? (
            <div className="mt-4 border-zinc-800/50 border-t pt-3">
              <p className="mb-2 font-medium text-[10px] text-zinc-500 uppercase tracking-wider">
                Movimientos de caja ({shift.movements.length})
              </p>
              <div className="space-y-1.5">
                {shift.movements.slice(0, 3).map((movement) => (
                  <div
                    className="flex items-start justify-between gap-2 text-xs"
                    key={movement.id}
                  >
                    <span
                      className="line-clamp-2 break-words text-zinc-400"
                      title={movement.description}
                    >
                      {movement.description ||
                        formatMovementType(movement.type)}
                    </span>
                    <span
                      className={`shrink-0 font-medium ${
                        movement.type === "inflow"
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {movement.type === "inflow" ? "+" : "-"}
                      {formatCurrency(movement.amount)}
                    </span>
                  </div>
                ))}
                {shift.movements.length > 3 ? (
                  <p className="mt-1 text-[10px] text-zinc-500 italic">
                    + {shift.movements.length - 3} movimientos más
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
