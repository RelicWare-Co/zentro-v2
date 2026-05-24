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
import { usePosPage } from "@/features/pos/pos-page-context";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

export function OpenShiftModal() {
  const { state, actions, meta } = usePosPage();
  const { shift } = meta;
  const startingCashId = useId();
  const openShiftNotesId = useId();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          actions.closeShiftModal();
        }
      }}
      open={state.isShiftOpenModalOpen}
    >
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
                  shift.setStartingCash(sanitizeMoneyInput(e.target.value))
                }
                placeholder="0"
                type="text"
                value={formatMoneyInput(shift.startingCash)}
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
              onChange={(event) => shift.setOpenShiftNotes(event.target.value)}
              placeholder="Opcional: observaciones de apertura"
              value={shift.openShiftNotes}
            />
          </div>

          {shift.openShiftError instanceof Error && (
            <p className="mt-3 text-red-400 text-sm">
              {shift.openShiftError.message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            className="text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={actions.closeShiftModal}
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
            disabled={!shift.canOpenShift || shift.isOpeningShift}
            onClick={actions.confirmOpenShift}
          >
            {shift.isOpeningShift ? "Abriendo..." : "Abrir Turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
