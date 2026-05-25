import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCustomersPage } from "@/features/customers/customers-page-context";

export function CustomersPageHeader() {
  const { state, actions } = useCustomersPage();

  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-3xl tracking-tight">Clientes</h1>
          <Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
            {state.total} clientes
          </Badge>
        </div>
        <p className="text-sm text-zinc-400">
          Gestiona tus clientes y sus datos de contacto.
        </p>
      </div>
      <Button
        className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
        onClick={actions.openCreate}
        type="button"
      >
        <Plus className="size-4" />
        Crear cliente
      </Button>
    </section>
  );
}
