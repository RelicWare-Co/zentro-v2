import { Button, Group, Modal } from "@mantine/core";
import { ArrowRight, CheckCircle, Eye } from "lucide-react";
import { usePosModal } from "@/features/pos/pos-modal-context";
import {
  isPosModalOpen,
  POS_MODAL_IDS,
} from "@/features/pos/pos-page-modals.shared";

export function PostCloseConfirmationModal() {
  const { activeModal, closedShiftId, dismissPostCloseConfirmation } =
    usePosModal();

  const isOpen = isPosModalOpen(
    activeModal,
    POS_MODAL_IDS.POST_CLOSE_CONFIRMATION
  );

  if (!(isOpen && closedShiftId)) {
    return null;
  }

  const summaryUrl = `/shifts?shiftId=${encodeURIComponent(closedShiftId)}`;

  return (
    <Modal
      centered
      onClose={dismissPostCloseConfirmation}
      opened={isOpen}
      size="sm"
      title="Turno cerrado"
    >
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle className="size-8 text-emerald-400" />
        </div>
        <div>
          <p className="font-medium text-lg text-white">
            El turno ha sido cerrado correctamente
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Puedes ver el resumen de productos vendidos y categorías.
          </p>
        </div>
      </div>

      <Group justify="center">
        <Button
          color="gray"
          onClick={dismissPostCloseConfirmation}
          variant="subtle"
        >
          Cerrar
        </Button>
        <Button
          c="black"
          color="voltage.5"
          component="a"
          href={summaryUrl}
          leftSection={<Eye className="size-4" />}
          onClick={dismissPostCloseConfirmation}
        >
          Ver resumen del turno
          <ArrowRight className="ml-1 size-4" />
        </Button>
      </Group>
    </Modal>
  );
}
