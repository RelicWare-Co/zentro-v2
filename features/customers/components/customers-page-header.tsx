import { Badge, Button } from "@mantine/core";
import { Plus } from "lucide-react";
import { useCustomersPage } from "@/features/customers/customers-page-context";

export function CustomersPageHeader() {
  const { state, actions } = useCustomersPage();

  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-3xl tracking-tight">Clientes</h1>
          <Badge color="voltage" radius="xl" variant="light">
            {state.total} clientes
          </Badge>
        </div>
        <p className="text-sm text-zinc-400">
          Gestiona tus clientes y sus datos de contacto.
        </p>
      </div>
      <Button
        c="black"
        color="voltage.5"
        leftSection={<Plus className="size-4" />}
        onClick={actions.openCreate}
        type="button"
      >
        Crear cliente
      </Button>
    </section>
  );
}
