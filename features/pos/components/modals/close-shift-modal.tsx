import {
  Button,
  Divider,
  Group,
  Modal,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useEffect, useId } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";
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

export function CloseShiftModal() {
  const { state, actions, meta } = usePosPage();
  const { shift } = meta;
  const closeShiftNotesId = useId();
  const { shiftCloseSummary, setClosureAmounts } = shift;

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

  const cashSummary = shift.shiftCloseSummary?.summaryByMethod.find(
    (row) => row.paymentMethod === "cash"
  );
  const paymentMethodLabels = createPaymentMethodLabelMap(
    shift.shiftCloseSummary?.paymentMethods ?? []
  );
  const movementSummary = shift.shiftCloseSummary?.movements;
  const movementItems = movementSummary?.items ?? [];
  const nonCashSummaryRows =
    shift.shiftCloseSummary?.summaryByMethod.filter(
      (row) => row.paymentMethod !== "cash"
    ) ?? [];
  const hasMovementItems = movementItems.length > 0;
  const shouldShowSeparatorBeforeTotal =
    hasMovementItems || nonCashSummaryRows.length > 0;

  return (
    <Modal
      centered
      onClose={actions.closeActiveModal}
      opened={isPosModalOpen(state.activeModal, "close-shift")}
      size="lg"
      title="Cierre de Turno"
    >
      <div className="space-y-6 py-2">
        <div className="rounded-lg border border-zinc-800 bg-[#0a0a0a] p-4">
          <h4 className="mb-3 font-medium text-sm text-zinc-400">
            Resumen del Sistema
          </h4>
          {shift.isShiftSummaryFetching && (
            <p className="text-sm text-zinc-400">Cargando resumen…</p>
          )}
          {shift.shiftCloseSummary && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-300">Base inicial</span>
                <span className="font-medium text-white tabular-nums">
                  {formatCurrency(shift.shiftCloseSummary.shift.startingCash)}
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
                  <Divider color="dark.4" my="xs" />
                  <div className="space-y-2">
                    <p className="font-semibold text-xs text-zinc-500 uppercase tracking-[0.18em]">
                      Movimientos de caja
                    </p>
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Ingresos manuales</span>
                      <span className="font-medium text-emerald-400 tabular-nums">
                        +
                        {formatCurrency(
                          shift.shiftCloseSummary.movements.totals.inflow
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Gastos operativos</span>
                      <span className="font-medium text-red-400 tabular-nums">
                        -
                        {formatCurrency(
                          shift.shiftCloseSummary.movements.totals.expense
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Pagos a proveedor</span>
                      <span className="font-medium text-red-400 tabular-nums">
                        -
                        {formatCurrency(
                          shift.shiftCloseSummary.movements.totals.payout
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Ajuste neto</span>
                      <span
                        className={`font-medium tabular-nums ${
                          shift.shiftCloseSummary.movements.totals.net >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {shift.shiftCloseSummary.movements.totals.net >= 0
                          ? "+"
                          : ""}
                        {formatCurrency(
                          shift.shiftCloseSummary.movements.totals.net
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
                  <Divider color="dark.4" my="xs" />
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
                <Divider color="dark.4" my="xs" />
              ) : null}
              <div className="flex justify-between text-base">
                <span className="font-semibold text-zinc-200">
                  Total Esperado
                </span>
                <span className="font-bold text-[var(--color-voltage)] tabular-nums">
                  {formatCurrency(shift.shiftCloseSummary.totalExpected)}
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

        {shift.shiftCloseSummary && (
          <div className="grid gap-3">
            {shift.shiftCloseSummary.summaryByMethod.map((row) => (
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
                <TextInput
                  id={`closure-${row.paymentMethod}`}
                  inputMode="numeric"
                  leftSection={<span className="text-zinc-500">$</span>}
                  onChange={(event) =>
                    shift.setClosureAmounts((prev) => ({
                      ...prev,
                      [row.paymentMethod]: sanitizeMoneyInput(
                        event.target.value
                      ),
                    }))
                  }
                  placeholder="0"
                  type="text"
                  value={formatMoneyInput(
                    shift.closureAmounts[row.paymentMethod] ?? ""
                  )}
                />
                {shift.closureAmounts[row.paymentMethod] && (
                  <div
                    className={`mt-1 flex items-center justify-between text-sm tabular-nums ${
                      parseMoneyInput(shift.closureAmounts[row.paymentMethod]) -
                        row.expectedAmount ===
                      0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    <span>Diferencia:</span>
                    <span className="font-semibold">
                      {formatCurrency(
                        parseMoneyInput(
                          shift.closureAmounts[row.paymentMethod]
                        ) - row.expectedAmount
                      )}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Textarea
          id={closeShiftNotesId}
          label="Notas de cierre"
          minRows={3}
          onChange={(event) => shift.setCloseShiftNotes(event.target.value)}
          placeholder="Opcional: explica diferencias o novedades del cierre"
          value={shift.closeShiftNotes}
        />

        {shift.closeShiftError instanceof Error && (
          <p className="text-red-400 text-sm">
            {shift.closeShiftError.message}
          </p>
        )}
      </div>

      <Group justify="flex-end">
        <Button
          color="gray"
          onClick={actions.closeActiveModal}
          variant="subtle"
        >
          Cancelar
        </Button>
        <Button
          className="border border-red-900/50 bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300"
          disabled={
            !(state.activeShift && shift.shiftCloseSummary) ||
            shift.hasInvalidCloseAmounts ||
            shift.isShiftSummaryFetching
          }
          loading={shift.isClosingShift}
          onClick={actions.confirmCloseShift}
        >
          Cerrar Turno Definitivamente
        </Button>
      </Group>
    </Modal>
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
