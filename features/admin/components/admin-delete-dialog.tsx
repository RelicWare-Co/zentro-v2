import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { toast } from "sonner";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import { getErrorMessage } from "@/lib/utils";

export function AdminDeleteDialog() {
  const { state, actions } = useAdminPage();
  const adminActions = useAdminUserActions();
  const isOpen = state.activeOverlay?.type === "delete";
  const user =
    state.activeOverlay?.type === "delete" ? state.activeOverlay.user : null;

  const handleConfirm = async () => {
    if (!user) {
      return;
    }
    try {
      await adminActions.removeUser.mutateAsync({ userId: user.id });
      toast.success(`${user.name} fue eliminado.`);
      actions.closeOverlay();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el usuario."));
    }
  };

  return (
    <Modal
      centered
      onClose={actions.closeOverlay}
      opened={isOpen}
      title="¿Eliminar usuario?"
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          {user?.name} ({user?.email}) se eliminará de forma permanente junto
          con sus sesiones y cuentas vinculadas. Esta acción no se puede
          deshacer.
        </Text>
        <Group justify="flex-end">
          <Button color="gray" onClick={actions.closeOverlay} variant="default">
            Cancelar
          </Button>
          <Button
            color="red"
            loading={adminActions.removeUser.isPending}
            onClick={() => {
              handleConfirm().catch(() => undefined);
            }}
          >
            {adminActions.removeUser.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
