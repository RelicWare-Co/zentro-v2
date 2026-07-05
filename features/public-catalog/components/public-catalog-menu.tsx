import { Box, Card, Container, Title } from "@mantine/core";
import { useMemo, useState } from "react";
import type { PublicCatalogItem } from "@/features/orders/orders.schema";
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

  return (
    <Container className="grid gap-6 lg:grid-cols-[1fr_380px]" size="xl">
      <Box>
        <Box mb="lg">
          <Title order={1}>{organizationName}</Title>
        </Box>

        <Box className="sticky top-0 z-20 -mx-2 mb-4 bg-[var(--color-page-bg)] px-2 pt-1 pb-3">
          <PublicCategoryTabs
            activeCategoryId={activeCategoryId}
            categories={categories}
            onCategoryChange={setActiveCategoryId}
          />
        </Box>

        <div className="space-y-6">
          {groupedProducts.map((group) => {
            const category = categories.find((c) => c.id === group.categoryId);
            return (
              <div key={group.categoryId}>
                {activeCategoryId === "all" && (
                  <h2 className="mb-3 font-semibold text-lg text-white">
                    {category?.name ?? "Sin categoría"}
                  </h2>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

      <Box className="lg:sticky lg:top-6">
        <Card padding="lg" radius="lg" shadow="sm" withBorder>
          <h2 className="mb-4 font-semibold text-lg text-white">Tu pedido</h2>
          <PublicCartSummary
            lines={cartLines}
            onAdjust={handleAdjust}
            onRemove={handleRemove}
            total={cartTotal}
          />
          {cartLines.length > 0 ? (
            <Box
              mt="lg"
              pt="lg"
              style={{ borderTop: "1px solid var(--mantine-color-dark-4)" }}
            >
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
  );
}
