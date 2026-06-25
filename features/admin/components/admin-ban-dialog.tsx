import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type FormEvent, useState } from "react";
import {
  ADMIN_BAN_DURATION_OPTIONS,
  type AdminBanDurationValue,
  type AdminPanelUser,
  getBanDurationSeconds,
} from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import { getErrorMessage } from "@/lib/utils";

function AdminBanDialogContent({ user }: { user: AdminPanelUser }) {
  const { actions } = useAdminPage();
  const adminActions = useAdminUserActions();
  const [banReason, setBanReason] = useState("");
  const [duration, setDuration] = useState<AdminBanDurationValue>("permanent");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const banExpiresIn = getBanDurationSeconds(duration);
      await adminActions.banUser.mutateAsync({
        userId: user.id,
        ...(banReason.trim() ? { banReason: banReason.trim() } : {}),
        ...(banExpiresIn ? { banExpiresIn } : {}),
      });
      notifications.show({
        message: `${user.name} fue suspendido.`,
        color: "green",
      });
      actions.closeOverlay();
    } catch (error) {
      notifications.show({
        message: getErrorMessage(error, "No se pudo suspender al usuario."),
        color: "red",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          {user.name} no podrá iniciar sesión y todas sus sesiones activas se
          cerrarán.
        </Text>
        <Select
          allowDeselect={false}
          data={ADMIN_BAN_DURATION_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          label="Duración"
          onChange={(value) =>
            setDuration((value ?? "permanent") as AdminBanDurationValue)
          }
          value={duration}
        />
        <Textarea
          label="Motivo (opcional)"
          onChange={(event) => setBanReason(event.target.value)}
          placeholder="Ej. Uso indebido de la cuenta"
          value={banReason}
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
            color="red"
            loading={adminActions.banUser.isPending}
            type="submit"
          >
            {adminActions.banUser.isPending ? "Suspendiendo…" : "Suspender"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function AdminBanDialog() {
  const { state, actions } = useAdminPage();
  const isOpen = state.activeOverlay?.type === "ban";
  const user =
    state.activeOverlay?.type === "ban" ? state.activeOverlay.user : null;

  return (
    <Modal
      centered
      onClose={actions.closeOverlay}
      opened={isOpen}
      title="Suspender usuario"
    >
      {user ? <AdminBanDialogContent key={user.id} user={user} /> : null}
    </Modal>
  );
}
