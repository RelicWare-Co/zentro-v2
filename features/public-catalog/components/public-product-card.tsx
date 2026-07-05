import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { Minus, Package, Plus } from "lucide-react";
import type { PublicCatalogItem } from "@/features/orders/orders.schema";
import { formatCurrency } from "@/features/pos/utils";
import { cn } from "@/lib/utils";

interface PublicProductCardProps {
  onAdd: (product: PublicCatalogItem) => void;
  onAdjust: (productId: string, delta: number) => void;
  product: PublicCatalogItem;
  quantity: number;
}

export function PublicProductCard({
  onAdd,
  onAdjust,
  product,
  quantity,
}: PublicProductCardProps) {
  const isInCart = quantity > 0;

  return (
    <div
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border transition-all",
        isInCart
          ? "border-[var(--color-voltage)]/40 bg-[var(--color-voltage)]/5"
          : "border-zinc-800/60 bg-black/20 hover:border-zinc-700 hover:bg-black/30"
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900">
        <div className="flex size-full items-center justify-center">
          <Package className="size-8 text-zinc-700 transition-colors group-hover:text-zinc-600" />
        </div>
      </div>

      <Stack className="flex-1 gap-1 p-3" gap="xs">
        <Text fw={500} lineClamp={2} size="sm">
          {product.name}
        </Text>

        <Text c="voltage.5" className="mt-auto pt-1" fw={700} size="md">
          {formatCurrency(product.price)}
        </Text>

        <Box pt="xs">
          {isInCart ? (
            <Group gap="xs" justify="center">
              <Button
                onClick={() => onAdjust(product.id, -1)}
                size="compact-sm"
                variant="default"
              >
                <Minus className="size-3.5" />
              </Button>
              <Text fw={600} size="sm" ta="center" w={36}>
                {quantity}
              </Text>
              <Button
                onClick={() => onAdd(product)}
                size="compact-sm"
                variant="default"
              >
                <Plus className="size-3.5" />
              </Button>
            </Group>
          ) : (
            <Button
              className="w-full"
              leftSection={<Plus className="size-3.5" />}
              onClick={() => onAdd(product)}
              size="compact-sm"
              variant="light"
            >
              Agregar
            </Button>
          )}
        </Box>
      </Stack>
    </div>
  );
}
