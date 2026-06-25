import { Alert, Button } from "@mantine/core";
import type { ReactNode } from "react";
import {
  useKitchenBoard,
  useUpdateRestaurantOrderItemStatusMutation,
} from "@/features/restaurants/hooks/use-restaurants";

export default function KitchenPage() {
  const { data, isError, error } = useKitchenBoard();
  const updateStatusMutation = useUpdateRestaurantOrderItemStatusMutation();

  const tickets = data?.tickets ?? [];

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
          <div
            className="rounded-xl border border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)]"
            key={ticket.id}
          >
            <div className="border-zinc-800 border-b p-6 pb-4">
              <h3 className="font-semibold text-base">
                Orden #{ticket.orderNumber} · {ticket.table.name}
              </h3>
            </div>
            <div className="space-y-3 p-6 pt-5">
              <div className="text-sm text-zinc-400">
                {ticket.table.areaName} · Ticket {ticket.sequenceNumber}
              </div>
              {ticket.items.map((item) => (
                <div
                  className="rounded-lg border border-zinc-800 bg-black/10 p-3"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {item.quantity} × {item.productName}
                      </div>
                      {item.notes ? (
                        <div className="mt-1 text-sm text-zinc-400">
                          {item.notes}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {item.status === "ready" ? "Listo" : "En preparación"}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {item.status === "sent" ? (
                      <Button
                        color="gray"
                        disabled={updateStatusMutation.isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            orderItemId: item.id,
                            status: "ready",
                          })
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Marcar Listo
                      </Button>
                    ) : null}
                    <Button
                      color="gray"
                      disabled={updateStatusMutation.isPending}
                      onClick={() =>
                        updateStatusMutation.mutate({
                          orderItemId: item.id,
                          status: "served",
                        })
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Despachar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
