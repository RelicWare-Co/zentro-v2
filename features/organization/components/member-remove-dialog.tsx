import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import { useRemoveMemberMutation } from "@/features/organization/hooks/use-organization";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { darkModalStyles } from "@/lib/mantine-dark";
import { getErrorMessage } from "@/lib/utils";

interface MemberRemoveDialogProps {
  member: { memberId: string; name: string } | null;
  onOpenChange: () => void;
  open: boolean;
}

export function MemberRemoveDialog({
  open,
  onOpenChange,
  member,
}: MemberRemoveDialogProps) {
  const { actions } = useOrganizationPage();
  const removeMutation = useRemoveMemberMutation();

  const handleRemove = async () => {
    if (!member) {
      return;
    }
    const target = member.memberId;
    onOpenChange();
    actions.setFeedback(null);
    try {
      await removeMutation.mutateAsync({ memberIdOrEmail: target });
      await actions.refetchManagement();
      actions.setFeedback("Miembro removido.");
    } catch (error) {
      actions.setFeedback(
        getErrorMessage(error, "No se pudo remover al miembro."),
        "error"
      );
    }
  };

  return (
    <Modal
      centered
      onClose={onOpenChange}
      opened={open}
      styles={darkModalStyles}
      title={
        <span className="flex items-center gap-2 font-semibold text-red-200">
          <AlertTriangle className="size-5" />
          Remover miembro
        </span>
      }
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          ¿Seguro que deseas remover a <strong>{member?.name}</strong> de la
          organización?
        </Text>
        <Group justify="flex-end">
          <Button color="gray" onClick={onOpenChange} variant="default">
            Cancelar
          </Button>
          <Button color="red" onClick={handleRemove}>
            Remover
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
