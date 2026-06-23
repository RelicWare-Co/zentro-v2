import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useProductsPage } from "@/features/products/products-page-context";

export function ProductDeleteDialog() {
  const { state, actions, meta } = useProductsPage();
  const { mutations } = meta;

  return (
    <Modal
      centered
      onClose={() => actions.setProductToDelete(null)}
      opened={Boolean(state.productToDelete)}
      title="¿Eliminar producto?"
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          {state.productToDelete?.name} será removido del catálogo activo.
        </Text>
        <Group justify="flex-end">
          <Button
            color="gray"
            onClick={() => actions.setProductToDelete(null)}
            variant="default"
          >
            Cancelar
          </Button>
          <Button
            color="red"
            loading={mutations.deleteProductMutation.isPending}
            onClick={() => {
              actions.confirmDeleteProduct().catch(() => undefined);
            }}
          >
            Eliminar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
