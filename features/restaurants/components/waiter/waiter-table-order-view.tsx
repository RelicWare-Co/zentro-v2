import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  ArrowLeft,
  ChefHat,
  Minus,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { WaiterProductPicker } from "@/features/restaurants/components/waiter/waiter-product-picker";
import { useRequeueKitchenTicketPrintMutation } from "@/features/restaurants/hooks/use-restaurants";
import { useWaiterTableOrder } from "@/features/restaurants/hooks/use-waiter-table-order";
import type { RestaurantTicketPrintStatus } from "@/features/restaurants/restaurants.shared";
import { getOrderItemStatusLabel } from "@/features/restaurants/restaurants-ui.shared";
import { useSalesWindow } from "@/features/shifts/hooks/use-shifts";
import { formatCurrency } from "@/lib/format-currency.shared";
import { cn } from "@/lib/utils";

const PRINT_STATUS_LABELS: Record<RestaurantTicketPrintStatus, string> = {
  failed: "Falló — Reimprimir",
  pending: "En cola",
  printed: "Impresa ✓",
  printing: "Imprimiendo",
  skipped: "Atendida sin imprimir",
};

const PRINT_STATUS_COLORS: Record<RestaurantTicketPrintStatus, string> = {
  failed: "red",
  pending: "yellow",
  printed: "green",
  printing: "blue",
  skipped: "gray",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  draft: "gray",
  ready: "blue",
  sent: "orange",
  served: "green",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function WaiterTableOrderView({
  onBack,
  tableId,
}: {
  onBack: () => void;
  tableId: string;
}) {
  const waiterOrder = useWaiterTableOrder(tableId);
  const requeueMutation = useRequeueKitchenTicketPrintMutation();
  const salesWindow = useSalesWindow();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [notesItemId, setNotesItemId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const notesItem = useMemo(
    () =>
      waiterOrder.activeItems.find((item) => item.id === notesItemId) ?? null,
    [notesItemId, waiterOrder.activeItems]
  );

  const cajaTickets = useMemo(
    () =>
      (waiterOrder.openOrder?.tickets ?? []).filter(
        (ticket) => ticket.printTarget === "caja"
      ),
    [waiterOrder.openOrder?.tickets]
  );

  const hasQueuedCajaPrints = cajaTickets.some(
    (ticket) =>
      ticket.printStatus === "pending" || ticket.printStatus === "printing"
  );
  const showNoCajaAlert =
    hasQueuedCajaPrints && salesWindow.data?.kind !== "open";

  const openNotesEditor = (
    itemId: string,
    notes: string | null | undefined
  ) => {
    setNotesItemId(itemId);
    setNotesDraft(notes ?? "");
  };

  const handleSaveNotes = async () => {
    if (!notesItem) {
      return;
    }
    setIsSavingNotes(true);
    try {
      await waiterOrder.updateItemNotes(notesItem.id, notesDraft);
      setNotesItemId(null);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleRequeue = async (ticketId: string) => {
    try {
      await requeueMutation.mutateAsync({ ticketId });
      notifications.show({
        color: "green",
        message: "La caja volverá a imprimir la comanda.",
        title: "Reimpresión solicitada",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message: getErrorMessage(error, "Inténtalo de nuevo."),
        title: "No se pudo solicitar la reimpresión",
      });
    }
  };

  const handleSendToKitchen = async () => {
    const sent = await waiterOrder.sendToKitchen();
    if (sent) {
      onBack();
    }
  };

  if (waiterOrder.isLoading && !waiterOrder.table) {
    return (
      <Group align="center" justify="center" py="xl">
        <Loader color="voltage.5" />
      </Group>
    );
  }

  if (waiterOrder.error) {
    return (
      <Alert color="red" title="No se pudo abrir la mesa" variant="light">
        {waiterOrder.error instanceof Error
          ? waiterOrder.error.message
          : "Inténtalo de nuevo."}
      </Alert>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Group align="center" justify="space-between" mb="md" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ActionIcon
            aria-label="Volver al salón"
            onClick={onBack}
            size="lg"
            variant="subtle"
          >
            <ArrowLeft className="size-5" />
          </ActionIcon>
          <div className="min-w-0">
            <Text fw={700} size="lg" truncate>
              {waiterOrder.table?.name ?? "Mesa"}
            </Text>
            <Text c="zinc.5" size="xs">
              {waiterOrder.table?.areaName ?? ""}
              {waiterOrder.openOrder
                ? ` · Orden #${waiterOrder.openOrder.orderNumber}`
                : ""}
            </Text>
          </div>
        </Group>
        <Button
          color="voltage"
          leftSection={<Plus className="size-4" />}
          onClick={() => setIsPickerOpen(true)}
          size="sm"
          variant="light"
        >
          Agregar
        </Button>
      </Group>

      <div className="min-h-0 flex-1 overflow-y-auto pb-28">
        <Stack gap="sm">
          {waiterOrder.activeItems.length === 0 ? (
            <Stack align="center" gap="xs" py={48}>
              <ChefHat className="size-9 text-zinc-700" />
              <Text c="zinc.5" fw={600} size="sm">
                La mesa está libre
              </Text>
              <Text c="zinc.6" maw={280} size="xs" ta="center">
                Agrega el primer producto para abrir la orden.
              </Text>
            </Stack>
          ) : (
            waiterOrder.activeItems.map((item) => {
              const status = item.status ?? "draft";
              return (
                <div
                  className="rounded-xl border border-zinc-800 bg-black/20 p-3"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Text fw={600} size="sm" truncate>
                        {item.productName}
                      </Text>
                      <Text c="zinc.4" size="xs">
                        {formatCurrency(item.unitPrice)} c/u
                      </Text>
                      {item.modifiers.length > 0 ? (
                        <Text c="zinc.5" size="xs">
                          {item.modifiers
                            .map(
                              (modifier) =>
                                `+ ${modifier.quantity} × ${modifier.name}`
                            )
                            .join(" · ")}
                        </Text>
                      ) : null}
                      {item.notes ? (
                        <Text c="zinc.4" fs="italic" size="xs" truncate>
                          Nota: {item.notes}
                        </Text>
                      ) : null}
                    </div>
                    <Badge
                      color={ITEM_STATUS_COLORS[status] ?? "gray"}
                      size="sm"
                      variant="light"
                    >
                      {getOrderItemStatusLabel(status)}
                    </Badge>
                  </div>

                  <Group justify="space-between" mt="sm" wrap="nowrap">
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon
                        aria-label={`Quitar una unidad de ${item.productName}`}
                        disabled={status !== "draft" && status !== "sent"}
                        onClick={() =>
                          waiterOrder.updateItemQuantity(item.id, -1)
                        }
                        size="lg"
                        variant="light"
                      >
                        <Minus className="size-4" />
                      </ActionIcon>
                      <Text className="w-8 text-center" fw={700} size="sm">
                        {item.quantity}
                      </Text>
                      <ActionIcon
                        aria-label={`Agregar una unidad de ${item.productName}`}
                        disabled={status !== "draft" && status !== "sent"}
                        onClick={() =>
                          waiterOrder.updateItemQuantity(item.id, 1)
                        }
                        size="lg"
                        variant="light"
                      >
                        <Plus className="size-4" />
                      </ActionIcon>
                    </Group>

                    <Group gap={4} wrap="nowrap">
                      <ActionIcon
                        aria-label={`Editar nota de ${item.productName}`}
                        disabled={status !== "draft" && status !== "sent"}
                        onClick={() => openNotesEditor(item.id, item.notes)}
                        size="lg"
                        variant="subtle"
                      >
                        <StickyNote className="size-4" />
                      </ActionIcon>
                      <ActionIcon
                        aria-label={`Eliminar ${item.productName}`}
                        color="red"
                        disabled={status !== "draft" && status !== "sent"}
                        onClick={() => waiterOrder.removeItem(item.id)}
                        size="lg"
                        variant="subtle"
                      >
                        <Trash2 className="size-4" />
                      </ActionIcon>
                    </Group>
                  </Group>
                </div>
              );
            })
          )}

          {cajaTickets.length > 0 ? (
            <Stack gap="xs">
              <Text c="zinc.5" fw={600} size="sm">
                Comandas enviadas
              </Text>
              {showNoCajaAlert ? (
                <Alert color="yellow" title="Sin caja activa" variant="light">
                  La comanda se imprimirá cuando una caja abra turno.
                </Alert>
              ) : null}
              {cajaTickets.map((ticket) => {
                const printStatus = ticket.printStatus;
                return (
                  <div
                    className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-black/20 p-3"
                    key={ticket.id}
                  >
                    <div className="min-w-0">
                      <Text fw={600} size="sm" truncate>
                        Ticket {ticket.sequenceNumber}
                        {ticket.kind === "correction" ? " · Corrección" : ""}
                      </Text>
                      <Text c="zinc.5" size="xs">
                        {ticket.lines.length} línea
                        {ticket.lines.length === 1 ? "" : "s"}
                      </Text>
                    </div>
                    <Group gap="xs" wrap="nowrap">
                      {printStatus ? (
                        <Badge
                          color={PRINT_STATUS_COLORS[printStatus]}
                          size="sm"
                          variant="light"
                        >
                          {PRINT_STATUS_LABELS[printStatus]}
                        </Badge>
                      ) : (
                        <Badge color="gray" size="sm" variant="light">
                          Impresión local
                        </Badge>
                      )}
                      {printStatus === "failed" ? (
                        <Button
                          color="voltage"
                          leftSection={<RotateCcw className="size-3.5" />}
                          loading={requeueMutation.isPending}
                          onClick={() => handleRequeue(ticket.id)}
                          size="compact-sm"
                          variant="light"
                        >
                          Reimprimir
                        </Button>
                      ) : null}
                    </Group>
                  </div>
                );
              })}
            </Stack>
          ) : null}
        </Stack>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-zinc-800 border-t bg-[var(--color-carbon)]/95 p-3 backdrop-blur",
          "pb-[calc(0.75rem+var(--safe-area-bottom))] lg:static lg:bg-transparent lg:p-0 lg:pb-0"
        )}
      >
        <Button
          color="voltage"
          disabled={waiterOrder.pendingKitchenItemsCount === 0}
          fullWidth
          leftSection={<ChefHat className="size-4" />}
          loading={waiterOrder.isSendingToKitchen}
          onClick={() => handleSendToKitchen()}
          size="lg"
        >
          Enviar a cocina
          {waiterOrder.pendingKitchenItemsCount > 0
            ? ` (${waiterOrder.pendingKitchenItemsCount})`
            : ""}
        </Button>
      </div>

      <WaiterProductPicker
        onAddProduct={waiterOrder.addProduct}
        onClose={() => setIsPickerOpen(false)}
        opened={isPickerOpen}
      />

      <Modal
        centered
        onClose={() => setNotesItemId(null)}
        opened={notesItem !== null}
        size="sm"
        title={`Nota · ${notesItem?.productName ?? "Ítem"}`}
      >
        <Stack gap="md">
          <Textarea
            autosize
            label="Nota para cocina"
            maxRows={4}
            minRows={2}
            onChange={(event) => setNotesDraft(event.currentTarget.value)}
            placeholder="Sin cebolla, término medio…"
            value={notesDraft}
          />
          <Group justify="flex-end">
            <Button onClick={() => setNotesItemId(null)} variant="subtle">
              Cancelar
            </Button>
            <Button
              color="voltage"
              loading={isSavingNotes}
              onClick={() => handleSaveNotes()}
            >
              Guardar nota
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
