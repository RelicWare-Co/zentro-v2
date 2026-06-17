import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useSalesPage } from "@/features/sales/sales-page-context";
import { darkModalStyles } from "@/lib/mantine-dark";

export function SalesCancelDialog() {
  const { state, actions } = useSalesPage();

  return (
    <Modal
      centered
      onClose={() => actions.setCancelDialogOpen(false)}
      opened={state.isCancelDialogOpen}
      styles={darkModalStyles}
      title="Anular venta"
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          Esta venta quedará anulada. Sus pagos dejarán de contar para caja y
          sus valores no sumarán en ventas. Esta acción no se puede deshacer.
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
