import { Button, Group, Modal } from "@mantine/core";
import { AlertCircle } from "lucide-react";
import { usePosPage } from "@/features/pos/pos-page-context";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";
import { darkModalStyles } from "@/lib/mantine-dark";

export function ShiftRequiredDialog() {
  const { state, actions } = usePosPage();

  return (
    <Modal
      centered
      onClose={actions.closeActiveModal}
      opened={isPosModalOpen(state.activeModal, "shift-required")}
      size="md"
      styles={darkModalStyles}
      title={
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
            <AlertCircle className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Turno cerrado</p>
            <p className="text-sm text-zinc-400">
              Debes tener un turno abierto para poder vender productos.
            </p>
          </div>
        </div>
      }
    >
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
        Abre el turno de caja antes de intentar agregar productos al carrito.
      </div>

      <Group justify="flex-end" mt="lg">
        <Button
          color="gray"
          onClick={actions.closeActiveModal}
          variant="subtle"
        >
          Entendido
        </Button>
        <Button
          c="black"
          color="voltage.5"
          onClick={actions.openShiftFromRequired}
        >
          Abrir turno
        </Button>
      </Group>
    </Modal>
  );
}
