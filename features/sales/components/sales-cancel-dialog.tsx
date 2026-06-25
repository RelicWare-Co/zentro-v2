import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useSalesPage } from "@/features/sales/sales-page-context";

export function SalesCancelDialog() {
  const { state, actions } = useSalesPage();

  return (
    <Modal
      centered
      onClose={() => actions.setCancelDialogOpen(false)}
      opened={state.isCancelDialogOpen}
      title="Anular venta"
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          Solo se pueden anular ventas sin cobros registrados. La anulación
          revertirá inventario y saldos de crédito pendientes, y no se puede
          deshacer.
        </Text>
        <Group justify="flex-end">
          <Button
            color="gray"
            disabled={state.isCancelling}
            onClick={() => actions.setCancelDialogOpen(false)}
            variant="default"
          >
            Volver
          </Button>
          <Button
            color="red"
            loading={state.isCancelling}
            onClick={() => {
              actions.confirmCancelSale().catch(() => undefined);
            }}
          >
            {state.isCancelling ? "Anulando…" : "Confirmar anulación"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
