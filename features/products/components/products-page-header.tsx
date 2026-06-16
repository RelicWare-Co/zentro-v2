import { Badge, Button } from "@mantine/core";
import { PackagePlus, Plus } from "lucide-react";
import { Link } from "@/components/link";
import { useProductsPage } from "@/features/products/products-page-context";

export function ProductsPageHeader() {
  const { state, actions } = useProductsPage();
  const hasTrackedInventory = state.catalogProducts.some(
    (product) => product.trackInventory
  );

  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-3xl tracking-tight">Inventario</h1>
          <Badge color="voltage" radius="xl" tt="none" variant="light">
            {state.total} productos
          </Badge>
        </div>
        <p className="text-sm text-zinc-400">
          Catálogo de productos, categorías y ajustes básicos de stock.
        </p>
        <p className="text-xs text-zinc-500">
          Alertas cuando stock ≤ {state.lowStockThreshold}.{" "}
          <Link
            className="text-[var(--color-voltage)] hover:underline"
            href="/settings"
          >
            Configurar umbral global
          </Link>
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          color="gray"
          disabled={!hasTrackedInventory}
          leftSection={<PackagePlus className="size-4" />}
          onClick={actions.openInventoryMovement}
          type="button"
          variant="outline"
        >
          Movimiento de stock
        </Button>
        <Button
          c="black"
          color="voltage.5"
          leftSection={<Plus className="size-4" />}
          onClick={actions.openCreateProduct}
          type="button"
        >
          Agregar producto
        </Button>
      </div>
    </section>
  );
}
