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
import { Textarea } from "@/components/ui/textarea";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

interface OpenShiftModalProps {
  canOpenShift: boolean;
  error: Error | null;
  isOpen: boolean;
  isOpening: boolean;
  onClose: () => void;
  onConfirm: () => void;
  openShiftNotes: string;
  setOpenShiftNotes: (value: string) => void;
  setStartingCash: (value: string) => void;
  startingCash: string;
}

export function OpenShiftModal({
  isOpen,
  onClose,
  startingCash,
  setStartingCash,
  openShiftNotes,
  setOpenShiftNotes,
  canOpenShift,
  isOpening,
  error,
  onConfirm,
}: OpenShiftModalProps) {
  const startingCashId = useId();
  const openShiftNotesId = useId();

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Apertura de Turno</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="mb-4 text-sm text-zinc-400">
            Ingresa la base de efectivo inicial en la caja para comenzar a
            operar.
          </p>

          <div className="grid gap-2">
            <label
              className="font-medium text-sm text-zinc-300"
              htmlFor={startingCashId}
            >
              Base en Efectivo
            </label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500">
                $
              </span>
              <Input
                className="h-12 border-zinc-800 bg-[#0a0a0a] pl-7 text-lg text-white focus-visible:ring-[var(--color-voltage)]"
                id={startingCashId}
                inputMode="numeric"
                onChange={(e) =>
                  setStartingCash(sanitizeMoneyInput(e.target.value))
                }
                placeholder="0"
                type="text"
                value={formatMoneyInput(startingCash)}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <label
              className="font-medium text-sm text-zinc-300"
              htmlFor={openShiftNotesId}
            >
              Notas del turno
            </label>
            <Textarea
              className="min-h-[72px] border-zinc-800 bg-[#0a0a0a] text-white focus-visible:ring-[var(--color-voltage)]"
              id={openShiftNotesId}
              onChange={(event) => setOpenShiftNotes(event.target.value)}
              placeholder="Opcional: observaciones de apertura"
              value={openShiftNotes}
            />
          </div>

          {error instanceof Error && (
            <p className="mt-3 text-red-400 text-sm">{error.message}</p>
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
            disabled={!canOpenShift || isOpening}
            onClick={onConfirm}
          >
            {isOpening ? "Abriendo..." : "Abrir Turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
