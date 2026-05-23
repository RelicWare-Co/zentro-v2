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
import type { CashMovementType } from "@/features/pos/types";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

interface CashMovementModalProps {
  canRegister: boolean;
  error: Error | null;
  hasActiveShift: boolean;
  isOpen: boolean;
  isRegistering: boolean;
  movementAmount: string;
  movementDescription: string;
  movementPaymentMethod: string;
  movementType: string;
  onClose: () => void;
  onConfirm: () => void;
  paymentMethodOptions: Array<{ id: string; label: string }>;
  setMovementAmount: (value: string) => void;
  setMovementDescription: (value: string) => void;
  setMovementPaymentMethod: (value: string) => void;
  setMovementType: (value: CashMovementType) => void;
}

export function CashMovementModal({
  isOpen,
  onClose,
  movementType,
  setMovementType,
  movementPaymentMethod,
  setMovementPaymentMethod,
  paymentMethodOptions,
  movementAmount,
  setMovementAmount,
  movementDescription,
  setMovementDescription,
  canRegister,
  isRegistering,
  hasActiveShift,
  error,
  onConfirm,
}: CashMovementModalProps) {
  const movementTypeId = useId();
  const movementPaymentMethodId = useId();
  const movementAmountId = useId();
  const movementDescriptionId = useId();

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Movimiento del Turno</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!hasActiveShift && (
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
                setMovementType(value as CashMovementType)
              }
              value={movementType}
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
              onValueChange={setMovementPaymentMethod}
              value={movementPaymentMethod}
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
                setMovementAmount(sanitizeMoneyInput(e.target.value))
              }
              placeholder="0"
              type="text"
              value={formatMoneyInput(movementAmount)}
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
              onChange={(e) => setMovementDescription(e.target.value)}
              placeholder="Ej. Pago de internet, Base adicional..."
              value={movementDescription}
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
            className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
            disabled={!canRegister || isRegistering}
            onClick={onConfirm}
          >
            {isRegistering ? "Registrando..." : "Registrar Movimiento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
