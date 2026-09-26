import { Alert, Group, Loader } from "@mantine/core";
import { useState } from "react";
import { useModuleCapabilities } from "@/features/modules/hooks/use-module-capabilities";
import { WaiterFloorView } from "@/features/restaurants/components/waiter/waiter-floor-view";
import { WaiterTableOrderView } from "@/features/restaurants/components/waiter/waiter-table-order-view";

export default function WaiterSalonPage() {
  const { data: capabilities, isLoading } = useModuleCapabilities();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const restaurantAccessible =
    capabilities?.modules.restaurants?.accessible ?? false;

  if (!capabilities && isLoading) {
    return (
      <Group align="center" justify="center" py="xl">
        <Loader color="voltage.5" />
      </Group>
    );
  }

  if (!restaurantAccessible) {
    return (
      <main className="bg-[var(--color-page-bg)] p-6 text-[var(--color-photon)] md:p-8">
        <Alert color="red" title="Módulo de restaurantes no disponible">
          Activa el módulo de restaurantes en Configuración para usar el salón.
        </Alert>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[var(--color-page-bg)] p-4 text-[var(--color-photon)] sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col">
        {selectedTableId ? null : (
          <header className="mb-4">
            <h1 className="font-semibold text-2xl tracking-tight">Salón</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Toma pedidos desde el móvil; las comandas se imprimen en la caja
              activa.
            </p>
          </header>
        )}

        {selectedTableId ? (
          <WaiterTableOrderView
            onBack={() => setSelectedTableId(null)}
            tableId={selectedTableId}
          />
        ) : (
          <WaiterFloorView onSelectTable={setSelectedTableId} />
        )}
      </div>
    </main>
  );
}
