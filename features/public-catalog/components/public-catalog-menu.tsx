import { Box, Card, Container, Drawer, Stack, Title } from "@mantine/core";
import { ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicCatalogItem } from "@/features/orders/orders.schema";
import { formatCurrency } from "@/lib/format-currency.shared";
import { PublicCartSummary } from "./public-cart-summary";
import { PublicCategoryTabs } from "./public-category-tabs";
import { PublicOrderForm } from "./public-order-form";
import { PublicOrderSuccess } from "./public-order-success";
import { PublicProductCard } from "./public-product-card";

interface CartLine {
  product: PublicCatalogItem;
  quantity: number;
}

interface PublicCatalogMenuProps {
  organizationName: string;
  products: PublicCatalogItem[];
  slug: string;
}

export function PublicCatalogMenu({
  organizationName,
  products,
  slug,
}: PublicCatalogMenuProps) {
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<{
    orderNumber: number;
    organizationName: string;
  } | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      const key = product.categoryId ?? "__sin__";
      if (!map.has(key)) {
        map.set(key, product.categoryName ?? "Sin categoría");
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeCategoryId === "all") {
      return products;
    }
    return products.filter(
      (product) => (product.categoryId ?? "__sin__") === activeCategoryId
    );
  }, [products, activeCategoryId]);

  const groupedProducts = useMemo(() => {
    if (activeCategoryId !== "all") {
      return [{ categoryId: activeCategoryId, items: filteredProducts }];
    }
    const groups = new Map<string, PublicCatalogItem[]>();
    for (const product of filteredProducts) {
      const key = product.categoryId ?? "__sin__";
      const existing = groups.get(key);
      if (existing) {
        existing.push(product);
      } else {
        groups.set(key, [product]);
      }
    }
    return Array.from(groups.entries()).map(([categoryId, items]) => ({
      categoryId,
      items,
    }));
  }, [filteredProducts, activeCategoryId]);

  const cartLines: CartLine[] = useMemo(
    () =>
      products
        .filter((product) => (quantities[product.id] ?? 0) > 0)
        .map((product) => ({
          product,
          quantity: quantities[product.id] ?? 0,
        })),
    [products, quantities]
  );

  const cartTotal = useMemo(
    () =>
      cartLines.reduce(
        (sum, line) => sum + line.product.price * line.quantity,
        0
      ),
    [cartLines]
  );

  const handleAdd = (product: PublicCatalogItem) => {
    setQuantities((prev) => ({
      ...prev,
      [product.id]: (prev[product.id] ?? 0) + 1,
    }));
  };

  const handleAdjust = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] ?? 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev, [productId]: next };
      if (next === 0) {
        delete updated[productId];
      }
      return updated;
    });
  };

  const handleRemove = (productId: string) => {
    setQuantities((prev) => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
  };

  const handleSubmit = async (data: {
    fulfillment: "takeaway" | "delivery";
    contactName: string;
    contactPhone: string;
    deliveryAddress: string;
    deliveryNotes: string;
    notes: string;
  }) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug: slug,
          fulfillment: data.fulfillment,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
          deliveryAddress:
            data.fulfillment === "delivery" ? data.deliveryAddress : undefined,
          deliveryNotes: data.deliveryNotes || undefined,
          notes: data.notes || undefined,
          items: cartLines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ error: "Error desconocido" }));
        throw new Error(body.error ?? "No se pudo enviar el pedido");
      }

      const result = (await res.json()) as { orderNumber: number };
      setSuccessOrder({
        orderNumber: result.orderNumber,
        organizationName,
      });
      setQuantities({});
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo enviar el pedido"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successOrder) {
    return (
      <Container py="xl" size="sm">
        <PublicOrderSuccess
          onNewOrder={() => setSuccessOrder(null)}
          {...successOrder}
        />
      </Container>
    );
  }

  const totalCartItems = cartLines.reduce(
    (sum, line) => sum + line.quantity,
    0
  );

  return (
    <>
      <Container
        className="flex flex-col gap-6 px-4 sm:px-6 lg:grid lg:grid-cols-[1fr_360px]"
        size="xl"
      >
        <Box>
          <Box mb="lg" mt="lg">
            <Title order={1}>{organizationName}</Title>
          </Box>

          <Box className="sticky top-0 z-20 -mx-4 mb-4 border-zinc-800 border-b bg-[var(--color-void)] px-4 pt-1 pb-3 sm:-mx-6 sm:px-6">
            <PublicCategoryTabs
              activeCategoryId={activeCategoryId}
              categories={categories}
              onCategoryChange={setActiveCategoryId}
            />
          </Box>

          <div className="space-y-6">
            {groupedProducts.map((group) => {
              const category = categories.find(
                (c) => c.id === group.categoryId
              );
              return (
                <div key={group.categoryId}>
                  {activeCategoryId === "all" && (
                    <h2 className="mb-3 font-semibold text-lg text-white">
                      {category?.name ?? "Sin categoría"}
                    </h2>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                    {group.items.map((product) => (
                      <PublicProductCard
                        key={product.id}
                        onAdd={handleAdd}
                        onAdjust={handleAdjust}
                        product={product}
                        quantity={quantities[product.id] ?? 0}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Box>

        <Box className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
          <Card
            className="border-zinc-800 bg-zinc-900/80"
            padding={32}
            radius="lg"
            withBorder
          >
            <h2 className="mb-5 font-semibold text-lg text-white">Tu pedido</h2>
            <PublicCartSummary
              lines={cartLines}
              onAdjust={handleAdjust}
              onRemove={handleRemove}
              total={cartTotal}
            />
            {cartLines.length > 0 ? (
              <Box mt="lg" pt="lg" style={{ borderTop: "1px solid #27272a" }}>
                <PublicOrderForm
                  cartLines={cartLines}
                  cartTotal={cartTotal}
                  isSubmitting={isSubmitting}
                  onSubmit={handleSubmit}
                  slug={slug}
                  submitError={submitError}
                />
              </Box>
            ) : null}
          </Card>
        </Box>
      </Container>

      {cartLines.length > 0 && (
        <div className="fixed right-0 bottom-0 left-0 z-50 border-zinc-800 border-t bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <button
            className="flex w-full items-center justify-between gap-3"
            onClick={() => setMobileCartOpen(true)}
            type="button"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex size-10 items-center justify-center rounded-full bg-[var(--color-voltage)]">
                <ShoppingBag className="size-5 text-black" />
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red-500 font-bold text-[10px] text-white">
                  {totalCartItems}
                </span>
              </div>
              <span className="font-medium text-sm text-white">
                {totalCartItems} artículo{totalCartItems === 1 ? "" : "s"}
              </span>
            </div>
            <span className="font-bold text-[var(--color-voltage)]">
              {formatCurrency(cartTotal)}
            </span>
          </button>
        </div>
      )}

      <Drawer
        classNames={{
          content: "max-h-[90dvh]!",
          close: "text-zinc-400! hover:text-white! hover:bg-white/5!",
        }}
        onClose={() => setMobileCartOpen(false)}
        opened={mobileCartOpen}
        position="bottom"
        radius="lg"
        size="lg"
        styles={{
          header: {
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 20,
            paddingBottom: 0,
          },
          body: {
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 16,
            paddingBottom: 32,
            overflowY: "auto",
          },
        }}
        title="Tu pedido"
      >
        <Stack gap="lg">
          <PublicCartSummary
            lines={cartLines}
            onAdjust={handleAdjust}
            onRemove={handleRemove}
            total={cartTotal}
          />
          {cartLines.length > 0 && (
            <PublicOrderForm
              cartLines={cartLines}
              cartTotal={cartTotal}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              slug={slug}
              submitError={submitError}
            />
          )}
        </Stack>
      </Drawer>

      <div className="h-16 lg:hidden" />
    </>
  );
}
