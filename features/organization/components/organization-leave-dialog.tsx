import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import { useLeaveOrganizationMutation } from "@/features/organization/hooks/use-organization";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { useOrganizationTransition } from "@/features/organization/organization-transition-context";
import { authClient } from "@/lib/auth-client";
import { darkModalStyles } from "@/lib/mantine-dark";
import { getErrorMessage } from "@/lib/utils";

interface OrganizationLeaveDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function OrganizationLeaveDialog({
  open,
  onOpenChange,
}: OrganizationLeaveDialogProps) {
  const { state, actions } = useOrganizationPage();
  const data = state.data;
  const leaveMutation = useLeaveOrganizationMutation();
  const { runOrganizationTransition } = useOrganizationTransition();

  const handleLeave = async () => {
    if (!data) {
      return;
    }
    onOpenChange(false);
    actions.setFeedback(null);
    try {
      await leaveMutation.mutateAsync({
        organizationId: data.organization.id,
      });
      await runOrganizationTransition({
        destination: "/organization",
        message: "Saliste de la organización. Abriendo selector...",
        prepare: async () => {
          const result = await authClient.organization.setActive({
            organizationId: null,
          });
          if (result?.error) {
            throw new Error(
              result.error.message ||
                "No se pudo abrir el selector de organización."
            );
          }
        },
      });
    } catch (error) {
      actions.setFeedback(
        getErrorMessage(error, "No se pudo salir de la organización."),
        "error"
      );
    }
  };

  return (
    <Modal
      centered
      onClose={() => onOpenChange(false)}
      opened={open}
      styles={darkModalStyles}
      title={
        <span className="flex items-center gap-2 font-semibold text-amber-200">
          <AlertTriangle className="size-5" />
          ¿Salir de la organización?
        </span>
      }
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          Perderás acceso a todos los datos de{" "}
          <strong>{data?.organization.name}</strong>. Esta acción no se puede
          deshacer.
        </Text>
        <Group justify="flex-end">
          <Button
            color="gray"
            onClick={() => onOpenChange(false)}
            variant="default"
          >
            Cancelar
          </Button>
          <Button color="yellow" onClick={handleLeave}>
            Salir
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
