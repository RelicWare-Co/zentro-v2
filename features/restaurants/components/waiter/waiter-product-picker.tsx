import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { ArrowLeft, Minus, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  usePosCategories,
  usePosModifierProducts,
  usePosProducts,
} from "@/features/pos/hooks/use-pos-catalog";
import type { CartItemModifier, Product } from "@/features/pos/types";
import { formatCurrency } from "@/lib/format-currency.shared";
import { cn } from "@/lib/utils";

const MAX_MODIFIER_QUANTITY = 10;

export function WaiterProductPicker({
  onAddProduct,
  onClose,
  opened,
}: {
  onAddProduct: (
    product: Product,
    modifiers: CartItemModifier[],
    notes: string
  ) => Promise<boolean>;
  onClose: () => void;
  opened: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modifierQuantities, setModifierQuantities] = useState<
    Record<string, number>
  >({});
  const [notes, setNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const categoriesQuery = usePosCategories();
  const productsQuery = usePosProducts(activeCategoryId, searchQuery);
  const modifiersQuery = usePosModifierProducts();

  const products = useMemo(
    () => productsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [productsQuery.data]
  );
  const modifierProducts = modifiersQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const selectedModifiers = useMemo<CartItemModifier[]>(
    () =>
      modifierProducts
        .map((modifierProduct) => ({
          id: modifierProduct.id,
          name: modifierProduct.name,
          price: modifierProduct.price,
          quantity: modifierQuantities[modifierProduct.id] ?? 0,
        }))
        .filter((modifier) => modifier.quantity > 0),
    [modifierProducts, modifierQuantities]
  );

  const resetItemState = () => {
    setSelectedProduct(null);
    setModifierQuantities({});
    setNotes("");
    setIsAdding(false);
  };

  const handleClose = () => {
    resetItemState();
    setSearchQuery("");
    setActiveCategoryId("all");
    onClose();
  };

  const updateModifierQuantity = (modifierProductId: string, delta: number) => {
    setModifierQuantities((current) => {
      const nextQuantity = Math.min(
        MAX_MODIFIER_QUANTITY,
        Math.max(0, (current[modifierProductId] ?? 0) + delta)
      );
      return { ...current, [modifierProductId]: nextQuantity };
    });
  };

  const handleConfirmAdd = async () => {
    if (!selectedProduct) {
      return;
    }
    setIsAdding(true);
    try {
      const added = await onAddProduct(
        selectedProduct,
        selectedModifiers,
        notes
      );
      if (added) {
        resetItemState();
      }
    } finally {
      setIsAdding(false);
    }
  };

  const renderProductResults = () => {
    if (productsQuery.isLoading) {
      return (
        <Group align="center" justify="center" py="xl">
          <Loader color="voltage.5" />
        </Group>
      );
    }

    if (products.length === 0) {
      return (
        <Text c="zinc.5" py="xl" size="sm" ta="center">
          No hay productos para esta búsqueda.
        </Text>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3 pb-4">
        {products.map((product) => (
          <button
            className={cn(
              "flex min-h-[84px] flex-col justify-between rounded-xl border-2 border-zinc-800 bg-black/20 p-3 text-left transition-colors",
              "active:border-[var(--color-voltage)]/70"
            )}
            key={product.id}
            onClick={() => setSelectedProduct(product)}
            type="button"
          >
            <span className="font-semibold text-sm text-white">
              {product.name}
            </span>
            <Group gap={4} justify="space-between" wrap="nowrap">
              <Badge color="gray" size="xs" variant="light">
                {product.categoryName}
              </Badge>
              <Text c="zinc.3" fw={600} size="xs">
                {formatCurrency(product.price)}
              </Text>
            </Group>
          </button>
        ))}
      </div>
    );
  };

  return (
    <Drawer
      onClose={handleClose}
      opened={opened}
      position="bottom"
      size="85%"
      title={selectedProduct ? "Personalizar ítem" : "Agregar producto"}
    >
      <div className="flex h-full min-h-0 flex-col">
        {selectedProduct ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <Group className="px-4" gap="sm" mb="md">
              <ActionIcon
                aria-label="Volver al catálogo"
                onClick={resetItemState}
                size="lg"
                variant="subtle"
              >
                <ArrowLeft className="size-4" />
              </ActionIcon>
              <div className="min-w-0">
                <Text fw={700} size="md" truncate>
                  {selectedProduct.name}
                </Text>
                <Text c="zinc.4" size="sm">
                  {formatCurrency(selectedProduct.price)}
                </Text>
              </div>
            </Group>

            <ScrollArea className="min-h-0 flex-1">
              <Stack className="px-4" gap="sm" pb="md">
                <Text c="zinc.5" fw={600} size="sm">
                  Modificadores
                </Text>
                {modifierProducts.length === 0 ? (
                  <Text c="zinc.5" size="sm">
                    No hay modificadores configurados.
                  </Text>
                ) : (
                  modifierProducts.map((modifierProduct) => {
                    const quantity =
                      modifierQuantities[modifierProduct.id] ?? 0;
                    return (
                      <div
                        className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/20 p-3"
                        key={modifierProduct.id}
                      >
                        <div className="min-w-0">
                          <Text fw={600} size="sm" truncate>
                            {modifierProduct.name}
                          </Text>
                          <Text c="zinc.4" size="xs">
                            {formatCurrency(modifierProduct.price)} c/u
                          </Text>
                        </div>
                        <Group gap={4} wrap="nowrap">
                          <ActionIcon
                            aria-label={`Quitar ${modifierProduct.name}`}
                            disabled={quantity === 0}
                            onClick={() =>
                              updateModifierQuantity(modifierProduct.id, -1)
                            }
                            size="lg"
                            variant="light"
                          >
                            <Minus className="size-4" />
                          </ActionIcon>
                          <Text className="w-8 text-center" fw={700} size="sm">
                            {quantity}
                          </Text>
                          <ActionIcon
                            aria-label={`Agregar ${modifierProduct.name}`}
                            onClick={() =>
                              updateModifierQuantity(modifierProduct.id, 1)
                            }
                            size="lg"
                            variant="light"
                          >
                            <Plus className="size-4" />
                          </ActionIcon>
                        </Group>
                      </div>
                    );
                  })
                )}

                <TextInput
                  label="Nota para cocina"
                  onChange={(event) => setNotes(event.currentTarget.value)}
                  placeholder="Sin cebolla, término medio…"
                  value={notes}
                />
              </Stack>
            </ScrollArea>

            <div className="border-zinc-800 border-t px-4 pt-3 pb-[calc(1rem+var(--safe-area-bottom))]">
              <Button
                color="voltage"
                fullWidth
                loading={isAdding}
                onClick={handleConfirmAdd}
                size="lg"
              >
                Agregar a la mesa
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="px-4">
              <TextInput
                leftSection={<Search className="size-4" />}
                mb="sm"
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                placeholder="Buscar producto…"
                value={searchQuery}
              />
            </div>

            <div className="px-4">
              <ScrollArea mb="sm" scrollbars="x">
                <Group gap="xs" pb="xs" wrap="nowrap">
                  <Button
                    color={activeCategoryId === "all" ? "voltage" : "gray"}
                    onClick={() => setActiveCategoryId("all")}
                    size="compact-md"
                    variant={activeCategoryId === "all" ? "filled" : "light"}
                  >
                    Todos
                  </Button>
                  {categories.map((category) => (
                    <Button
                      color={
                        activeCategoryId === category.id ? "voltage" : "gray"
                      }
                      key={category.id}
                      onClick={() => setActiveCategoryId(category.id)}
                      size="compact-md"
                      variant={
                        activeCategoryId === category.id ? "filled" : "light"
                      }
                    >
                      {category.name}
                    </Button>
                  ))}
                </Group>
              </ScrollArea>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="px-4">{renderProductResults()}</div>
            </ScrollArea>
          </div>
        )}
      </div>
    </Drawer>
  );
}
