import { Alert, Button } from "@mantine/core";
import type { ReactNode } from "react";
import {
  useKitchenBoard,
  useUpdateRestaurantOrderItemStatusMutation,
} from "@/features/restaurants/hooks/use-restaurants";
import { getKitchenModificationDetails } from "@/features/restaurants/kitchen-corrections.shared";
import type { KitchenBoard } from "@/features/restaurants/restaurants.shared";

export type KitchenTicket = KitchenBoard["tickets"][number];
type KitchenTicketLine = KitchenTicket["lines"][number];
interface KitchenLineStatusUpdate {
  status: "acknowledged" | "cancelled" | "ready" | "served";
  ticketLineId: string;
}

function getKitchenLineStatusLabel(line: KitchenTicketLine) {
  if (line.operation === "modify") {
    return "Modificación";
  }
  if (line.operation === "cancel") {
    return "Anulación";
  }
  if (line.status === "ready") {
    return "Listo";
  }
  return "En preparación";
}

function KitchenTicketLineCard({
  line,
  isUpdating,
  onUpdateStatus,
}: {
  isUpdating: boolean;
  line: KitchenTicketLine;
  onUpdateStatus: (input: KitchenLineStatusUpdate) => void;
}) {
  const isCancellation = line.operation === "cancel";
  const isModification = line.operation === "modify";
  const isCorrection = isCancellation || isModification;
  const secondaryTextClass = isCorrection
    ? "mt-1 text-sm text-zinc-700"
    : "mt-1 text-sm text-zinc-400";
  const statusTextClass = isCorrection
    ? "text-xs text-zinc-700"
    : "text-xs text-zinc-400";
  const modificationDetails = isModification
    ? getKitchenModificationDetails({
        modifiers: line.modifiers,
        notes: line.notes,
        previousModifiers: line.previousModifiers,
        previousNotes: line.previousNotes,
        previousQuantity: line.previousQuantity,
        quantity: line.quantity,
      })
    : [];

  return (
    <div
      className={
        isCorrection
          ? "rounded-lg border-2 border-black bg-white p-3 text-black"
          : "rounded-lg border border-zinc-800 bg-black/10 p-3"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {isCorrection ? (
            <div className="mb-1 font-black text-xs tracking-[0.12em]">
              {isModification ? "MODIFICACIÓN" : "CANCELAR / NO PREPARAR"}
            </div>
          ) : null}
          <div className="truncate font-medium">
            {line.quantity} × {line.productName}
          </div>
          {isModification
            ? modificationDetails.map((detail) => (
                <div className={secondaryTextClass} key={detail}>
                  {detail}
                </div>
              ))
            : null}
          {!isModification && line.notes ? (
            <div className={secondaryTextClass}>{line.notes}</div>
          ) : null}
          {isModification
            ? null
            : line.modifiers.map((modifier) => (
                <div className={secondaryTextClass} key={modifier.id}>
                  + {modifier.quantity} × {modifier.name}
                </div>
              ))}
        </div>
        <div className={statusTextClass}>{getKitchenLineStatusLabel(line)}</div>
      </div>
      <div className="mt-3 flex gap-2">
        {isCancellation ? (
          <Button
            color="dark"
            disabled={isUpdating}
            onClick={() =>
              onUpdateStatus({ ticketLineId: line.id, status: "cancelled" })
            }
            size="sm"
            type="button"
          >
            Confirmar anulación
          </Button>
        ) : null}
        {isModification ? (
          <Button
            color="dark"
            disabled={isUpdating}
            onClick={() =>
              onUpdateStatus({ ticketLineId: line.id, status: "acknowledged" })
            }
            size="sm"
            type="button"
          >
            Confirmar modificación
          </Button>
        ) : null}
        {!isCorrection && line.status === "sent" ? (
          <Button
            color="gray"
            disabled={isUpdating}
            onClick={() =>
              onUpdateStatus({ ticketLineId: line.id, status: "ready" })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Marcar Listo
          </Button>
        ) : null}
        {isCorrection ? null : (
          <Button
            color="gray"
            disabled={isUpdating}
            onClick={() =>
              onUpdateStatus({ ticketLineId: line.id, status: "served" })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Despachar
          </Button>
        )}
      </div>
    </div>
  );
}

export function KitchenTicketCard({
  ticket,
  isUpdating,
  onUpdateStatus,
}: {
  isUpdating: boolean;
  onUpdateStatus: (input: KitchenLineStatusUpdate) => void;
  ticket: KitchenTicket;
}) {
  const isCorrection = ticket.kind === "correction";
  const ticketClassName = isCorrection
    ? "rounded-xl border-4 border-black bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-[0_0_0_1px_#52525b]"
    : "rounded-xl border border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)]";
  const headerClassName = isCorrection
    ? "border-black border-b bg-black p-6 pb-4 text-white"
    : "border-zinc-800 border-b p-6 pb-4";

  return (
    <div className={ticketClassName}>
      <div className={headerClassName}>
        <h3 className="font-semibold text-base">
          Comanda #{ticket.orderNumber} · {ticket.table.name}
        </h3>
        {isCorrection ? (
          <p className="mt-2 font-black text-sm tracking-[0.16em]">
            CORRECCIÓN #{ticket.sequenceNumber}
          </p>
        ) : null}
      </div>
      <div className="space-y-3 p-6 pt-5">
        <div className="text-sm text-zinc-400">
          {ticket.table.areaName} · Ticket {ticket.sequenceNumber}
        </div>
        {ticket.lines.map((line) => (
          <KitchenTicketLineCard
            isUpdating={isUpdating}
            key={line.id}
            line={line}
            onUpdateStatus={onUpdateStatus}
          />
        ))}
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const { data, isError, error } = useKitchenBoard();
  const updateStatusMutation = useUpdateRestaurantOrderItemStatusMutation();
  const tickets = data?.tickets ?? [];
  const updateKitchenLineStatus = (input: KitchenLineStatusUpdate) => {
    updateStatusMutation.mutate(input);
  };

  let boardContent: ReactNode;

  if (isError) {
    boardContent = (
      <Alert color="red" title="Acceso denegado" variant="light">
        {error instanceof Error
          ? error.message
          : "No tienes acceso a la pantalla de cocina."}
      </Alert>
    );
  } else if (tickets.length === 0) {
    boardContent = (
      <Alert color="gray" title="Sin comandas">
        No hay tickets pendientes en este momento.
      </Alert>
    );
  } else {
    boardContent = (
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {tickets.map((ticket) => (
          <KitchenTicketCard
            isUpdating={updateStatusMutation.isPending}
            key={ticket.id}
            onUpdateStatus={updateKitchenLineStatus}
            ticket={ticket}
          />
        ))}
      </div>
    );
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8">
      <div className="mb-6">
        <h1 className="font-semibold text-2xl">Cocina</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Comandas pendientes y listas para despacho.
        </p>
      </div>

      {boardContent}
    </main>
  );
}
