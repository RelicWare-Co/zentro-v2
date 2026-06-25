import { Button, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import {
  ADMIN_ROLE_OPTIONS,
  type AdminPanelUser,
  type AdminRoleValue,
  isAdminUser,
} from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import { getErrorMessage } from "@/lib/utils";

function AdminRoleDialogContent({ user }: { user: AdminPanelUser }) {
  const { actions } = useAdminPage();
  const adminActions = useAdminUserActions();
  const [role, setRole] = useState<AdminRoleValue>(
    isAdminUser(user) ? "admin" : "user"
  );

  const handleSubmit = async () => {
    try {
      await adminActions.setRole.mutateAsync({ userId: user.id, role });
      notifications.show({
        message: `Rol de ${user.name} actualizado.`,
        color: "green",
      });
      actions.closeOverlay();
    } catch (error) {
      notifications.show({
        message: getErrorMessage(error, "No se pudo cambiar el rol."),
        color: "red",
      });
    }
  };

  return (
    <Stack gap="md">
      <Text c="dimmed" size="sm">
        Define el rol de plataforma de {user.name}. Los administradores tienen
        control total sobre los usuarios.
      </Text>
      <Select
        allowDeselect={false}
        aria-label="Rol del usuario"
        data={ADMIN_ROLE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        onChange={(value) => setRole((value ?? "user") as AdminRoleValue)}
        value={role}
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
          loading={adminActions.setRole.isPending}
          onClick={() => {
            handleSubmit().catch(() => undefined);
          }}
          type="button"
        >
          {adminActions.setRole.isPending ? "Guardando…" : "Guardar rol"}
        </Button>
      </Group>
    </Stack>
  );
}

export function AdminRoleDialog() {
  const { state, actions } = useAdminPage();
  const isOpen = state.activeOverlay?.type === "role";
  const user =
    state.activeOverlay?.type === "role" ? state.activeOverlay.user : null;

  return (
    <Modal
      centered
      onClose={actions.closeOverlay}
      opened={isOpen}
      title="Cambiar rol"
    >
      {user ? <AdminRoleDialogContent key={user.id} user={user} /> : null}
    </Modal>
  );
}
