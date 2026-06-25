import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import { useCancelInvitationMutation } from "@/features/organization/hooks/use-organization";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { getErrorMessage } from "@/lib/utils";

interface InvitationCancelDialogProps {
  invitationId: string | null;
  onOpenChange: () => void;
  open: boolean;
}

export function InvitationCancelDialog({
  open,
  onOpenChange,
  invitationId,
}: InvitationCancelDialogProps) {
  const { actions } = useOrganizationPage();
  const cancelMutation = useCancelInvitationMutation();

  const handleCancel = async () => {
    if (!invitationId) {
      return;
    }
    const id = invitationId;
    onOpenChange();
    actions.setFeedback(null);
    try {
      await cancelMutation.mutateAsync({ invitationId: id });
      await actions.refetchManagement();
      actions.setFeedback("Invitación cancelada.");
    } catch (error) {
      actions.setFeedback(
        getErrorMessage(error, "No se pudo cancelar la invitación."),
        "error"
      );
    }
  };

  return (
    <Modal
      centered
      onClose={onOpenChange}
      opened={open}
      title={
        <span className="flex items-center gap-2 font-semibold text-red-200">
          <AlertTriangle className="size-5" />
          Cancelar invitación
        </span>
      }
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          La invitación será cancelada y el destinatario no podrá aceptarla.
        </Text>
        <Group justify="flex-end">
          <Button color="gray" onClick={onOpenChange} variant="default">
            Volver
          </Button>
          <Button color="red" onClick={handleCancel}>
            Cancelar Invitación
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
