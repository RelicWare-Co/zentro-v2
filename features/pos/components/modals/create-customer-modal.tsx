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
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";

export function CreateCustomerModal() {
  const { state, actions, meta } = usePosPage();
  const { createCustomerModal } = meta;
  const customerNameId = useId();
  const customerPhoneId = useId();
  const customerDocumentTypeId = useId();
  const customerDocumentNumberId = useId();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          actions.closeActiveModal();
        }
      }}
      open={isPosModalOpen(state.activeModal, "create-customer")}
    >
      <DialogContent className="border-zinc-800 bg-[#151515] text-white sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Crear cliente rápido</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <label
              className="font-medium text-sm text-zinc-300"
              htmlFor={customerNameId}
            >
              Nombre
            </label>
            <Input
              className="border-zinc-800 bg-[#0a0a0a] text-white"
              id={customerNameId}
              onChange={(event) =>
                createCustomerModal.setNewCustomerName(event.target.value)
              }
              placeholder="Nombre del cliente"
              value={createCustomerModal.newCustomerName}
            />
          </div>

          <div className="grid gap-2">
            <label
              className="font-medium text-sm text-zinc-300"
              htmlFor={customerPhoneId}
            >
              Teléfono
            </label>
            <Input
              className="border-zinc-800 bg-[#0a0a0a] text-white"
              id={customerPhoneId}
              onChange={(event) =>
                createCustomerModal.setNewCustomerPhone(event.target.value)
              }
              placeholder="Opcional"
              value={createCustomerModal.newCustomerPhone}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label
                className="font-medium text-sm text-zinc-300"
                htmlFor={customerDocumentTypeId}
              >
                Tipo doc
              </label>
              <Select
                onValueChange={createCustomerModal.setNewCustomerDocumentType}
                value={createCustomerModal.newCustomerDocumentType}
              >
                <SelectTrigger
                  className="h-10 w-full rounded-md border border-zinc-800 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--color-voltage)]"
                  id={customerDocumentTypeId}
                >
                  <SelectValue placeholder="Tipo doc" />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-[#0a0a0a] text-white">
                  <SelectItem value="CC">CC</SelectItem>
                  <SelectItem value="NIT">NIT</SelectItem>
                  <SelectItem value="CE">CE</SelectItem>
                  <SelectItem value="PAS">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label
                className="font-medium text-sm text-zinc-300"
                htmlFor={customerDocumentNumberId}
              >
                Número doc
              </label>
              <Input
                className="border-zinc-800 bg-[#0a0a0a] text-white"
                id={customerDocumentNumberId}
                onChange={(event) =>
                  createCustomerModal.setNewCustomerDocumentNumber(
                    event.target.value
                  )
                }
                placeholder="Opcional"
                value={createCustomerModal.newCustomerDocumentNumber}
              />
            </div>
          </div>

          {createCustomerModal.error instanceof Error && (
            <p className="text-red-400 text-sm">
              {createCustomerModal.error.message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            className="text-zinc-400 hover:text-white"
            onClick={actions.closeActiveModal}
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
            disabled={
              !createCustomerModal.canCreateCustomer ||
              createCustomerModal.isCreating
            }
            onClick={actions.confirmCreateCustomer}
          >
            {createCustomerModal.isCreating ? "Creando..." : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
