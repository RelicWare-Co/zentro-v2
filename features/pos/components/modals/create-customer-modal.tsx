import { Button, Group, Modal, Select, TextInput } from "@mantine/core";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";

const DOCUMENT_TYPE_DATA = [
  { value: "CC", label: "CC" },
  { value: "NIT", label: "NIT" },
  { value: "CE", label: "CE" },
  { value: "PAS", label: "Pasaporte" },
];

export function CreateCustomerModal() {
  const { state, actions, meta } = usePosPage();
  const { createCustomerModal } = meta;

  return (
    <Modal
      centered
      onClose={actions.closeActiveModal}
      opened={isPosModalOpen(state.activeModal, "create-customer")}
      title="Crear cliente rápido"
    >
      <div className="space-y-4 py-2">
        <TextInput
          label="Nombre"
          onChange={(event) =>
            createCustomerModal.setNewCustomerName(event.target.value)
          }
          placeholder="Nombre del cliente"
          value={createCustomerModal.newCustomerName}
        />

        <TextInput
          label="Teléfono"
          onChange={(event) =>
            createCustomerModal.setNewCustomerPhone(event.target.value)
          }
          placeholder="Opcional"
          value={createCustomerModal.newCustomerPhone}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            data={DOCUMENT_TYPE_DATA}
            label="Tipo doc"
            onChange={(value) =>
              createCustomerModal.setNewCustomerDocumentType(value ?? "")
            }
            placeholder="Tipo doc"
            value={createCustomerModal.newCustomerDocumentType}
          />

          <TextInput
            label="Número doc"
            onChange={(event) =>
              createCustomerModal.setNewCustomerDocumentNumber(
                event.target.value
              )
            }
            placeholder="Opcional"
            value={createCustomerModal.newCustomerDocumentNumber}
          />
        </div>

        {createCustomerModal.error instanceof Error && (
          <p className="text-red-400 text-sm">
            {createCustomerModal.error.message}
          </p>
        )}
      </div>

      <Group justify="flex-end">
        <Button
          color="gray"
          onClick={actions.closeActiveModal}
          variant="subtle"
        >
          Cancelar
        </Button>
        <Button
          c="black"
          color="voltage.5"
          disabled={!createCustomerModal.canCreateCustomer}
          loading={createCustomerModal.isCreating}
          onClick={actions.confirmCreateCustomer}
        >
          Crear cliente
        </Button>
      </Group>
    </Modal>
  );
}
