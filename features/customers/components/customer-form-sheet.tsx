import { Button, Drawer, Select, TextInput } from "@mantine/core";
import { type FormEvent, useId, useState } from "react";
import {
  CUSTOMER_DOCUMENT_TYPE_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  getCustomerFormInitialValue,
} from "@/features/customers/customers-form.shared";
import { useCustomersPage } from "@/features/customers/customers-page-context";
import { getErrorMessage } from "@/lib/utils";

const DOCUMENT_TYPE_DATA = [
  { value: "none", label: "Sin documento" },
  ...CUSTOMER_DOCUMENT_TYPE_OPTIONS,
];

function CustomerFormSheetContent() {
  const { state, actions, meta } = useCustomersPage();
  const [form, setForm] = useState(() =>
    getCustomerFormInitialValue(state.editingCustomer)
  );
  const nameId = useId();

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
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <p className="text-sm text-zinc-400">
          Datos de contacto e identificación.
        </p>
        <div className="grid gap-4">
          <TextInput
            id={nameId}
            label="Nombre"
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Ej. Juan Pérez"
            required
            value={form.name}
            withAsterisk
          />
          <Select
            data={CUSTOMER_TYPE_OPTIONS}
            label="Tipo de cliente"
            onChange={(value) =>
              setForm((current) => ({ ...current, type: value ?? "natural" }))
            }
            value={form.type || "natural"}
          />
          <Select
            data={DOCUMENT_TYPE_DATA}
            label="Tipo de documento"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                documentType: !value || value === "none" ? "" : value,
              }))
            }
            placeholder="Sin documento"
            value={form.documentType || "none"}
          />
          <TextInput
            label="Número de documento"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                documentNumber: event.target.value,
              }))
            }
            placeholder="Ej. 1234567890"
            value={form.documentNumber}
          />
          <TextInput
            label="Teléfono"
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            placeholder="Ej. 3001234567"
            type="tel"
            value={form.phone}
          />
          <TextInput
            label="Correo electrónico"
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="cliente@ejemplo.com"
            type="email"
            value={form.email}
          />
        </div>

        {meta.formError ? (
          <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
            {getErrorMessage(meta.formError, "No se pudo guardar el cliente.")}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-zinc-800 border-t bg-black/30 p-6">
        <Button
          c="black"
          color="voltage.5"
          disabled={!form.name.trim()}
          fullWidth
          loading={meta.isFormPending}
          type="submit"
        >
          Guardar cliente
        </Button>
      </div>
    </form>
  );
}

export function CustomerFormSheet() {
  const { state, actions } = useCustomersPage();
  const isOpen = state.activeOverlay?.type === "form";

  return (
    <Drawer
      onClose={actions.closeOverlay}
      opened={isOpen}
      position="right"
      size={540}
      title={state.editingCustomer ? "Editar cliente" : "Crear cliente"}
    >
      <CustomerFormSheetContent
        key={isOpen ? (state.editingCustomer?.id ?? "new") : "closed"}
      />
    </Drawer>
  );
}
