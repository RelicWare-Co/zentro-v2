import {
  Badge,
  Box,
  Card,
  Container,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useQuery } from "@rocicorp/zero/react";
import {
  Clock,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { formatCurrency } from "@/features/pos/utils";
import { queries } from "@/zero/queries";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptado",
  preparing: "En preparación",
  ready: "Listo",
  out_for_delivery: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const FULFILLMENT_LABELS: Record<string, string> = {
  takeaway: "Para llevar",
  delivery: "A domicilio",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "yellow",
  accepted: "blue",
  preparing: "orange",
  ready: "voltage",
  out_for_delivery: "cyan",
  delivered: "green",
  cancelled: "red",
};

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function PedidoCard({
  pedido,
}: {
  pedido: {
    id: string;
    orderNumber: number;
    status: string | null;
    fulfillment: string | null;
    contactName: string;
    contactPhone: string;
    deliveryAddress: string | null;
    deliveryNotes: string | null;
    notes: string | null;
    totalAmount: number | null;
    createdAt: number;
    items?: ReadonlyArray<{
      id: string;
      quantity: number;
      totalAmount: number;
      product: { id: string; name: string } | null;
    }>;
  };
}) {
  return (
    <Card
      className="border-zinc-800! bg-black/20"
      padding="lg"
      radius="lg"
      withBorder
    >
      <Stack gap="sm">
        <Group align="center" justify="space-between">
          <Group gap="sm">
            <Badge
              color={STATUS_COLORS[pedido.status ?? ""] ?? "gray"}
              size="md"
              variant="light"
            >
              {STATUS_LABELS[pedido.status ?? ""] ?? pedido.status}
            </Badge>
            <Text c="zinc.5" fw={600} size="sm">
              #{pedido.orderNumber}
            </Text>
          </Group>
          <Text c="zinc.6" size="xs">
            {formatTime(pedido.createdAt)}
          </Text>
        </Group>

        <Group gap="xs">
          <Badge
            leftSection={
              pedido.fulfillment === "delivery" ? (
                <MapPin className="size-3" />
              ) : (
                <ShoppingBag className="size-3" />
              )
            }
            size="sm"
            variant="outline"
          >
            {FULFILLMENT_LABELS[pedido.fulfillment ?? ""] ?? pedido.fulfillment}
          </Badge>
        </Group>

        <Stack gap={4}>
          <Group gap="xs">
            <Text c="zinc.4" size="xs">
              Cliente:
            </Text>
            <Text fw={500} size="sm">
              {pedido.contactName ?? "—"}
            </Text>
            {pedido.contactPhone ? (
              <Group gap={4}>
                <Phone className="size-3 text-zinc-500" />
                <Text c="zinc.4" size="xs">
                  {pedido.contactPhone}
                </Text>
              </Group>
            ) : null}
          </Group>
          {pedido.deliveryAddress ? (
            <Group gap="xs">
              <MapPin className="size-3 text-zinc-500" />
              <Text c="zinc.4" size="xs">
                {pedido.deliveryAddress}
              </Text>
            </Group>
          ) : null}
          {pedido.deliveryNotes ? (
            <Text c="zinc.5" fs="italic" size="xs">
              {pedido.deliveryNotes}
            </Text>
          ) : null}
        </Stack>

        <Box className="rounded-lg border border-zinc-800/60 bg-black/20 p-3">
          <Stack gap={4}>
            <Group gap="xs">
              <UtensilsCrossed className="size-3.5 text-zinc-500" />
              <Text c="zinc.4" fw={600} size="xs">
                Ítems del pedido
              </Text>
            </Group>
            {(pedido.items ?? []).map((item) => (
              <Group
                align="center"
                className="py-0.5"
                justify="space-between"
                key={item.id}
              >
                <Text size="sm">
                  {item.quantity}× {item.product?.name ?? "Producto eliminado"}
                </Text>
                <Text c="zinc.4" className="tabular-nums" size="sm">
                  {formatCurrency(item.totalAmount)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Box>

        {pedido.notes ? (
          <Group gap="xs">
            <Package className="size-3.5 text-zinc-500" />
            <Text c="zinc.5" fs="italic" size="xs">
              {pedido.notes}
            </Text>
          </Group>
        ) : null}

        <Group justify="flex-end" pt="xs">
          <Text fw={700} size="lg">
            Total: {formatCurrency(pedido.totalAmount ?? 0)}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}

function PedidosInbox() {
  const [pedidos] = useQuery(queries.orders.inbox({ status: undefined }));

  if (!pedidos) {
    return (
      <Group align="center" justify="center" py="xl">
        <Loader color="voltage.5" />
      </Group>
    );
  }

  if (pedidos.length === 0) {
    return (
      <Stack align="center" gap="md" py={80}>
        <Clock className="size-12 text-zinc-700" />
        <Title c="zinc.5" order={3}>
          No hay pedidos
        </Title>
        <Text c="zinc.6" size="sm" ta="center">
          Los pedidos que lleguen desde la página web aparecerán aquí en tiempo
          real.
        </Text>
      </Stack>
    );
  }

  return (
    <ScrollArea.Autosize mah="calc(100dvh - 200px)" offsetScrollbars>
      <Stack gap="md">
        {pedidos.map((pedido) => (
          <PedidoCard key={pedido.id} pedido={pedido} />
        ))}
      </Stack>
    </ScrollArea.Autosize>
  );
}

export default function PedidosPage() {
  return (
    <Container className="max-w-3xl" px="md" py="xl" size="sm">
      <Stack gap="lg">
        <Group align="center" justify="space-between">
          <Box>
            <Title order={1}>Pedidos</Title>
            <Text c="zinc.5" size="sm">
              Bandeja de pedidos en línea
            </Text>
          </Box>
        </Group>
        <PedidosInbox />
      </Stack>
    </Container>
  );
}
