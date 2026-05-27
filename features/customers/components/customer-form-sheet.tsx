import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CustomerFormField } from "@/features/customers/components/customers-ui-primitives";
import {
  CUSTOMER_DOCUMENT_TYPE_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  getCustomerFormInitialValue,
} from "@/features/customers/customers-form.shared";
import { useCustomersPage } from "@/features/customers/customers-page-context";
import { getErrorMessage } from "@/lib/utils";

function CustomerFormSheetContent() {
  const { state, actions, meta } = useCustomersPage();
  const [form, setForm] = useState(() =>
    getCustomerFormInitialValue(state.editingCustomer)
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await actions.saveCustomer({
      ...(state.editingCustomer ? { id: state.editingCustomer.id } : {}),
      name: form.name,
      documentType: form.documentType || null,
      documentNumber: form.documentNumber || null,
      phone: form.phone || null,
      email: form.email || null,
      type: form.type || null,
    });
  };

  return (
    <form className="flex h-full flex-col" onSubmit={handleSubmit}>
      <SheetHeader className="shrink-0 border-zinc-800 border-b p-6">
        <SheetTitle className="font-bold text-2xl">
          {state.editingCustomer ? "Editar cliente" : "Crear cliente"}
        </SheetTitle>
        <SheetDescription className="text-zinc-400">
          Datos de contacto e identificación.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid gap-4">
          <CustomerFormField label="Nombre" required>
            <Input
              className="border-zinc-700 bg-black/20"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Ej. Juan Pérez"
              required
              value={form.name}
            />
          </CustomerFormField>
          <CustomerFormField label="Tipo de cliente">
            <Select
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  type: value,
                }))
              }
              value={form.type || "natural"}
            >
              <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                {CUSTOMER_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CustomerFormField>
          <CustomerFormField label="Tipo de documento">
            <Select
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  documentType: value === "none" ? "" : value,
                }))
              }
              value={form.documentType || "none"}
            >
              <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white">
                <SelectValue placeholder="Sin documento" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                <SelectItem value="none">Sin documento</SelectItem>
                {CUSTOMER_DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CustomerFormField>
          <CustomerFormField label="Número de documento">
            <Input
              className="border-zinc-700 bg-black/20"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  documentNumber: event.target.value,
                }))
              }
              placeholder="Ej. 1234567890"
              value={form.documentNumber}
            />
          </CustomerFormField>
          <CustomerFormField label="Teléfono">
            <Input
              className="border-zinc-700 bg-black/20"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              placeholder="Ej. 3001234567"
              type="tel"
              value={form.phone}
            />
          </CustomerFormField>
          <CustomerFormField label="Correo electrónico">
            <Input
              className="border-zinc-700 bg-black/20"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="cliente@ejemplo.com"
              type="email"
              value={form.email}
            />
          </CustomerFormField>
        </div>

        {meta.formError ? (
          <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
            {getErrorMessage(meta.formError, "No se pudo guardar el cliente.")}
          </p>
        ) : null}
      </div>

      <SheetFooter className="shrink-0 border-zinc-800 border-t bg-black/30 p-6">
        <Button
          className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
          disabled={meta.isFormPending || !form.name.trim()}
          type="submit"
        >
          {meta.isFormPending ? "Guardando…" : "Guardar cliente"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export function CustomerFormSheet() {
  const { state, actions } = useCustomersPage();
  const isOpen = state.activeOverlay?.type === "form";

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          actions.closeOverlay();
        }
      }}
      open={isOpen}
    >
      <SheetContent className="!w-full !max-w-full sm:!w-[540px] overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)] p-0 text-white">
        <CustomerFormSheetContent
          key={isOpen ? (state.editingCustomer?.id ?? "new") : "closed"}
        />
      </SheetContent>
    </Sheet>
  );
}
