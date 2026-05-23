import { type Dispatch, type SetStateAction, useEffect, useId } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ActiveShift } from "@/features/pos/types";
import {
  createPaymentMethodLabelMap,
  formatCurrency,
  formatPaymentMethodLabel,
} from "@/features/pos/utils";
import {
  formatMoneyInput,
  parseMoneyInput,
  sanitizeMoneyInput,
} from "@/lib/utils";
import type { ShiftCloseSummaryResultSchema } from "@/schemas/pos";

interface CloseShiftModalProps {
  activeShift: ActiveShift | null;
  closeShiftNotes: string;
  closureAmounts: Record<string, string>;
  error: Error | null;
  hasInvalidAmounts: boolean;
  isClosing: boolean;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  setCloseShiftNotes: (value: string) => void;
  setClosureAmounts: Dispatch<SetStateAction<Record<string, string>>>;
  shiftCloseSummary: z.infer<typeof ShiftCloseSummaryResultSchema> | undefined;
}

export function CloseShiftModal({
  isOpen,
  onClose,
  activeShift,
  shiftCloseSummary,
  isLoading,
  closureAmounts,
  setClosureAmounts,
  closeShiftNotes,
  setCloseShiftNotes,
  hasInvalidAmounts,
  isClosing,
  error,
  onConfirm,
}: CloseShiftModalProps) {
  const closeShiftNotesId = useId();

  // Initialize closure amounts when summary is loaded
  useEffect(() => {
    if (!shiftCloseSummary) {
      return;
    }

    setClosureAmounts(
      Object.fromEntries(
        shiftCloseSummary.summaryByMethod.map((row) => [
          row.paymentMethod,
          getInitialClosureAmount(
            row.actualAmount,
            row.paymentMethod,
            row.expectedAmount
          ),
        ])
      )
    );
  }, [shiftCloseSummary, setClosureAmounts]);

  const cashSummary = shiftCloseSummary?.summaryByMethod.find(
    (row) => row.paymentMethod === "cash"
  );
  const paymentMethodLabels = createPaymentMethodLabelMap(
    shiftCloseSummary?.paymentMethods ?? []
  );
  const movementSummary = shiftCloseSummary?.movements;
  const movementItems = movementSummary?.items ?? [];
  const nonCashSummaryRows =
    shiftCloseSummary?.summaryByMethod.filter(
      (row) => row.paymentMethod !== "cash"
    ) ?? [];
  const hasMovementItems = movementItems.length > 0;
  const shouldShowSeparatorBeforeTotal =
    hasMovementItems || nonCashSummaryRows.length > 0;

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cierre de Turno</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="rounded-lg border border-zinc-800 bg-[#0a0a0a] p-4">
            <h4 className="mb-3 font-medium text-sm text-zinc-400">
              Resumen del Sistema
            </h4>
            {isLoading && (
              <p className="text-sm text-zinc-400">Cargando resumen…</p>
            )}
            {shiftCloseSummary && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-300">Base inicial</span>
                  <span className="font-medium text-white tabular-nums">
                    {formatCurrency(shiftCloseSummary.shift.startingCash)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-300">Efectivo esperado</span>
                  <span className="font-medium text-white tabular-nums">
                    {formatCurrency(cashSummary?.expectedAmount ?? 0)}
                  </span>
                </div>
                {hasMovementItems ? (
                  <>
                    <Separator className="my-2 border-zinc-700" />
                    <div className="space-y-2">
                      <p className="font-semibold text-xs text-zinc-500 uppercase tracking-[0.18em]">
                        Movimientos de caja
                      </p>
                      <div className="flex justify-between">
                        <span className="text-zinc-300">Ingresos manuales</span>
                        <span className="font-medium text-emerald-400 tabular-nums">
                          +
                          {formatCurrency(
                            shiftCloseSummary.movements.totals.inflow
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-300">Gastos operativos</span>
                        <span className="font-medium text-red-400 tabular-nums">
                          -
                          {formatCurrency(
                            shiftCloseSummary.movements.totals.expense
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-300">Pagos a proveedor</span>
                        <span className="font-medium text-red-400 tabular-nums">
                          -
                          {formatCurrency(
                            shiftCloseSummary.movements.totals.payout
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-300">Ajuste neto</span>
                        <span
                          className={`font-medium tabular-nums ${
                            shiftCloseSummary.movements.totals.net >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {shiftCloseSummary.movements.totals.net >= 0
                            ? "+"
                            : ""}
                          {formatCurrency(
                            shiftCloseSummary.movements.totals.net
                          )}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-zinc-500">
                    No hay movimientos de caja registrados en este turno.
                  </p>
                )}
                {nonCashSummaryRows.length > 0 ? (
                  <>
                    <Separator className="my-2 border-zinc-700" />
                    {nonCashSummaryRows.map((row) => (
                      <div
                        className="flex justify-between"
                        key={`expected-${row.paymentMethod}`}
                      >
                        <span className="text-zinc-300">
                          {formatPaymentMethodLabel(
                            row.paymentMethod,
                            paymentMethodLabels
                          )}
                        </span>
                        <span className="font-medium text-white tabular-nums">
                          {formatCurrency(row.expectedAmount)}
                        </span>
                      </div>
                    ))}
                  </>
                ) : null}
                {shouldShowSeparatorBeforeTotal ? (
                  <Separator className="my-2 border-zinc-700" />
                ) : null}
                <div className="flex justify-between text-base">
                  <span className="font-semibold text-zinc-200">
                    Total Esperado
                  </span>
                  <span className="font-bold text-[var(--color-voltage)] tabular-nums">
                    {formatCurrency(shiftCloseSummary.totalExpected)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {hasMovementItems ? (
            <div className="rounded-lg border border-zinc-800 bg-[#0a0a0a] p-4">
              <h4 className="mb-3 font-medium text-sm text-zinc-400">
                Detalle de Movimientos
              </h4>
              <div className="space-y-2">
                {movementItems.map((movement) => (
                  <div
                    className="flex items-start justify-between gap-3 rounded-md border border-zinc-800/80 bg-black/20 px-3 py-2"
                    key={`${movement.type}-${movement.paymentMethod}-${movement.createdAt}-${movement.description}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-white">
                        {formatMovementType(movement.type)}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {formatPaymentMethodLabel(
                          movement.paymentMethod,
                          paymentMethodLabels
                        )}
                        {" · "}
                        {movement.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-semibold text-sm tabular-nums ${
                        movement.type === "inflow"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {movement.type === "inflow" ? "+" : "-"}
                      {formatCurrency(movement.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {shiftCloseSummary && (
            <div className="grid gap-3">
              {shiftCloseSummary.summaryByMethod.map((row) => (
                <div className="grid gap-2" key={row.paymentMethod}>
                  <label
                    className="font-medium text-sm text-zinc-300"
                    htmlFor={`closure-${row.paymentMethod}`}
                  >
                    {formatPaymentMethodLabel(
                      row.paymentMethod,
                      paymentMethodLabels
                    )}{" "}
                    (Esperado: {formatCurrency(row.expectedAmount)})
                  </label>
                  <div className="relative">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500">
                      $
                    </span>
                    <Input
                      className="border-zinc-800 bg-[#0a0a0a] pl-7 text-white focus-visible:ring-[var(--color-voltage)]"
                      id={`closure-${row.paymentMethod}`}
                      inputMode="numeric"
                      onChange={(event) =>
                        setClosureAmounts((prev) => ({
                          ...prev,
                          [row.paymentMethod]: sanitizeMoneyInput(
                            event.target.value
                          ),
                        }))
                      }
                      placeholder="0"
                      type="text"
                      value={formatMoneyInput(
                        closureAmounts[row.paymentMethod] ?? ""
                      )}
                    />
                  </div>
                  {closureAmounts[row.paymentMethod] && (
                    <div
                      className={`mt-1 flex items-center justify-between text-sm tabular-nums ${
                        parseMoneyInput(closureAmounts[row.paymentMethod]) -
                          row.expectedAmount ===
                        0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      <span>Diferencia:</span>
                      <span className="font-semibold">
                        {formatCurrency(
                          parseMoneyInput(closureAmounts[row.paymentMethod]) -
                            row.expectedAmount
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2">
            <label
              className="font-medium text-sm text-zinc-300"
              htmlFor={closeShiftNotesId}
            >
              Notas de cierre
            </label>
            <Textarea
              className="min-h-[72px] border-zinc-800 bg-[#0a0a0a] text-white focus-visible:ring-[var(--color-voltage)]"
              id={closeShiftNotesId}
              onChange={(event) => setCloseShiftNotes(event.target.value)}
              placeholder="Opcional: explica diferencias o novedades del cierre"
              value={closeShiftNotes}
            />
          </div>

          {error instanceof Error && (
            <p className="text-red-400 text-sm">{error.message}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            className="text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={onClose}
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            className="border border-red-900/50 bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300"
            disabled={
              !(activeShift && shiftCloseSummary) ||
              hasInvalidAmounts ||
              isLoading ||
              isClosing
            }
            onClick={onConfirm}
          >
            {isClosing ? "Cerrando..." : "Cerrar Turno Definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getInitialClosureAmount(
  actualAmount: number | null | undefined,
  paymentMethod: string,
  expectedAmount: number
): string {
  if (actualAmount != null) {
    return String(actualAmount);
  }
  if (paymentMethod === "cash") {
    return "";
  }
  return String(expectedAmount);
}

function formatMovementType(type: string) {
  const labels: Record<string, string> = {
    inflow: "Ingreso manual",
    expense: "Gasto operativo",
    payout: "Pago a proveedor",
  };

  return labels[type] ?? type;
}
