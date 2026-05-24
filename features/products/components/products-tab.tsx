import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_FILTER_VALUE } from "@/features/listing/listing.constants.shared";
import { ProductsTable } from "@/features/products/components/products-table";
import { UNCATEGORIZED_FILTER_VALUE } from "@/features/products/products-page.constants.shared";
import { useProductsPage } from "@/features/products/products-page-context";

export function ProductsTab() {
  const { state, actions } = useProductsPage();

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="border-zinc-800 bg-black/20 pl-9"
            onChange={(event) => actions.setQuery(event.target.value)}
            placeholder="Buscar por nombre, SKU o código..."
            value={state.filters.query}
          />
        </div>
        <Select
          onValueChange={actions.setCategoryFilter}
          value={state.filters.categoryFilter}
        >
          <SelectTrigger className="w-full border-zinc-800 bg-black/20 text-white sm:w-[240px]">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value={ALL_FILTER_VALUE}>
              Todas las categorías
            </SelectItem>
            <SelectItem value={UNCATEGORIZED_FILTER_VALUE}>
              Sin categoría
            </SelectItem>
            {state.categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ProductsTable />
    </>
  );
}
