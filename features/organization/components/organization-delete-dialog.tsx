import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import { useDeleteOrganizationMutation } from "@/features/organization/hooks/use-organization";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { useOrganizationTransition } from "@/features/organization/organization-transition-context";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";

interface OrganizationDeleteDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function OrganizationDeleteDialog({
  open,
  onOpenChange,
}: OrganizationDeleteDialogProps) {
  const { state, actions } = useOrganizationPage();
  const data = state.data;
  const deleteMutation = useDeleteOrganizationMutation();
  const { runOrganizationTransition } = useOrganizationTransition();

  const handleDelete = async () => {
    if (!data) {
      return;
    }
    onOpenChange(false);
    actions.setFeedback(null);
    try {
      await deleteMutation.mutateAsync({
        organizationId: data.organization.id,
      });
      await runOrganizationTransition({
        destination: "/organization",
        message: "Organización eliminada. Abriendo selector...",
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
        getErrorMessage(error, "No se pudo eliminar la organización."),
        "error"
      );
    }
  };

  return (
    <Modal
      centered
      onClose={() => onOpenChange(false)}
      opened={open}
      title={
        <span className="flex items-center gap-2 font-semibold text-red-200">
          <AlertTriangle className="size-5" />
          ¿Eliminar organización?
        </span>
      }
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          Esta acción no se puede deshacer. Todos los datos asociados
          (productos, ventas, miembros) serán eliminados.
        </Text>
        <Group justify="flex-end">
          <Button
            color="gray"
            onClick={() => onOpenChange(false)}
            variant="default"
          >
            Cancelar
          </Button>
          <Button color="red" onClick={handleDelete}>
            Eliminar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
