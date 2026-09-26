import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import {
  CheckCheck,
  ChefHat,
  Clock,
  Eye,
  Printer,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import {
  isPosLocalPrinterConfigured,
  usePosLocalPrinterSettings,
} from "@/features/pos/printing/printer-settings.local.client";
import { SalonTicketDetail } from "@/features/restaurants/components/salon-ticket-detail";
import { useCajaPrintAttempt } from "@/features/restaurants/hooks/use-caja-print-attempt";
import {
  useAcknowledgeKitchenTicketPrintMutation,
  useRequeueKitchenTicketPrintMutation,
  useSalonKitchenTickets,
} from "@/features/restaurants/hooks/use-restaurants";
import type {
  RestaurantKitchenTicketRow,
  RestaurantTicketPrintStatus,
} from "@/features/restaurants/restaurants.shared";
import { mapRestaurantKitchenTicket } from "@/features/restaurants/restaurants.shared";
import { getRestaurantModuleSettings } from "@/features/restaurants/restaurants-settings.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { queries } from "@/zero/queries";

const PRINT_STATUS_LABELS: Record<RestaurantTicketPrintStatus, string> = {
  failed: "Falló",
  pending: "En cola",
  printed: "Impresa",
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatTicketTime(timestamp: number) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getOperationLabel(operation: string) {
  if (operation === "cancel") {
    return "ANULAR";
  }
  if (operation === "modify") {
    return "MODIFICAR";
  }
  return null;
}

function showError(title: string, error: unknown, fallback: string) {
  notifications.show({
    color: "red",
    message: getErrorMessage(error, fallback),
    title,
  });
}

function SalonTicketCard({
  canPrint,
  isBusy,
  onAcknowledge,
  onOpenDetail,
  onPrint,
  ticket,
}: {
  canPrint: boolean;
  isBusy: boolean;
  onAcknowledge: (ticket: RestaurantKitchenTicketRow) => void;
  onOpenDetail: (ticket: RestaurantKitchenTicketRow) => void;
  onPrint: (ticket: RestaurantKitchenTicketRow) => void;
  ticket: RestaurantKitchenTicketRow;
}) {
  const orderRow = ticket.order ?? null;
  const tableName = orderRow?.table?.name ?? "Mesa";
  const areaName = orderRow?.table?.area?.name ?? "";
  const mappedTicket = mapRestaurantKitchenTicket(ticket);
  const lines = mappedTicket.lines;
  const printStatus = mappedTicket.printStatus ?? "pending";
  const canAct = printStatus === "pending" || printStatus === "failed";

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
            <Text fw={700} size="sm">
              {tableName}
            </Text>
            {areaName ? (
              <Text c="zinc.5" size="xs">
                {areaName}
              </Text>
            ) : null}
            <Text c="zinc.5" size="xs">
              #{orderRow?.orderNumber ?? ""} · Ticket {ticket.sequenceNumber}
            </Text>
          </Group>
          <Group gap="xs">
            <Badge
              color={PRINT_STATUS_COLORS[printStatus]}
              size="sm"
              variant="light"
            >
              {PRINT_STATUS_LABELS[printStatus]}
            </Badge>
            <Text c="zinc.6" size="xs">
              {formatTicketTime(ticket.createdAt)}
            </Text>
          </Group>
        </Group>

        <div className="rounded-lg border border-zinc-800/60 bg-black/20 px-3 py-2">
          <Stack gap={4}>
            {lines.length === 0 ? (
              <Text c="zinc.5" size="xs">
                Sin líneas registradas.
              </Text>
            ) : (
              lines.map((line) => {
                const operationLabel = getOperationLabel(line.operation);
                return (
                  <div key={line.id}>
                    <Group align="center" gap="xs" wrap="nowrap">
                      {operationLabel ? (
                        <Badge
                          color={line.operation === "cancel" ? "red" : "orange"}
                          size="xs"
                          variant="light"
                        >
                          {operationLabel}
                        </Badge>
                      ) : null}
                      <Text size="xs" truncate>
                        {line.quantity}× {line.productName}
                      </Text>
                    </Group>
                    {line.notes ? (
                      <Text c="zinc.5" fs="italic" size="xs" truncate>
                        Nota: {line.notes}
                      </Text>
                    ) : null}
                    {line.modifiers.length > 0 ? (
                      <Text c="zinc.5" size="xs" truncate>
                        {line.modifiers
                          .map(
                            (modifier) =>
                              `+ ${modifier.quantity} × ${modifier.name}`
                          )
                          .join(" · ")}
                      </Text>
                    ) : null}
                  </div>
                );
              })
            )}
          </Stack>
        </div>

        <Group gap="xs" justify="flex-end">
          <Button
            leftSection={<Eye className="size-3.5" />}
            onClick={() => onOpenDetail(ticket)}
            size="compact-sm"
            variant="subtle"
          >
            Ver comanda
          </Button>
          {canAct ? (
            <Button
              color="gray"
              disabled={isBusy}
              leftSection={<CheckCheck className="size-3.5" />}
              onClick={() => onAcknowledge(ticket)}
              size="compact-sm"
              variant="light"
            >
              Atender sin imprimir
            </Button>
          ) : null}
          {canAct && canPrint ? (
            <Button
              color="voltage"
              disabled={isBusy}
              leftSection={
                printStatus === "failed" ? (
                  <RotateCcw className="size-3.5" />
                ) : (
                  <Printer className="size-3.5" />
                )
              }
              loading={isBusy}
              onClick={() => onPrint(ticket)}
              size="compact-sm"
              variant="light"
            >
              {printStatus === "failed" ? "Reimprimir" : "Imprimir"}
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Card>
  );
}

/**
 * Timestamp del inicio del día local, recalculado cuando la pestaña recupera
 * el foco o cambia de día. Sin esto, una caja abierta a las 23:50 seguiría
 * filtrando por la ventana del día anterior después de medianoche.
 */
function useStartOfToday() {
  const [startOfToday, setStartOfToday] = useState(() =>
    new Date().setHours(0, 0, 0, 0)
  );

  useEffect(() => {
    const refresh = () => {
      setStartOfToday((current) => {
        const next = new Date().setHours(0, 0, 0, 0);
        return next === current ? current : next;
      });
    };
    refresh();

    const dayCheck = setInterval(refresh, 60 * 1000);
    window.addEventListener("focus", refresh);
    window.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(dayCheck);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return startOfToday;
}

export function SalonOrdersInbox() {
  const pageContext = usePageContext();
  const activeOrganizationId = pageContext.zeroContext?.orgID ?? null;
  const startOfToday = useStartOfToday();
  const salonTickets = useSalonKitchenTickets(startOfToday);
  const [organizationRows] = useZeroQuery(queries.organization.current());
  const kitchenSettings = useMemo(() => {
    const settings = parseOrganizationSettingsMetadata(
      organizationRows[0]?.metadata
    );
    return getRestaurantModuleSettings(settings).kitchen;
  }, [organizationRows]);
  const { settings: printerSettings } =
    usePosLocalPrinterSettings(activeOrganizationId);
  const hasLocalPrinter = isPosLocalPrinterConfigured(printerSettings);
  const canPrint = kitchenSettings.printTicketsEnabled && hasLocalPrinter;

  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [detailTicket, setDetailTicket] =
    useState<RestaurantKitchenTicketRow | null>(null);

  // La confirmación del claim lee la fila replicada varias veces durante un
  // mismo click. Debe leer estado vivo: pasar `salonTickets.data` directamente
  // congelaría el array en el closure del render y la comanda nunca se
  // imprimiría.
  const salonTicketsRef = useRef<RestaurantKitchenTicketRow[]>([]);
  useEffect(() => {
    salonTicketsRef.current = salonTickets.data;
  }, [salonTickets.data]);

  const { attemptPrint } = useCajaPrintAttempt({
    activeOrganizationId,
  });
  const requeueMutation = useRequeueKitchenTicketPrintMutation();
  const acknowledgeMutation = useAcknowledgeKitchenTicketPrintMutation();

  const handlePrint = async (ticket: RestaurantKitchenTicketRow) => {
    if (!canPrint || busyTicketId) {
      return;
    }
    setBusyTicketId(ticket.id);
    try {
      if (ticket.printStatus === "failed") {
        await requeueMutation.mutateAsync({ ticketId: ticket.id });
      }
      const outcome = await attemptPrint(ticket, () => salonTicketsRef.current);
      if (outcome.status === "failed") {
        showError(
          "No se pudo imprimir la comanda",
          new Error(outcome.message),
          outcome.message
        );
      }
    } catch (error) {
      showError("No se pudo imprimir la comanda", error, "Inténtalo de nuevo.");
    } finally {
      setBusyTicketId(null);
    }
  };

  const handleAcknowledge = async (ticket: RestaurantKitchenTicketRow) => {
    if (busyTicketId) {
      return;
    }
    setBusyTicketId(ticket.id);
    try {
      await acknowledgeMutation.mutateAsync({ ticketId: ticket.id });
    } catch (error) {
      showError(
        "No se pudo atender la comanda sin imprimir",
        error,
        "Inténtalo de nuevo."
      );
    } finally {
      setBusyTicketId(null);
    }
  };

  if (salonTickets.isError) {
    return (
      <Alert color="red" title="No se pudo cargar el salón" variant="light">
        {salonTickets.error instanceof Error
          ? salonTickets.error.message
          : "Inténtalo de nuevo."}
      </Alert>
    );
  }

  if (salonTickets.isLoading) {
    return (
      <Group align="center" justify="center" py="xl">
        <Loader color="voltage.5" />
      </Group>
    );
  }

  const pendingCount = salonTickets.data.filter(
    (ticket) => ticket.printStatus === "pending"
  ).length;

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ChefHat className="size-4 text-zinc-500" />
          <Text c="zinc.5" size="sm">
            Comandas del salón de hoy
          </Text>
        </Group>
        {pendingCount > 0 ? (
          <Badge color="yellow" variant="light">
            {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </Group>

      {salonTickets.data.length === 0 ? (
        <Stack align="center" gap="md" py={80}>
          <Clock className="size-12 text-zinc-700" />
          <h2 className="font-semibold text-xl text-zinc-500">
            Sin comandas del salón
          </h2>
          <p className="max-w-sm text-center text-sm text-zinc-600">
            Las órdenes que envíen los meseros desde el móvil aparecerán aquí en
            tiempo real.
          </p>
        </Stack>
      ) : (
        <ScrollArea.Autosize mah="calc(100dvh - 260px)" offsetScrollbars>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {salonTickets.data.map((ticket) => (
              <SalonTicketCard
                canPrint={canPrint}
                isBusy={busyTicketId === ticket.id}
                key={ticket.id}
                onAcknowledge={handleAcknowledge}
                onOpenDetail={setDetailTicket}
                onPrint={handlePrint}
                ticket={ticket}
              />
            ))}
          </div>
        </ScrollArea.Autosize>
      )}

      <Modal
        centered
        onClose={() => setDetailTicket(null)}
        opened={detailTicket !== null}
        size="sm"
        title={
          detailTicket
            ? `Comanda #${detailTicket.order?.orderNumber ?? ""} · ${
                detailTicket.order?.table?.name ?? "Mesa"
              }`
            : "Comanda"
        }
      >
        {detailTicket ? <SalonTicketDetail ticket={detailTicket} /> : null}
      </Modal>
    </>
  );
}
