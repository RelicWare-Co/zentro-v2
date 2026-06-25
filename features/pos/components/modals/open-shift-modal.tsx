import { Button, Group, Modal, Textarea, TextInput } from "@mantine/core";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

export function OpenShiftModal() {
  const { state, actions, meta } = usePosPage();
  const { shift } = meta;

  return (
    <Modal
      centered
      onClose={actions.closeActiveModal}
      opened={isPosModalOpen(state.activeModal, "open-shift")}
      title="Apertura de Turno"
    >
      <div className="py-2">
        <p className="mb-4 text-sm text-zinc-400">
          Ingresa la base de efectivo inicial en la caja para comenzar a operar.
        </p>

        <TextInput
          inputMode="numeric"
          label="Base en Efectivo"
          leftSection={<span className="text-zinc-500">$</span>}
          onChange={(e) =>
            shift.setStartingCash(sanitizeMoneyInput(e.target.value))
          }
          placeholder="0"
          type="text"
          value={formatMoneyInput(shift.startingCash)}
        />

        <Textarea
          className="mt-4"
          label="Notas del turno"
          minRows={3}
          onChange={(event) => shift.setOpenShiftNotes(event.target.value)}
          placeholder="Opcional: observaciones de apertura"
          value={shift.openShiftNotes}
        />

        {shift.openShiftError instanceof Error && (
          <p className="mt-3 text-red-400 text-sm">
            {shift.openShiftError.message}
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
          disabled={!shift.canOpenShift}
          loading={shift.isOpeningShift}
          onClick={actions.confirmOpenShift}
        >
          Abrir Turno
        </Button>
      </Group>
    </Modal>
  );
}
