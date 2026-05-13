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

interface CreateCustomerModalProps {
  canCreate: boolean;
  documentNumber: string;
  documentType: string;
  error: Error | null;
  isCreating: boolean;
  isOpen: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
  phone: string;
  setDocumentNumber: (value: string) => void;
  setDocumentType: (value: string) => void;
  setName: (value: string) => void;
  setPhone: (value: string) => void;
}

export function CreateCustomerModal({
  isOpen,
  onClose,
  name,
  setName,
  phone,
  setPhone,
  documentType,
  setDocumentType,
  documentNumber,
  setDocumentNumber,
  canCreate,
  isCreating,
  error,
  onConfirm,
}: CreateCustomerModalProps) {
  const customerNameId = useId();
  const customerPhoneId = useId();
  const customerDocumentTypeId = useId();
  const customerDocumentNumberId = useId();

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
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
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del cliente"
              value={name}
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
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Opcional"
              value={phone}
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
              <Select onValueChange={setDocumentType} value={documentType}>
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
                onChange={(event) => setDocumentNumber(event.target.value)}
                placeholder="Opcional"
                value={documentNumber}
              />
            </div>
          </div>

          {error instanceof Error && (
            <p className="text-red-400 text-sm">{error.message}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            className="text-zinc-400 hover:text-white"
            onClick={onClose}
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
            disabled={!canCreate || isCreating}
            onClick={onConfirm}
          >
            {isCreating ? "Creando..." : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
