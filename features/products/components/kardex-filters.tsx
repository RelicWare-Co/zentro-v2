import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, Product } from "@/features/products/hooks/use-products";
import type { InventoryMovementType } from "@/features/products/inventory-movements.shared";
import { INVENTORY_MOVEMENT_TYPE_LABELS } from "@/features/products/inventory-movements.shared";

export interface KardexFiltersState {
  endDate: string;
  productId: string;
  searchQuery: string;
  startDate: string;
  type: string;
}

export function KardexFilters({
  categories: _categories,
  filters,
  onChange,
  products,
}: {
  categories: Category[];
  filters: KardexFiltersState;
  onChange: (patch: Partial<KardexFiltersState>) => void;
  products: Product[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
      <div className="relative xl:col-span-2">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="border-zinc-800 bg-black/20 pl-9"
          onChange={(event) => onChange({ searchQuery: event.target.value })}
          placeholder="Buscar producto, notas o usuario..."
          value={filters.searchQuery}
        />
      </div>
      <Select
        onValueChange={(value) => onChange({ productId: value })}
        value={filters.productId}
      >
        <SelectTrigger className="border-zinc-800 bg-black/20 text-white">
          <SelectValue placeholder="Producto" />
        </SelectTrigger>
        <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
          <SelectItem value="all">Todos los productos</SelectItem>
          {products.map((product) => (
            <SelectItem key={product.id} value={product.id}>
              {product.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        onValueChange={(value) => onChange({ type: value })}
        value={filters.type}
      >
        <SelectTrigger className="border-zinc-800 bg-black/20 text-white">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
          <SelectItem value="all">Todos los tipos</SelectItem>
          {(
            Object.keys(
              INVENTORY_MOVEMENT_TYPE_LABELS
            ) as InventoryMovementType[]
          ).map((movementType) => (
            <SelectItem key={movementType} value={movementType}>
              {INVENTORY_MOVEMENT_TYPE_LABELS[movementType]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input
          className="border-zinc-800 bg-black/20"
          onChange={(event) => onChange({ startDate: event.target.value })}
          type="date"
          value={filters.startDate}
        />
        <Input
          className="border-zinc-800 bg-black/20"
          onChange={(event) => onChange({ endDate: event.target.value })}
          type="date"
          value={filters.endDate}
        />
      </div>
    </div>
  );
}
