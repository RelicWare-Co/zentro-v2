import { Alert, Box, Button, Group, Stack, Text } from "@mantine/core";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import type { PublicCatalogItem } from "@/features/orders/orders.schema";
import { formatCurrency } from "@/features/pos/utils";

interface CartLine {
  product: PublicCatalogItem;
  quantity: number;
}

interface PublicCartSummaryProps {
  lines: CartLine[];
  onAdjust: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  total: number;
}

export function PublicCartSummary({
  lines,
  onAdjust,
  onRemove,
  total,
}: PublicCartSummaryProps) {
  if (lines.length === 0) {
    return (
      <Alert
        color="gray"
        icon={<ShoppingBag className="size-4" />}
        variant="light"
      >
        Tu pedido está vacío. Agrega productos del catálogo.
      </Alert>
    );
  }

  return (
    <Stack gap="sm">
      {lines.map((line) => (
        <Group
          align="center"
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
          gap="md"
          justify="space-between"
          key={line.product.id}
        >
          <Box className="min-w-0 flex-1">
            <Text c="white" fw={500} lineClamp={1} size="sm">
              {line.product.name}
            </Text>
            <Text c="zinc.5" size="xs">
              {formatCurrency(line.product.price)} × {line.quantity}
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              onClick={() => onAdjust(line.product.id, -1)}
              size="compact-xs"
              variant="subtle"
            >
              <Minus className="size-3" />
            </Button>
            <Text c="white" fw={600} size="sm" ta="center" w={24}>
              {line.quantity}
            </Text>
            <Button
              onClick={() => onAdjust(line.product.id, 1)}
              size="compact-xs"
              variant="subtle"
            >
              <Plus className="size-3" />
            </Button>
            <Button
              color="red"
              onClick={() => onRemove(line.product.id)}
              size="compact-xs"
              variant="subtle"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </Group>
        </Group>
      ))}
      <Group
        justify="space-between"
        pt="sm"
        style={{ borderTop: "1px solid #27272a" }}
      >
        <Text c="white" fw={500} size="sm">
          Total
        </Text>
        <Text c="white" fw={700} size="lg">
          {formatCurrency(total)}
        </Text>
      </Group>
    </Stack>
  );
}
