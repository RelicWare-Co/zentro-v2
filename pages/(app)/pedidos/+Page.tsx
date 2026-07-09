import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Radio,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useQuery, useZero } from "@rocicorp/zero/react";
import {
  Clock,
  DollarSign,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/format-currency.shared";
import { mutators } from "@/zero/mutators";
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

const PAYMENT_METHODS = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "transfer_nequi", label: "Nequi" },
  { id: "transfer_bancolombia", label: "Bancolombia" },
];

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function PaymentDialog({
  pedido,
  opened,
  onClose,
}: {
  pedido: { id: string; orderNumber: number; totalAmount: number | null };
  opened: boolean;
  onClose: () => void;
}) {
  const zero = useZero();
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const requiresReference = paymentMethod !== "cash";

  const handlePay = () => {
    setIsProcessing(true);
    try {
      zero.mutate(
        mutators.orders.pay({
          pedidoId: pedido.id,
          paymentMethod,
          reference: reference.trim() || null,
        })
      );
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      opened={opened}
      size="sm"
      title={`Cobrar pedido #${pedido.orderNumber}`}
    >
      <Stack gap="md">
        <Text fw={700} size="lg" ta="center">
          {formatCurrency(pedido.totalAmount ?? 0)}
        </Text>

        <Radio.Group
          label="Método de pago"
          onChange={setPaymentMethod}
          value={paymentMethod}
        >
          <Stack gap="xs" mt="xs">
            {PAYMENT_METHODS.map((method) => (
              <Radio key={method.id} label={method.label} value={method.id} />
            ))}
          </Stack>
        </Radio.Group>

        {requiresReference ? (
          <TextInput
            label="Referencia"
            onChange={(e) => setReference(e.target.value)}
            placeholder="Número de referencia o comprobante"
            value={reference}
          />
        ) : null}

        <Group gap="xs" justify="flex-end">
          <Button onClick={onClose} variant="subtle">
            Cancelar
          </Button>
          <Button
            color="green"
            disabled={requiresReference && !reference.trim()}
            loading={isProcessing}
            onClick={handlePay}
          >
            Confirmar cobro
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function PedidoCard({
  pedido,
  onPay,
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
    saleId: string | null;
    items?: ReadonlyArray<{
      id: string;
      quantity: number;
      totalAmount: number;
      product: { id: string; name: string } | null;
    }>;
  };
  onPay: (pedido: {
    id: string;
    orderNumber: number;
    totalAmount: number | null;
  }) => void;
}) {
  const zero = useZero();
  const isPending = pedido.status === "pending";
  const isAccepted = pedido.status === "accepted";
  const isDelivered = pedido.status === "delivered";
  const isCancelled = pedido.status === "cancelled";

  const handleAccept = () => {
    zero.mutate(mutators.orders.accept({ pedidoId: pedido.id }));
  };

  const handleCancel = () => {
    zero.mutate(mutators.orders.cancel({ pedidoId: pedido.id }));
  };

  return (
    <Card
      className="border-zinc-800! bg-black/20"
      padding="md"
      radius="lg"
      withBorder
    >
      <Stack gap="sm">
        <Group align="center" justify="space-between">
          <Group gap="sm">
            <Badge
              color={STATUS_COLORS[pedido.status ?? ""] ?? "gray"}
              size="sm"
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

        <Group gap="xs" wrap="wrap">
          <Badge
            leftSection={
              pedido.fulfillment === "delivery" ? (
                <MapPin className="size-3" />
              ) : (
                <ShoppingBag className="size-3" />
              )
            }
            size="xs"
            variant="outline"
          >
            {FULFILLMENT_LABELS[pedido.fulfillment ?? ""] ?? pedido.fulfillment}
          </Badge>
          <Group gap={4}>
            <Phone className="size-3 text-zinc-500" />
            <Text c="zinc.4" size="xs">
              {pedido.contactName}
              {pedido.contactPhone ? ` · ${pedido.contactPhone}` : ""}
            </Text>
          </Group>
        </Group>

        {pedido.deliveryAddress ? (
          <Group gap={4}>
            <MapPin className="size-3 text-zinc-500" />
            <Text c="zinc.4" lineClamp={1} size="xs">
              {pedido.deliveryAddress}
            </Text>
          </Group>
        ) : null}

        <Box className="rounded-lg border border-zinc-800/60 bg-black/20 px-3 py-2">
          <Group gap="xs">
            <UtensilsCrossed className="size-3 text-zinc-500" />
            <Text c="zinc.4" fw={600} size="xs">
              Ítems
            </Text>
          </Group>
          <Stack gap={0} mt={4}>
            {(pedido.items ?? []).map((item) => (
              <Group
                align="center"
                className="py-px"
                justify="space-between"
                key={item.id}
              >
                <Text size="xs">
                  {item.quantity}× {item.product?.name ?? "—"}
                </Text>
                <Text c="zinc.4" className="tabular-nums" size="xs">
                  {formatCurrency(item.totalAmount)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Box>

        {pedido.notes ? (
          <Group gap={4}>
            <Package className="size-3 text-zinc-500" />
            <Text c="zinc.5" fs="italic" lineClamp={1} size="xs">
              {pedido.notes}
            </Text>
          </Group>
        ) : null}

        <Group justify="space-between" pt="xs">
          <Text fw={700} size="sm">
            {formatCurrency(pedido.totalAmount ?? 0)}
          </Text>
          <Group gap="xs">
            {isPending ? (
              <>
                <Button
                  color="red"
                  onClick={handleCancel}
                  size="compact-xs"
                  variant="light"
                >
                  Rechazar
                </Button>
                <Button
                  color="green"
                  onClick={handleAccept}
                  size="compact-xs"
                  variant="light"
                >
                  Aceptar
                </Button>
              </>
            ) : null}
            {isAccepted ? (
              <>
                <Button
                  color="red"
                  onClick={handleCancel}
                  size="compact-xs"
                  variant="light"
                >
                  Cancelar
                </Button>
                <Button
                  color="green"
                  leftSection={<DollarSign className="size-3" />}
                  onClick={() =>
                    onPay({
                      id: pedido.id,
                      orderNumber: pedido.orderNumber,
                      totalAmount: pedido.totalAmount,
                    })
                  }
                  size="compact-xs"
                  variant="light"
                >
                  Cobrar
                </Button>
              </>
            ) : null}
            {isDelivered ? (
              <Badge color="green" size="sm" variant="light">
                Cobrado
              </Badge>
            ) : null}
            {isCancelled ? (
              <Badge color="red" size="sm" variant="light">
                Cancelado
              </Badge>
            ) : null}
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}

function PedidosInbox() {
  const [pedidos] = useQuery(queries.orders.inbox({ status: undefined }));
  const [showAll, setShowAll] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{
    id: string;
    orderNumber: number;
    totalAmount: number | null;
  } | null>(null);

  const filteredPedidos = pedidos?.filter((p) => {
    if (showAll) {
      return true;
    }
    return p.status === "pending" || p.status === "accepted";
  });

  if (!pedidos) {
    return (
      <Group align="center" justify="center" py="xl">
        <Loader color="voltage.5" />
      </Group>
    );
  }

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button
          onClick={() => setShowAll(!showAll)}
          size="compact-sm"
          variant="subtle"
        >
          {showAll ? "Solo activos" : "Ver todos"}
        </Button>
      </Group>

      {filteredPedidos.length === 0 ? (
        <Stack align="center" gap="md" py={80}>
          <Clock className="size-12 text-zinc-700" />
          <h2 className="font-semibold text-xl text-zinc-500">
            {showAll ? "No hay pedidos" : "No hay pedidos activos"}
          </h2>
          <p className="max-w-sm text-center text-sm text-zinc-600">
            {showAll
              ? "Los pedidos que lleguen desde la página web aparecerán aquí en tiempo real."
              : "Cuando aceptes o recibas pedidos, aparecerán aquí."}
          </p>
        </Stack>
      ) : (
        <ScrollArea.Autosize mah="calc(100dvh - 240px)" offsetScrollbars>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPedidos.map((pedido) => (
              <PedidoCard
                key={pedido.id}
                onPay={setPaymentTarget}
                pedido={pedido}
              />
            ))}
          </div>
        </ScrollArea.Autosize>
      )}

      <PaymentDialog
        onClose={() => setPaymentTarget(null)}
        opened={paymentTarget !== null}
        pedido={paymentTarget ?? { id: "", orderNumber: 0, totalAmount: 0 }}
      />
    </>
  );
}

export default function PedidosPage() {
  return (
    <main className="space-y-6 bg-[var(--color-page-bg)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-3xl tracking-tight">Pedidos</h1>
          </div>
          <p className="text-sm text-zinc-400">
            Bandeja de pedidos en línea. Acepta, cobra y gestiona los pedidos
            que llegan desde tu página web.
          </p>
        </div>
      </section>
      <PedidosInbox />
    </main>
  );
}
