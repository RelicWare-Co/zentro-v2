import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Alert
        className="border-red-500/20 bg-red-500/10 text-red-100"
        variant="destructive"
      >
        <AlertTitle>Acceso denegado</AlertTitle>
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : "No tienes acceso a la pantalla de cocina."}
        </AlertDescription>
      </Alert>
    );
  } else if (tickets.length === 0) {
    boardContent = (
      <Alert className="border-zinc-700 bg-[var(--color-carbon)] text-[var(--color-photon)]">
        <AlertTitle>Sin comandas</AlertTitle>
        <AlertDescription>
          No hay tickets pendientes en este momento.
        </AlertDescription>
      </Alert>
    );
  } else {
    boardContent = (
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {tickets.map((ticket) => (
          <Card
            className="border-zinc-800 bg-[var(--color-carbon)] shadow-none"
            key={ticket.id}
          >
            <CardHeader className="border-zinc-800 border-b pb-4">
              <CardTitle className="text-base">
                Orden #{ticket.orderNumber} · {ticket.table.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
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
                        className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
                        disabled={updateStatusMutation.isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            orderItemId: item.id,
                            status: "ready",
                          })
                        }
                        type="button"
                        variant="outline"
                      >
                        Marcar Listo
                      </Button>
                    ) : null}
                    <Button
                      className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
                      disabled={updateStatusMutation.isPending}
                      onClick={() =>
                        updateStatusMutation.mutate({
                          orderItemId: item.id,
                          status: "served",
                        })
                      }
                      type="button"
                      variant="outline"
                    >
                      Despachar
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
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
