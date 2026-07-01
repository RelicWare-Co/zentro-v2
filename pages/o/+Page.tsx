import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Info,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  PublicCatalog,
  PublicCatalogItem,
} from "@/features/orders/orders.schema";

interface CartLine {
  product: PublicCatalogItem;
  quantity: number;
}

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

async function fetchCatalog(slug: string): Promise<PublicCatalog> {
  const res = await fetch(
    `/api/public/catalog?slug=${encodeURIComponent(slug)}`
  );
  if (!res.ok) {
    throw new Error("No se pudo cargar el catálogo");
  }
  return res.json() as Promise<PublicCatalog>;
}

function useCatalogSlug() {
  if (typeof window === "undefined") {
    return "";
  }
  const params = new URLSearchParams(window.location.search);
  return params.get("slug") ?? "";
}

function useCatalog(slug: string) {
  return useQuery({
    enabled: slug.length > 0,
    queryFn: () => fetchCatalog(slug),
    queryKey: ["public-catalog", slug],
  });
}

function ProductGrid({
  products,
  onAdd,
  quantities,
}: {
  products: PublicCatalogItem[];
  onAdd: (product: PublicCatalogItem) => void;
  quantities: Record<string, number>;
}) {
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      const key = product.categoryId ?? "__sin__";
      if (!map.has(key)) {
        map.set(key, product.categoryName ?? "Sin categoría");
      }
    }
    return Array.from(map.entries());
  }, [products]);

  return (
    <Stack gap="xl">
      {categories.map(([categoryId, categoryName]) => {
        const items = products.filter(
          (product) => (product.categoryId ?? "__sin__") === categoryId
        );
        return (
          <Box key={categoryId}>
            <Title mb="sm" order={3}>
              {categoryName}
            </Title>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((product) => (
                <Card
                  className="flex flex-col justify-between"
                  key={product.id}
                  padding="md"
                  radius="lg"
                  shadow="xs"
                  withBorder
                >
                  <Stack gap="xs">
                    <Text fw={600} lineClamp={2} size="sm">
                      {product.name}
                    </Text>
                    <Text c="voltage.5" fw={700} size="lg">
                      {formatCOP(product.price)}
                    </Text>
                  </Stack>
                  <Group gap="xs" justify="space-between" mt="md">
                    {quantities[product.id] > 0 ? (
                      <Group gap="xs">
                        <Button
                          onClick={() => onAdd(product)}
                          size="compact-sm"
                          variant="default"
                        >
                          <Minus className="size-4" />
                        </Button>
                        <Text fw={600} size="sm" ta="center" w={32}>
                          {quantities[product.id]}
                        </Text>
                        <Button
                          onClick={() => onAdd(product)}
                          size="compact-sm"
                          variant="default"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </Group>
                    ) : (
                      <Button
                        leftSection={<Plus className="size-4" />}
                        onClick={() => onAdd(product)}
                        size="compact-sm"
                        variant="light"
                      >
                        Agregar
                      </Button>
                    )}
                  </Group>
                </Card>
              ))}
            </div>
          </Box>
        );
      })}
    </Stack>
  );
}

function CartSummary({
  lines,
  onRemove,
  onAdjust,
  total,
}: {
  lines: CartLine[];
  onRemove: (productId: string) => void;
  onAdjust: (productId: string, delta: number) => void;
  total: number;
}) {
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
    <Stack gap="xs">
      {lines.map((line) => (
        <Group
          align="center"
          className="rounded-lg border border-zinc-800 bg-black/20 p-2"
          gap="sm"
          justify="space-between"
          key={line.product.id}
        >
          <Box className="min-w-0 flex-1">
            <Text fw={500} lineClamp={1} size="sm">
              {line.product.name}
            </Text>
            <Text c="zinc.5" size="xs">
              {formatCOP(line.product.price)} × {line.quantity}
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
            <Text fw={600} size="sm" ta="center" w={24}>
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
      <Group justify="flex-end" pt="xs">
        <Text fw={700} size="lg">
          Total: {formatCOP(total)}
        </Text>
      </Group>
    </Stack>
  );
}

function OrderForm({
  cartLines,
  cartTotal,
  onSubmit,
  isSubmitting,
  submitError,
  slug,
}: {
  catalog: PublicCatalog;
  cartLines: CartLine[];
  cartTotal: number;
  onSubmit: (data: {
    fulfillment: "takeaway" | "delivery";
    contactName: string;
    contactPhone: string;
    deliveryAddress: string;
    deliveryNotes: string;
    notes: string;
  }) => void;
  isSubmitting: boolean;
  submitError: string | null;
  slug: string;
}) {
  const [fulfillment, setFulfillment] = useState<"takeaway" | "delivery">(
    "takeaway"
  );
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [notes, setNotes] = useState("");

  const canSubmit =
    cartLines.length > 0 &&
    contactName.trim().length > 0 &&
    contactPhone.trim().length > 0 &&
    (fulfillment === "takeaway" || deliveryAddress.trim().length > 0) &&
    !isSubmitting;

  return (
    <Stack gap="md">
      <SegmentedControl<"takeaway" | "delivery">
        data={[
          { label: "Para llevar", value: "takeaway" },
          { label: "A domicilio", value: "delivery" },
        ]}
        fullWidth
        onChange={setFulfillment}
        value={fulfillment}
      />

      <TextInput
        label="Nombre"
        onChange={(e) => setContactName(e.target.value)}
        placeholder="Tu nombre"
        required
        value={contactName}
      />
      <TextInput
        label="Teléfono"
        leftSection={<Phone className="size-4" />}
        onChange={(e) => setContactPhone(e.target.value)}
        placeholder="300 000 0000"
        required
        value={contactPhone}
      />

      {fulfillment === "delivery" ? (
        <>
          <Textarea
            label="Dirección de entrega"
            leftSection={<MapPin className="size-4" />}
            minRows={2}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Calle 123 #45-67, Apto 301"
            required
            value={deliveryAddress}
          />
          <Textarea
            label="Notas del domicilio"
            minRows={1}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            placeholder="Tocar timbre 2B, dejar en portería…"
            value={deliveryNotes}
          />
        </>
      ) : null}

      <Textarea
        label="Notas del pedido"
        minRows={1}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Sin cebolla, extra salsa…"
        value={notes}
      />

      {submitError ? (
        <Alert color="red" variant="light">
          {submitError}
        </Alert>
      ) : null}

      <Button
        color="voltage.5"
        disabled={!canSubmit}
        fullWidth
        loading={isSubmitting}
        onClick={() =>
          onSubmit({
            fulfillment,
            contactName,
            contactPhone,
            deliveryAddress,
            deliveryNotes,
            notes,
          })
        }
        size="lg"
      >
        {isSubmitting
          ? "Enviando pedido…"
          : `Enviar pedido — ${formatCOP(cartTotal)}`}
      </Button>

      <Text c="zinc.5" size="xs" ta="center">
        El pago se realiza al recibir el pedido. El negocio confirmará tu pedido
        al teléfono indicado.
      </Text>

      <Anchor
        href={`/o?slug=${encodeURIComponent(slug)}`}
        size="xs"
        ta="center"
      >
        Volver al catálogo
      </Anchor>
    </Stack>
  );
}

function OrderSuccess({
  orderNumber,
  organizationName,
  onNewOrder,
}: {
  orderNumber: number;
  organizationName: string;
  onNewOrder: () => void;
}) {
  return (
    <Stack align="center" gap="md" py="xl">
      <CheckCircle2 className="size-16 text-emerald-500" />
      <Title order={2} ta="center">
        ¡Pedido enviado!
      </Title>
      <Text size="lg" ta="center">
        Tu pedido <strong>#{orderNumber}</strong> ha sido recibido por{" "}
        <strong>{organizationName}</strong>.
      </Text>
      <Alert
        color="voltage"
        icon={<Info className="size-4" />}
        variant="light"
        w="100%"
      >
        Te contactaremos al teléfono proporcionado para confirmar el pedido y la
        entrega.
      </Alert>
      <Button onClick={onNewOrder} size="md" variant="light">
        Hacer otro pedido
      </Button>
    </Stack>
  );
}

function CatalogPage() {
  const slug = useCatalogSlug();
  const { data: catalog, isPending, isError } = useCatalog(slug);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<{
    orderNumber: number;
    organizationName: string;
  } | null>(null);

  const cartLines: CartLine[] = useMemo(() => {
    if (!catalog) {
      return [];
    }
    return catalog.products
      .filter((product) => (quantities[product.id] ?? 0) > 0)
      .map((product) => ({
        product,
        quantity: quantities[product.id] ?? 0,
      }));
  }, [catalog, quantities]);

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
        organizationName: catalog?.organizationName ?? "",
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

  if (!slug) {
    return (
      <Container py="xl" size="sm">
        <Alert color="yellow" variant="light">
          Enlace inválido. Solicita el enlace correcto al negocio.
        </Alert>
      </Container>
    );
  }

  if (isPending) {
    return (
      <Flex align="center" justify="center" py="xl">
        <Loader color="voltage.5" />
      </Flex>
    );
  }

  if (isError || !catalog) {
    return (
      <Container py="xl" size="sm">
        <Alert color="red" variant="light">
          No se pudo cargar el catálogo. Verifica que el enlace sea correcto.
        </Alert>
      </Container>
    );
  }

  if (successOrder) {
    return (
      <Container py="xl" size="sm">
        <OrderSuccess
          onNewOrder={() => setSuccessOrder(null)}
          {...successOrder}
        />
      </Container>
    );
  }

  return (
    <Container className="grid gap-6 lg:grid-cols-[1fr_380px]" size="xl">
      <Box>
        <Group align="flex-end" justify="space-between" mb="lg">
          <Box>
            <Badge mb="xs" variant="light">
              Pedidos en línea
            </Badge>
            <Title order={1}>{catalog.organizationName}</Title>
          </Box>
        </Group>
        <ProductGrid
          onAdd={handleAdd}
          products={catalog.products}
          quantities={quantities}
        />
      </Box>

      <Box className="lg:sticky lg:top-6">
        <Card padding="lg" radius="lg" shadow="sm" withBorder>
          <Title mb="md" order={3}>
            Tu pedido
          </Title>
          <CartSummary
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
              <OrderForm
                cartLines={cartLines}
                cartTotal={cartTotal}
                catalog={catalog}
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

export default function PublicOrderPage() {
  return (
    <div className="min-h-[100dvh] bg-[var(--color-void)] text-[var(--color-photon)]">
      <CatalogPage />
    </div>
  );
}
