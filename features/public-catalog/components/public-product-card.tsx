import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { Minus, Package, Plus } from "lucide-react";
import type { PublicCatalogItem } from "@/features/orders/orders.schema";
import { formatCurrency } from "@/lib/format-currency.shared";
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
        "group flex flex-col overflow-hidden rounded-xl border transition-all",
        isInCart
          ? "border-[var(--color-voltage)]/40 bg-[var(--color-voltage)]/5"
          : "border-zinc-800/60 bg-black/20 hover:border-zinc-700 hover:bg-black/30"
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900">
        <div className="flex size-full items-center justify-center">
          <Package className="size-6 text-zinc-700 transition-colors group-hover:text-zinc-600 sm:size-8" />
        </div>
      </div>

      <Stack className="flex-1 gap-1 p-1.5 sm:p-3" gap="xs">
        <Text fw={500} lineClamp={2} size="xs">
          {product.name}
        </Text>

        <Text c="voltage.5" fw={700} size="sm">
          {formatCurrency(product.price)}
        </Text>

        <Box pb={2} pt={2}>
          {isInCart ? (
            <Group gap="xs" justify="center">
              <Button
                onClick={() => onAdjust(product.id, -1)}
                size="compact-sm sm:compact-xs"
                variant="default"
              >
                <Minus className="size-4 sm:size-5" />
              </Button>
              <Text fw={600} size="xs" ta="center" w={28}>
                {quantity}
              </Text>
              <Button
                onClick={() => onAdd(product)}
                size="compact-sm sm:compact-xs"
                variant="default"
              >
                <Plus className="size-4 sm:size-5" />
              </Button>
            </Group>
          ) : (
            <Group justify="center">
              <Button
                leftSection={<Plus className="size-4 sm:size-5" />}
                onClick={() => onAdd(product)}
                size="xs"
                variant="default"
              >
                Agregar
              </Button>
            </Group>
          )}
        </Box>
      </Stack>
    </div>
  );
}
