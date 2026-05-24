import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosPage } from "@/features/pos/pos-page-context";
import { formatCurrency } from "@/features/pos/utils";

export function ModifierModal() {
  const { state, actions } = usePosPage();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          actions.closeModifierModal();
        }
      }}
      open={state.isModifierModalOpen}
    >
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Añadir modificadores · {state.selectedProductForModifiers?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {state.modifierProducts.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No hay modificadores configurados para este negocio.
            </p>
          ) : (
            state.modifierProducts.map((modifierProduct) => (
              <div
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#0a0a0a] p-3"
                key={modifierProduct.id}
              >
                <div>
                  <p className="font-medium text-sm text-white">
                    {modifierProduct.name}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {formatCurrency(modifierProduct.price)} c/u
                  </p>
                </div>
                <div className="flex items-center rounded-md border border-zinc-800/80 bg-black/50">
                  <button
                    className="flex size-8 items-center justify-center rounded-l-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                    onClick={() =>
                      actions.updateModifierQuantity(modifierProduct.id, -1)
                    }
                    type="button"
                  >
                    <Minus className="size-3" />
                  </button>
                  <div className="w-9 text-center font-semibold text-sm text-white">
                    {state.modifierQuantities[modifierProduct.id] ?? 0}
                  </div>
                  <button
                    className="flex size-8 items-center justify-center rounded-r-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                    onClick={() =>
                      actions.updateModifierQuantity(modifierProduct.id, 1)
                    }
                    type="button"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            className="text-zinc-300 hover:text-white"
            onClick={actions.quickAddWithoutModifiers}
            variant="ghost"
          >
            Agregar sin modificadores
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
            onClick={actions.confirmModifiers}
          >
            Confirmar selección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
