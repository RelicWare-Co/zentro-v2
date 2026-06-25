import {
  Button,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type FormEvent, useState } from "react";
import type { AdminPanelUser } from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import { getErrorMessage } from "@/lib/utils";

function AdminPasswordDialogContent({ user }: { user: AdminPanelUser }) {
  const { actions } = useAdminPage();
  const adminActions = useAdminUserActions();
  const [newPassword, setNewPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await adminActions.setUserPassword.mutateAsync({
        userId: user.id,
        newPassword,
      });
      notifications.show({
        message: `Contraseña de ${user.name} actualizada.`,
        color: "green",
      });
      actions.closeOverlay();
    } catch (error) {
      notifications.show({
        message: getErrorMessage(error, "No se pudo cambiar la contraseña."),
        color: "red",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          Define una nueva contraseña para {user.name}. Sus sesiones activas no
          se cierran automáticamente.
        </Text>
        <PasswordInput
          label="Nueva contraseña"
          minLength={8}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
          value={newPassword}
        />
        <Group justify="flex-end">
          <Button
            color="gray"
            onClick={actions.closeOverlay}
            type="button"
            variant="default"
          >
            Cancelar
          </Button>
          <Button
            c="black"
            color="voltage.5"
            disabled={!newPassword}
            loading={adminActions.setUserPassword.isPending}
            type="submit"
          >
            {adminActions.setUserPassword.isPending
              ? "Guardando…"
              : "Guardar contraseña"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function AdminPasswordDialog() {
  const { state, actions } = useAdminPage();
  const isOpen = state.activeOverlay?.type === "password";
  const user =
    state.activeOverlay?.type === "password" ? state.activeOverlay.user : null;

  return (
    <Modal
      centered
      onClose={actions.closeOverlay}
      opened={isOpen}
      title="Cambiar contraseña"
    >
      {user ? <AdminPasswordDialogContent key={user.id} user={user} /> : null}
    </Modal>
  );
}
