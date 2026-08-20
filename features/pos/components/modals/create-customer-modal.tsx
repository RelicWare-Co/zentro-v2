import {
  Button,
  Divider,
  Group,
  Modal,
  Select,
  TextInput,
} from "@mantine/core";
import { AlertCircle, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { usePosPage } from "@/features/pos/pos-page-context";
import {
  isPosModalOpen,
  POS_MODAL_IDS,
} from "@/features/pos/pos-page-modals.shared";

const DOCUMENT_TYPE_DATA = [
  { value: "CC", label: "CC" },
  { value: "NIT", label: "NIT" },
  { value: "CE", label: "CE" },
  { value: "PAS", label: "Pasaporte" },
];

export function CreateCustomerModal() {
  const { state, actions, meta } = usePosPage();
  const { createCustomerModal } = meta;

  const isOpen = isPosModalOpen(
    state.activeModal,
    POS_MODAL_IDS.CREATE_CUSTOMER
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createCustomerModal.canCreateCustomer) {
      return;
    }
    actions.confirmCreateCustomer();
  };

  return (
    <Modal
      centered
      onClose={actions.closeActiveModal}
      opened={isOpen}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }}
      radius="lg"
      size={420}
      title={
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300">
            <UserPlus className="size-4" />
          </span>
          <div className="leading-none">
            <div className="font-semibold text-white">Nuevo cliente</div>
            <div className="mt-1 font-normal text-xs text-zinc-400">
              Se asignará a la venta actual
            </div>
          </div>
        </div>
      }
    >
      <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
        <TextInput
          autoComplete="name"
          data-autofocus
          label="Nombre"
          onChange={(event) =>
            createCustomerModal.setNewCustomerName(event.target.value)
          }
          placeholder="Ej. Juan Pérez"
          required
          value={createCustomerModal.newCustomerName}
          withAsterisk
        />

        <TextInput
          autoComplete="tel"
          label="Teléfono"
          onChange={(event) =>
            createCustomerModal.setNewCustomerPhone(event.target.value)
          }
          placeholder="Opcional"
          type="tel"
          value={createCustomerModal.newCustomerPhone}
        />

        <Divider color="dark.4" />

        <div className="space-y-2.5">
          <p className="font-medium text-xs text-zinc-500 uppercase tracking-widest">
            Documento — opcional
          </p>
          <div className="grid grid-cols-[112px_1fr] gap-3">
            <Select
              aria-label="Tipo de documento"
              data={DOCUMENT_TYPE_DATA}
              onChange={(value) =>
                createCustomerModal.setNewCustomerDocumentType(value ?? "")
              }
              placeholder="Tipo"
              value={createCustomerModal.newCustomerDocumentType || null}
            />
            <TextInput
              aria-label="Número de documento"
              onChange={(event) =>
                createCustomerModal.setNewCustomerDocumentNumber(
                  event.target.value
                )
              }
              placeholder="Número"
              value={createCustomerModal.newCustomerDocumentNumber}
            />
          </div>
        </div>

        {createCustomerModal.error instanceof Error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="size-4 shrink-0" />
            {createCustomerModal.error.message}
          </div>
        )}

        <Group justify="flex-end" mt="xs">
          <Button onClick={actions.closeActiveModal} variant="subtle">
            Cancelar
          </Button>
          <Button
            c="black"
            color="voltage.5"
            disabled={!createCustomerModal.canCreateCustomer}
            loading={createCustomerModal.isCreating}
            type="submit"
          >
            Crear cliente
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
