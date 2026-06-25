import { Select, TextInput } from "@mantine/core";
import { Barcode, Search } from "lucide-react";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import { ProductsTable } from "@/features/products/components/products-table";
import type { ProductStockFilterValue } from "@/features/products/products-page.constants.shared";
import {
  PRODUCT_STOCK_FILTER_VALUES,
  UNCATEGORIZED_FILTER_VALUE,
} from "@/features/products/products-page.constants.shared";
import { useProductsPage } from "@/features/products/products-page-context";

const STOCK_FILTER_LABELS: Record<ProductStockFilterValue, string> = {
  all: "Todos los estados",
  out: "Sin stock",
  low: "Stock bajo",
  ok: "En stock",
};

export function ProductsTab() {
  const { state, actions } = useProductsPage();

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="w-full sm:max-w-sm">
          <TextInput
            aria-label="Buscar productos"
            leftSection={
              <Search aria-hidden="true" className="size-4 text-zinc-500" />
            }
            onChange={(event) => actions.setQuery(event.target.value)}
            placeholder="Buscar por nombre, SKU o código..."
            value={state.filters.query}
          />
        </div>
        <Select
          aria-label="Filtrar por categoría"
          className="w-full sm:w-[240px]"
          data={[
            { value: ALL_FILTER_VALUE, label: "Todas las categorías" },
            { value: UNCATEGORIZED_FILTER_VALUE, label: "Sin categoría" },
            ...state.categories.map((category) => ({
              value: category.id,
              label: category.name,
            })),
          ]}
          onChange={(value) => {
            if (value) {
              actions.setCategoryFilter(value);
            }
          }}
          placeholder="Todas las categorías"
          value={state.filters.categoryFilter}
        />
        <Select
          aria-label="Filtrar por estado de stock"
          className="w-full sm:w-[220px]"
          data={PRODUCT_STOCK_FILTER_VALUES.map((value) => ({
            value,
            label: STOCK_FILTER_LABELS[value],
          }))}
          onChange={(value) => {
            if (value) {
              actions.setStockFilter(value as ProductStockFilterValue);
            }
          }}
          placeholder="Estado de stock"
          value={state.filters.stockFilter}
        />
        {state.isBarcodeScannerConnected ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-200 text-xs">
            <Barcode aria-hidden="true" className="size-3.5" />
            Escáner listo
          </span>
        ) : null}
      </div>

      <ProductsTable />
    </>
  );
}
