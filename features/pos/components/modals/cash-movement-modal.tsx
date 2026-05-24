import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePosPage } from "@/features/pos/pos-page-context";
import type { CashMovementType } from "@/features/pos/types";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

export function CashMovementModal() {
  const { state, actions, meta } = usePosPage();
  const { shift, paymentMethodOptions } = meta;
  const movementTypeId = useId();
  const movementPaymentMethodId = useId();
  const movementAmountId = useId();
  const movementDescriptionId = useId();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          actions.closeCashMovementModal();
        }
      }}
      open={state.isCashMovementModalOpen}
    >
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Movimiento del Turno</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!state.activeShift && (
            <p className="text-red-400 text-sm">
              Debes abrir un turno antes de registrar movimientos.
            </p>
          )}

          <div className="grid gap-2">
            <label
              className="font-medium text-sm text-zinc-300"
              htmlFor={movementTypeId}
            >
              Tipo de Movimiento
            </label>
            <Select
              onValueChange={(value) =>
                shift.setMovementType(value as CashMovementType)
              }
              value={shift.movementType}
            >
              <SelectTrigger
                className="h-10 w-full rounded-md border border-zinc-800 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--color-voltage)]"
                id={movementTypeId}
              >
                <SelectValue placeholder="Tipo de Movimiento" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[#0a0a0a] text-white">
                <SelectItem value="inflow">Ingreso (Entrada manual)</SelectItem>
                <SelectItem value="expense">Gasto Operativo</SelectItem>
                <SelectItem value="payout">Pago a Proveedor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label
              className="font-medium text-sm text-zinc-300"
              htmlFor={movementPaymentMethodId}
            >
              Método Afectado
            </label>
            <Select
              onValueChange={shift.setMovementPaymentMethod}
              value={shift.movementPaymentMethod}
            >
              <SelectTrigger
                className="h-10 w-full rounded-md border border-zinc-800 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--color-voltage)]"
                id={movementPaymentMethodId}
              >
                <SelectValue placeholder="Método de Pago" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[#0a0a0a] text-white">
                {paymentMethodOptions.map((paymentMethod) => (
                  <SelectItem key={paymentMethod.id} value={paymentMethod.id}>
                    {paymentMethod.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label
              className="font-medium text-sm text-zinc-300"
              htmlFor={movementAmountId}
            >
              Monto
            </label>
            <Input
              className="border-zinc-800 bg-[#0a0a0a] text-white focus-visible:ring-[var(--color-voltage)]"
              id={movementAmountId}
              inputMode="numeric"
              onChange={(e) =>
                shift.setMovementAmount(sanitizeMoneyInput(e.target.value))
              }
              placeholder="0"
              type="text"
              value={formatMoneyInput(shift.movementAmount)}
            />
          </div>

          <div className="grid gap-2">
            <label
              className="font-medium text-sm text-zinc-300"
              htmlFor={movementDescriptionId}
            >
              Descripción
            </label>
            <Input
              className="border-zinc-800 bg-[#0a0a0a] text-white focus-visible:ring-[var(--color-voltage)]"
              id={movementDescriptionId}
              onChange={(e) => shift.setMovementDescription(e.target.value)}
              placeholder="Ej. Pago de internet, Base adicional..."
              value={shift.movementDescription}
            />
          </div>

          {shift.cashMovementError instanceof Error && (
            <p className="text-red-400 text-sm">
              {shift.cashMovementError.message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            className="text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={actions.closeCashMovementModal}
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
            disabled={
              !shift.canRegisterCashMovement || shift.isRegisteringMovement
            }
            onClick={actions.confirmCashMovement}
          >
            {shift.isRegisteringMovement
              ? "Registrando..."
              : "Registrar Movimiento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
