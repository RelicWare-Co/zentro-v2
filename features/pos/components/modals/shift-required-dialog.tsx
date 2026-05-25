import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";

export function ShiftRequiredDialog() {
  const { state, actions } = usePosPage();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          actions.closeActiveModal();
        }
      }}
      open={isPosModalOpen(state.activeModal, "shift-required")}
    >
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <AlertCircle className="size-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>Turno cerrado</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Debes tener un turno abierto para poder vender productos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
          Abre el turno de caja antes de intentar agregar productos al carrito.
        </div>

        <DialogFooter>
          <Button
            className="text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={actions.closeActiveModal}
            variant="ghost"
          >
            Entendido
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
            onClick={actions.openShiftFromRequired}
          >
            Abrir turno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
