import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { darkModalStyles } from "@/features/customers/components/customers-mantine";
import { useCustomersPage } from "@/features/customers/customers-page-context";

export function CustomerDeleteDialog() {
  const { state, actions, meta } = useCustomersPage();
  const isOpen = state.activeOverlay?.type === "delete";

  return (
    <Modal
      centered
      onClose={actions.closeOverlay}
      opened={isOpen}
      styles={darkModalStyles}
      title="¿Eliminar cliente?"
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          {state.customerToDelete?.name} será removido de la lista activa.
        </Text>
        <Group justify="flex-end">
          <Button color="gray" onClick={actions.closeOverlay} variant="default">
            Cancelar
          </Button>
          <Button
            color="red"
            loading={meta.isDeletePending}
            onClick={() => {
              actions.confirmDelete().catch(() => undefined);
            }}
          >
            Eliminar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
