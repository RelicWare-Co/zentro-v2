import { PackagePlus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProductsPage } from "@/features/products/products-page-context";

export function ProductsPageHeader() {
  const { state, actions } = useProductsPage();
  const hasTrackedInventory = state.products.some(
    (product) => product.trackInventory
  );

  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-3xl tracking-tight">Inventario</h1>
          <Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
            {state.total} productos
          </Badge>
        </div>
        <p className="text-sm text-zinc-400">
          Catálogo de productos, categorías y ajustes básicos de stock.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="border-zinc-800 bg-[var(--color-carbon)] text-zinc-300 hover:bg-white/5 hover:text-white"
          disabled={!hasTrackedInventory}
          onClick={actions.openInventoryMovement}
          type="button"
          variant="outline"
        >
          <PackagePlus className="size-4" />
          Movimiento de stock
        </Button>
        <Button
          className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
          onClick={actions.openCreateProduct}
          type="button"
        >
          <Plus className="size-4" />
          Agregar producto
        </Button>
      </div>
    </section>
  );
}
