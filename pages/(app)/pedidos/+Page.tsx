import { Tabs } from "@mantine/core";
import { ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useModuleCapabilities } from "@/features/modules/hooks/use-module-capabilities";
import { OnlineOrdersInbox } from "@/features/orders/components/online-orders-inbox";
import { SalonOrdersInbox } from "@/features/restaurants/components/salon-orders-inbox";

export default function PedidosPage() {
  const { data: capabilities } = useModuleCapabilities();
  const restaurantAccessible =
    capabilities?.modules.restaurants?.accessible ?? false;

  return (
    <main className="space-y-6 bg-[var(--color-page-bg)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-3xl tracking-tight">Pedidos</h1>
          </div>
          <p className="text-sm text-zinc-400">
            Bandeja de pedidos en línea y comandas del salón. Acepta, cobra y
            gestiona lo que llega desde tu página web o desde el móvil de los
            meseros.
          </p>
        </div>
      </section>

      <Tabs
        autoContrast
        classNames={{
          tab: "font-semibold transition-colors not-data-[active]:bg-zinc-800! not-data-[active]:hover:bg-zinc-700!",
        }}
        color="voltage"
        defaultValue="online"
        keepMounted={false}
        variant="pills"
      >
        <Tabs.List className="max-w-md gap-2" grow>
          <Tabs.Tab
            leftSection={<ShoppingBag className="size-4" />}
            value="online"
          >
            En línea
          </Tabs.Tab>
          {restaurantAccessible ? (
            <Tabs.Tab
              leftSection={<UtensilsCrossed className="size-4" />}
              value="salon"
            >
              Salón
            </Tabs.Tab>
          ) : null}
        </Tabs.List>

        <Tabs.Panel pt="md" value="online">
          <OnlineOrdersInbox />
        </Tabs.Panel>

        {restaurantAccessible ? (
          <Tabs.Panel pt="md" value="salon">
            <SalonOrdersInbox />
          </Tabs.Panel>
        ) : null}
      </Tabs>
    </main>
  );
}
